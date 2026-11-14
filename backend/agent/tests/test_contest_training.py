"""OI / xCPC contest training protocol tests for ``POST /chat``.

Covers the optional ``trainingPhase`` / ``timeRemainingSec`` wire fields, the
phase-specific prompt guidance and its unknown-value fallback, FOCUS silence
with a training context, and the phase reaching AgentScope's user message and
the ReMe auto-memory write-back through the fake model / middleware doubles.
No real model, ReMe app, gateway or vector store is touched.
"""

import pytest
from conftest import FakeChatModel, RecordingReMe
from pydantic import ValidationError

from app.agent import router as router_module
from app.agent.coach import AlgoCoach
from app.agent.prompts import (
    CONTEST_PROTOCOL,
    DEFAULT_TRAINING_PHASE,
    GOAL_GUIDANCE,
    PHASE_GUIDANCE,
    SOUL,
    TrainingPhase,
    UserGoal,
    build_training_context,
    get_system_prompt,
    is_contest_context,
    resolve_training_phase,
    time_remaining_note,
)
from app.models.schemas import ChatRequest

LEGACY_SOUL_PREFIX = SOUL.split("{memory_context}")[0]
CONTEST_BASE_PROMPT = get_system_prompt(UserGoal.CONTEST)


def _request(**overrides) -> ChatRequest:
    body = {"message": "讲讲这题", "mode": "PREP"}
    body.update(overrides)
    return ChatRequest.model_validate(body)


def _last_user_text(messages) -> str:
    """Return the newest user turn; AgentState's message list grows in place."""
    for message in reversed(messages):
        if getattr(message, "role", None) == "user":
            return message.get_text_content() or ""
    raise AssertionError("the recorded model call had no user message")


def _make_coach(tmp_path, *, responses=None):
    model = FakeChatModel(responses=responses)
    reme = RecordingReMe(str(tmp_path / "reme"))
    coach = AlgoCoach(chat_model=model, reme_middleware=reme)
    return coach, model, reme


# ── Pydantic wire contract ────────────────────────────────────


def test_chat_request_defaults_keep_the_old_contract():
    req = _request(problemId="two-sum")

    assert req.problemId == "two-sum"
    assert req.trainingPhase == DEFAULT_TRAINING_PHASE.value == "auto"
    assert req.timeRemainingSec is None
    assert req.goal is None


@pytest.mark.parametrize("goal", ["contest", "interview_prep", "casual"])
def test_chat_request_accepts_supported_user_goals(goal):
    assert _request(goal=goal).goal == goal


@pytest.mark.parametrize("goal", ["unknown", "", 42, None])
def test_chat_request_unknown_goal_uses_default(goal):
    assert _request(goal=goal).goal is None


@pytest.mark.parametrize("phase", [phase.value for phase in TrainingPhase])
def test_chat_request_accepts_every_documented_phase(phase):
    assert _request(trainingPhase=phase).trainingPhase == phase


@pytest.mark.parametrize(
    ("raw", "expected"),
    [("HINT", "hint"), (" hint ", "hint"), ("Virtual_Contest", "virtual_contest")],
)
def test_phase_normalisation_is_case_and_whitespace_insensitive(raw, expected):
    assert _request(trainingPhase=raw).trainingPhase == expected


@pytest.mark.parametrize("raw", ["bogus", "", "practice", "unknown_phase", 42, None])
def test_unknown_phase_falls_back_to_auto(raw):
    assert _request(trainingPhase=raw).trainingPhase == "auto"


def test_time_remaining_accepts_zero_and_coerces_numeric_strings():
    assert _request(timeRemainingSec=0).timeRemainingSec == 0
    assert _request(timeRemainingSec="42").timeRemainingSec == 42


@pytest.mark.parametrize("bad", [-1, 1.5, True, "soon", []])
def test_time_remaining_rejects_invalid_values(bad):
    with pytest.raises(ValidationError):
        _request(timeRemainingSec=bad)


# ── Prompt selection ─────────────────────────────────────────


def test_contest_protocol_covers_the_real_oi_xcpc_routine():
    for marker in (
        "读题",
        "分类",
        "约束推导",
        "部分得分",
        "upsolve",
        "赛后",
        "复杂度",
        "证明",
        "不变量",
    ):
        assert marker in CONTEST_PROTOCOL
        assert marker in CONTEST_BASE_PROMPT

    # The base Soul and every goal variant are still the untouched prefix.
    assert CONTEST_BASE_PROMPT.startswith(SOUL)
    assert GOAL_GUIDANCE[UserGoal.CONTEST] in CONTEST_BASE_PROMPT


@pytest.mark.parametrize("phase", list(PHASE_GUIDANCE))
def test_each_explicit_phase_appends_its_guidance(phase):
    prompt = get_system_prompt(UserGoal.CONTEST, training_phase=phase)

    assert prompt.startswith(CONTEST_BASE_PROMPT)
    assert PHASE_GUIDANCE[phase] in prompt
    # Phase guidance never weakens the base mode rules.
    assert "FOCUS" in prompt and "绝对不主动发言" in prompt


def test_auto_and_unknown_phases_keep_the_plain_contest_prompt():
    assert get_system_prompt(UserGoal.CONTEST) == CONTEST_BASE_PROMPT
    assert (
        get_system_prompt(
            UserGoal.CONTEST, training_phase=DEFAULT_TRAINING_PHASE
        )
        == CONTEST_BASE_PROMPT
    )
    assert (
        get_system_prompt(UserGoal.CONTEST, training_phase="bogus")
        == CONTEST_BASE_PROMPT
    )
    for guidance in PHASE_GUIDANCE.values():
        assert guidance not in CONTEST_BASE_PROMPT


def test_phase_guidance_matches_the_requested_stance():
    assert "只做读题、约束与计分策略" in PHASE_GUIDANCE[
        TrainingPhase.VIRTUAL_CONTEST
    ]
    assert "禁止直接给出答案" in PHASE_GUIDANCE[TrainingPhase.ATTEMPT]
    hint = PHASE_GUIDANCE[TrainingPhase.HINT]
    assert all(
        word in hint for word in ("概念", "不变量", "伪代码骨架", "边界")
    )
    review = PHASE_GUIDANCE[TrainingPhase.REVIEW]
    assert all(word in review for word in ("建模", "证明", "复杂度", "反例"))
    assert "不得推断其具体实现" in review
    assert "贴关键代码和自己的诊断" in review
    assert "独立重做" in PHASE_GUIDANCE[TrainingPhase.UPSOLVE]


def test_non_contest_goals_ignore_training_fields():
    for goal in (UserGoal.INTERVIEW_PREP, UserGoal.CASUAL):
        base = get_system_prompt(goal)
        noisy = get_system_prompt(
            goal, training_phase="review", time_remaining_sec=120
        )
        assert noisy == base
        assert "竞赛训练协议" not in noisy
    # A missing goal keeps the original Soul byte for byte.
    assert get_system_prompt(None, training_phase="hint") == SOUL


@pytest.mark.parametrize(
    ("seconds", "marker"),
    [
        (0, "最后 5 分钟"),
        (300, "最后 5 分钟"),
        (301, "剩余不足 15 分钟"),
        (900, "剩余不足 15 分钟"),
        (1800, "按分值与剩余时间"),
        (2700, "按分值与剩余时间"),
        (7200, "时间充足"),
    ],
)
def test_remaining_time_reminder_bands(seconds, marker):
    note = time_remaining_note(seconds)

    assert marker in note
    assert time_remaining_note(None) == ""
    contest = get_system_prompt(
        UserGoal.CONTEST, training_phase="attempt", time_remaining_sec=seconds
    )
    assert note in contest


def test_remaining_time_is_rendered_readably():
    assert "7 分 0 秒" in time_remaining_note(420)
    assert "2 小时 0 分" in time_remaining_note(7200)


def test_every_prompt_still_formats_the_memory_placeholder():
    combos = [
        get_system_prompt(goal, training_phase=phase, time_remaining_sec=600)
        for goal in UserGoal
        for phase in TrainingPhase
    ]
    for prompt in combos:
        rendered = prompt.format(memory_context='{"weak_topics": ["DP"]}')
        assert '{"weak_topics": ["DP"]}' in rendered


# ── Training context helpers ─────────────────────────────────


def test_training_context_line_is_stable_and_optional():
    assert build_training_context() == ""
    assert build_training_context("bogus") == ""
    assert (
        build_training_context("hint", 420)
        == "[竞赛训练上下文] 训练阶段=hint；剩余时间=420 秒"
    )
    assert (
        build_training_context(None, 0)
        == "[竞赛训练上下文] 训练阶段=auto；剩余时间=0 秒"
    )
    # A direct caller cannot inject a negative countdown.
    assert "剩余时间=0 秒" in build_training_context("hint", -5)


@pytest.mark.parametrize(
    ("phase", "seconds", "expected"),
    [
        (None, None, False),
        (DEFAULT_TRAINING_PHASE, None, False),
        ("bogus", None, False),
        ("hint", None, True),
        ("auto", 600, True),
        ("review", 0, True),
    ],
)
def test_contest_context_detection(phase, seconds, expected):
    assert is_contest_context(phase, seconds) is expected


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        (TrainingPhase.HINT, TrainingPhase.HINT),
        ("REVIEW", TrainingPhase.REVIEW),
        (" upsolve ", TrainingPhase.UPSOLVE),
        ("nope", TrainingPhase.AUTO),
        (None, TrainingPhase.AUTO),
        (1, TrainingPhase.AUTO),
    ],
)
def test_resolve_training_phase_falls_back_to_auto(raw, expected):
    assert resolve_training_phase(raw) is expected


# ── HTTP route wiring ────────────────────────────────────────


class _RecordingCoach:
    """Spy that records what the route forwards and returns a fixed reply."""

    def __init__(self):
        self.calls: list[dict] = []

    async def chat(self, **kwargs):
        self.calls.append(kwargs)
        return {"content": "reviewed", "animation_id": None}


@pytest.mark.asyncio
async def test_chat_route_forwards_training_fields_unchanged(client, monkeypatch):
    spy = _RecordingCoach()
    monkeypatch.setattr(router_module, "coach", spy)

    resp = await client.post(
        "/chat",
        json={
            "message": "这题怎么建模",
            "mode": "REVIEW",
            "problemId": "two-sum",
            "goal": "interview_prep",
            "trainingPhase": "review",
            "timeRemainingSec": 1800,
        },
    )

    assert resp.status_code == 200
    # The response contract is unchanged: no training field leaks back.
    assert resp.json() == {"content": "reviewed", "animationId": None}
    assert spy.calls == [
        {
            "session_id": "default",
            "message": "这题怎么建模",
            "mode": "REVIEW",
            "problem_id": "two-sum",
            "goal": "interview_prep",
            "training_phase": "review",
            "time_remaining_sec": 1800,
        }
    ]


@pytest.mark.asyncio
async def test_chat_route_normalises_unknown_phase_and_keeps_legacy_body(
    client, monkeypatch
):
    spy = _RecordingCoach()
    monkeypatch.setattr(router_module, "coach", spy)

    unknown = await client.post(
        "/chat",
        json={"message": "hi", "mode": "PREP", "trainingPhase": "no-such-phase"},
    )
    legacy = await client.post("/chat", json={"message": "hi", "mode": "PREP"})

    assert unknown.status_code == 200 and legacy.status_code == 200
    assert spy.calls[0]["training_phase"] == "auto"
    assert spy.calls[0]["time_remaining_sec"] is None
    assert spy.calls[1]["training_phase"] == "auto"
    assert spy.calls[1]["time_remaining_sec"] is None


@pytest.mark.asyncio
async def test_chat_route_rejects_negative_remaining_time(client, monkeypatch):
    spy = _RecordingCoach()
    monkeypatch.setattr(router_module, "coach", spy)

    resp = await client.post(
        "/chat",
        json={"message": "hi", "mode": "PREP", "timeRemainingSec": -1},
    )

    assert resp.status_code == 422
    assert spy.calls == []


# ── AgentScope / ReMe propagation ────────────────────────────


def _auto_memory_text(reme) -> str:
    return " ".join(
        block.get("text", "")
        for name, kwargs in reme.jobs
        if name == "auto_memory"
        for message in kwargs["messages"]
        for block in message.get("content", [])
        if isinstance(block, dict)
    )


@pytest.mark.asyncio
async def test_focus_with_training_context_stays_silent(tmp_path):
    coach, model, reme = _make_coach(tmp_path)

    result = await coach.chat(
        "focus-session",
        "help",
        "FOCUS",
        "two-sum",
        training_phase="hint",
        time_remaining_sec=300,
    )

    assert result == {"content": "", "animation_id": None}
    assert model.calls == []
    assert reme.start_count == 0
    assert reme.jobs == []
    assert coach._agents == {}


@pytest.mark.asyncio
async def test_phase_reaches_user_message_system_context_and_reme(tmp_path):
    coach, model, reme = _make_coach(tmp_path)

    result = await coach.chat(
        "s1",
        "给我一点提示",
        "PREP",
        "two-sum",
        training_phase="hint",
        time_remaining_sec=420,
    )

    # ChatResponse stays {"content", "animation_id"} for the route.
    assert result == {"content": "好的", "animation_id": None}

    messages = model.calls[0]["messages"]
    user_text = _last_user_text(messages)
    assert "训练阶段=hint" in user_text
    assert "剩余时间=420 秒" in user_text
    assert "给我一点提示" in user_text

    system = messages[0].get_text_content()
    assert CONTEST_PROTOCOL in system
    assert PHASE_GUIDANCE[TrainingPhase.HINT] in system
    assert "当前剩余时间：约 7 分 0 秒" in system

    # ReMe's automatic write-back sees the stamped user turn, so its memory
    # contains the training phase.
    assert "训练阶段=hint" in _auto_memory_text(reme)
    assert "剩余时间=420 秒" in _auto_memory_text(reme)


@pytest.mark.asyncio
async def test_default_phase_keeps_the_legacy_message_and_soul(tmp_path):
    coach, model, reme = _make_coach(tmp_path)

    await coach.chat("s1", "讲讲 BFS", "PREP")

    messages = model.calls[0]["messages"]
    user_text = _last_user_text(messages)
    assert user_text == "讲讲 BFS"
    system = messages[0].get_text_content()
    assert system.startswith(LEGACY_SOUL_PREFIX)
    assert "竞赛训练协议" not in system
    assert "训练阶段=" not in user_text
    assert _auto_memory_text(reme).count("训练阶段=") == 0


@pytest.mark.asyncio
async def test_saved_user_goal_selects_its_prompt_variant(tmp_path):
    coach, model, _reme = _make_coach(tmp_path)

    await coach.chat("s1", "讲讲 BFS", "PREP", goal=UserGoal.INTERVIEW_PREP)

    system = model.calls[0]["messages"][0].get_text_content()
    assert GOAL_GUIDANCE[UserGoal.INTERVIEW_PREP] in system
    assert "竞赛训练协议" not in system


@pytest.mark.asyncio
async def test_time_budget_alone_activates_the_contest_context(tmp_path):
    coach, model, _reme = _make_coach(tmp_path)

    await coach.chat(
        "s1", "还剩多久", "PREP", training_phase="auto", time_remaining_sec=600
    )

    messages = model.calls[0]["messages"]
    user_text = _last_user_text(messages)
    system = messages[0].get_text_content()
    assert "训练阶段=auto" in user_text
    assert "剩余时间=600 秒" in user_text
    assert CONTEST_PROTOCOL in system
    assert "剩余不足 15 分钟" in system
    # No phase-specific stance without an explicit phase.
    for guidance in PHASE_GUIDANCE.values():
        assert guidance not in system


@pytest.mark.asyncio
async def test_phase_can_change_between_turns_on_the_same_agent(tmp_path):
    coach, model, _reme = _make_coach(tmp_path)

    await coach.chat("s1", "开始", "PREP", training_phase="attempt")
    await coach.chat("s1", "复盘", "REVIEW", training_phase="review")

    first_system = model.calls[0]["messages"][0].get_text_content()
    second_system = model.calls[1]["messages"][0].get_text_content()
    assert PHASE_GUIDANCE[TrainingPhase.ATTEMPT] in first_system
    assert PHASE_GUIDANCE[TrainingPhase.REVIEW] in second_system
    assert PHASE_GUIDANCE[TrainingPhase.REVIEW] not in first_system
    assert "训练阶段=review" in _last_user_text(model.calls[1]["messages"])
