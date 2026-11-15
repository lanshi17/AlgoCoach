"""AgentScope / ReMe migration tests for the /chat runtime.

No real model call is made: ``FakeChatModel`` is a deterministic AgentScope
``ChatModelBase`` double from ``conftest.py``, and ``RecordingReMe`` records the
middleware's ``search`` / ``auto_memory`` jobs without starting the embedded
ReMe app. A separate test starts and closes a real embedded ReMe app to pin
the pinned ``reme-ai`` version's lifecycle contract.
"""
import json

import pytest
from agentscope.message import TextBlock, ToolCallBlock
from agentscope.model import ChatResponse
from conftest import FakeChatModel, RecordingReMe

from app.agent import coach as coach_module
from app.agent import router as router_module
from app.agent.coach import AlgoCoach
from app.remotion.animation_service import animation_service

pytestmark = pytest.mark.asyncio


def _text(text: str = "好的") -> ChatResponse:
    return ChatResponse(content=[TextBlock(text=text)], is_last=True)


def _tool_call(name: str, inputs: dict, call_id: str = "call-1") -> ChatResponse:
    return ChatResponse(
        content=[
            ToolCallBlock(
                id=call_id,
                name=name,
                input=json.dumps(inputs, ensure_ascii=False),
            )
        ],
        is_last=True,
    )


def _make_coach(tmp_path, *, responses=None, search_results=None):
    model = FakeChatModel(responses=responses)
    reme = RecordingReMe(
        str(tmp_path / "reme"), search_results=search_results
    )
    coach = AlgoCoach(chat_model=model, reme_middleware=reme)
    return coach, model, reme


async def test_chat_route_uses_agentscope_agent_and_stable_session(
    client, tmp_path, monkeypatch
):
    coach, model, reme = _make_coach(tmp_path)
    monkeypatch.setattr(router_module, "coach", coach)

    resp = await client.post(
        "/chat",
        json={"message": "讲讲 BFS", "mode": "PREP", "problemId": "bfs-1"},
    )

    assert resp.status_code == 200
    assert resp.json() == {"content": "好的", "animationId": None}
    agent = coach._agents["default"]
    assert agent.state.session_id == "default"
    assert len(model.calls) == 1
    # The public contract is unchanged, and FOCUS was not involved.
    assert reme.start_count == 1


async def test_focus_route_returns_before_model_memory_and_tools(
    client, tmp_path, monkeypatch
):
    coach, model, reme = _make_coach(tmp_path)
    monkeypatch.setattr(router_module, "coach", coach)

    resp = await client.post(
        "/chat",
        json={"message": "help", "mode": "FOCUS", "problemId": "two-sum"},
    )

    assert resp.status_code == 200
    assert resp.json() == {"content": "", "animationId": None}
    assert model.calls == []
    assert reme.start_count == 0
    assert reme.jobs == []
    assert coach._agents == {}


@pytest.mark.parametrize(
    ("mode", "problem_id", "expected"),
    [
        ("IDLE", None, "模式=IDLE；尚未选择题目。用户尚未开始做题"),
        ("PREP", "two-sum", "模式=PREP；已选择题目。用户尚未开始做题"),
        ("REVIEW", "two-sum", "模式=REVIEW；已选择题目。只有用户提供的提交或代码事实"),
    ],
)
async def test_current_interface_mode_is_supplied_to_the_model(tmp_path, mode, problem_id, expected):
    coach, model, _reme = _make_coach(tmp_path)

    await coach.chat("mode-session", "hi", mode, problem_id)

    system = model.calls[0]["messages"][0].get_text_content()
    assert expected in system
    assert "高于历史对话和记忆" in system
    assert "如果用户只是问候或闲聊，先自然回应这条消息" in system


async def test_greeting_does_not_trigger_unsolicited_training_prompt(tmp_path):
    coach, model, _reme = _make_coach(tmp_path)

    await coach.chat("greeting-session", "hi", "PREP", "two-sum")

    system = model.calls[0]["messages"][0].get_text_content()
    assert "如果用户只是问候或闲聊，先自然回应这条消息" in system
    assert "不要擅自转成训练、代码复盘或换题引导" in system


async def test_non_leetcode_problem_uses_its_own_platform(tmp_path, monkeypatch):
    coach, model, _reme = _make_coach(tmp_path, responses=[
        _tool_call("fetch_problem_meta", {"slug": "1000"}),
    ])

    calls = []

    async def fetch(slug, platform):
        calls.append((slug, platform))
        return {"ok": True, "title": "HDU problem", "content": "statement"}

    monkeypatch.setattr(coach, "_fetch_problem_meta", fetch)
    await coach.chat("hdu-session", "讲讲这道题", "PREP", "1000", platform="HDU")
    system = model.calls[0]["messages"][0].get_text_content()
    assert "当前题目平台=HDU；题目标识=1000" in system
    assert calls == [("1000", "HDU")]


async def test_problem_metadata_cache_is_separate_per_platform(tmp_path, monkeypatch):
    from app.agent import coach as coach_module

    instance, _model, _reme = _make_coach(tmp_path)
    calls = []

    async def fetch(slug, platform="LEETCODE"):
        calls.append((slug, platform))
        return {"problem_id": slug, "title": platform, "content": "statement", "topics": []}

    async def no_index(_problem):
        pass

    monkeypatch.setattr(coach_module, "fetch_problem", fetch)
    monkeypatch.setattr(instance, "_index_problem_best_effort", no_index)
    assert (await instance._fetch_problem_meta("1000"))["title"] == "LEETCODE"
    assert (await instance._fetch_problem_meta("1000", "HDU"))["title"] == "HDU"
    assert (await instance._fetch_problem_meta("1000", "HDU"))["title"] == "HDU"
    assert calls == [("1000", "LEETCODE"), ("1000", "HDU")]


async def test_chat_executes_animation_tool_and_returns_job_id(tmp_path, monkeypatch):
    coach, model, _reme = _make_coach(
        tmp_path,
        responses=[
            _tool_call(
                "request_animation",
                {
                    "type": "PRE_EXPLAIN",
                    "topic": "BFS",
                    "title": "BFS 入门",
                    "problem_id": "bfs-1",
                },
            ),
        ],
    )

    captured = {}

    async def fake_enqueue(**kwargs):
        captured.update(kwargs)
        return type("Job", (), {"id": "job-42", "status": "QUEUED"})()

    monkeypatch.setattr(animation_service, "enqueue", fake_enqueue)

    result = await coach.chat("s1", "讲讲 BFS", "PREP", "bfs-1")

    assert result == {"content": "好的", "animation_id": "job-42"}
    assert captured == {
        "kind": "PRE_EXPLAIN",
        "topic": "BFS",
        "title": "BFS 入门",
        "problem_id": "bfs-1",
    }
    # Two model calls: one tool request, one final answer.
    assert len(model.calls) == 2


async def test_active_problem_id_reaches_tool_through_agent(tmp_path, monkeypatch):
    """The per-turn problem id must survive AgentScope's tool execution."""
    coach, _model, _reme = _make_coach(
        tmp_path,
        responses=[
            _tool_call("fetch_problem_meta", {"slug": ""}),
            _text("好的"),
        ],
    )
    calls: list[str] = []

    async def fake_fetch(slug):
        calls.append(slug)
        return {
            "problem_id": slug,
            "title": "Two Sum",
            "difficulty": "EASY",
            "topics": ["Array"],
            "content": "statement",
        }

    async def no_index(_problem):
        return None

    monkeypatch.setattr(coach_module, "fetch_problem", fake_fetch)
    monkeypatch.setattr(coach, "_index_problem_best_effort", no_index)

    result = await coach.chat("s1", "看看这题", "PREP", "two-sum")

    assert result["content"] == "好的"
    assert calls == ["two-sum"]


async def test_reme_writes_back_the_completed_exchange_with_session_id(tmp_path):
    coach, _model, reme = _make_coach(tmp_path)

    await coach.chat("stable-session", "我住在杭州", "PREP")

    auto = [kwargs for name, kwargs in reme.jobs if name == "auto_memory"]
    assert len(auto) == 1
    assert auto[0]["session_id"] == "stable-session"
    roles = [message["role"] for message in auto[0]["messages"]]
    assert "user" in roles
    assert "assistant" in roles
    text = " ".join(
        block.get("text", "")
        for message in auto[0]["messages"]
        for block in message.get("content", [])
        if isinstance(block, dict)
    )
    assert "我住在杭州" in text


async def test_reme_search_runs_and_memories_are_injected(tmp_path):
    # The first tool call forces a second reasoning round, so the background
    # retrieval is guaranteed to have completed before the second model call.
    coach, model, reme = _make_coach(
        tmp_path,
        responses=[
            _tool_call("get_weakness_topics", {}),
            _text("好的"),
        ],
        search_results=["用户住在杭州，偏好简洁回答"],
    )

    await coach.chat("s1", "还记不记得我住哪", "PREP")

    searches = [kwargs for name, kwargs in reme.jobs if name == "search"]
    assert searches and searches[0]["query"] == "还记不记得我住哪"

    second_call_messages = model.calls[1]["messages"]
    hints = [
        block.hint
        for message in second_call_messages
        for block in message.content
        if getattr(block, "type", None) == "hint"
    ]
    assert any("用户住在杭州" in hint for hint in hints)


async def test_same_session_reuses_agent_and_keeps_context(tmp_path):
    coach, model, _ = _make_coach(tmp_path)

    await coach.chat("s1", "第一轮", "PREP")
    silent = await coach.chat("s1", "FOCUS 中的消息不应进入上下文", "FOCUS")
    await coach.chat("s1", "第二轮", "REVIEW")

    assert silent == {"content": "", "animation_id": None}
    assert set(coach._agents) == {"s1"}
    assert len(model.calls) == 2
    # The second model call sees the first user turn from AgentState.
    second_texts = [
        message.get_text_content() or ""
        for message in model.calls[1]["messages"]
    ]
    assert any("第一轮" in text for text in second_texts)
    assert not any("FOCUS 中的消息不应进入上下文" in text for text in second_texts)
    assert any("模式=REVIEW" in text for text in second_texts)


async def test_distinct_sessions_get_distinct_agents_and_write_scopes(tmp_path):
    coach, _, reme = _make_coach(tmp_path)

    await coach.chat("a", "A 的对话", "PREP")
    await coach.chat("b", "B 的对话", "PREP")

    assert set(coach._agents) == {"a", "b"}
    assert coach._agents["a"].state.session_id == "a"
    assert coach._agents["b"].state.session_id == "b"
    written_sessions = [
        kwargs["session_id"]
        for name, kwargs in reme.jobs
        if name == "auto_memory"
    ]
    assert written_sessions == ["a", "b"]


async def test_close_closes_embedded_reme_once(tmp_path):
    coach, _, reme = _make_coach(tmp_path)
    await coach.chat("s1", "hi", "PREP")

    await coach.close()
    await coach.close()

    assert reme.close_count == 1
    assert coach._agents == {}


async def test_real_reme_middleware_starts_and_closes(tmp_path):
    """Exercise the embedded ReMe app with the pinned reme-ai version."""
    from agentscope.middleware import ReMeMiddleware

    middleware = ReMeMiddleware(
        workspace_dir=str(tmp_path / "reme"),
        parameters=ReMeMiddleware.Parameters(
            chat_model=FakeChatModel(),
            mode="static_control",
        ),
    )
    try:
        await middleware._ensure_started()
        assert middleware._started is True
        assert middleware._app is not None
        assert (tmp_path / "reme").is_dir()
    finally:
        await middleware.close()

    assert middleware._started is False


class ReMeWriteModel(FakeChatModel):
    """Fake model that lets ReMe's real ``auto_memory`` write a daily card."""

    async def _call_api(
        self,
        model_name,
        messages,
        tools=None,
        tool_choice=None,
        **kwargs,
    ):
        tool_names = [
            item.get("function", {}).get("name") for item in (tools or [])
        ]
        has_tool_result = any(
            getattr(block, "type", None) == "tool_result"
            for message in messages
            for block in message.content
        )
        if "daily_write" in tool_names and not has_tool_result:
            return ChatResponse(
                content=[
                    ToolCallBlock(
                        id="reme-write-1",
                        name="daily_write",
                        input=json.dumps(
                            {
                                "name": "hangzhou-residence",
                                "description": "用户住在杭州，并偏好简洁的中文回答。",
                                "session_id": "reme-e2e",
                                "content": "- 用户住在杭州。\n- 用户偏好简洁的中文回答。",
                            },
                            ensure_ascii=False,
                        ),
                    )
                ],
                is_last=True,
            )
        return _text("已记录")


async def test_real_reme_auto_memory_write_and_search(tmp_path):
    """End-to-end: ReMe auto_memory writes a card, reindex makes it searchable."""
    from agentscope.message import UserMsg
    from agentscope.middleware import ReMeMiddleware

    middleware = ReMeMiddleware(
        workspace_dir=str(tmp_path / "reme"),
        parameters=ReMeMiddleware.Parameters(
            chat_model=ReMeWriteModel(),
            mode="static_control",
        ),
    )
    try:
        await middleware._ensure_started()
        user = UserMsg(name="user", content="我住在杭州，以后回答简洁点")
        write = await middleware._run_job(
            "auto_memory",
            messages=[user.model_dump(mode="json")],
            session_id="reme-e2e",
        )
        assert write.success is True
        assert write.metadata.get("modified") is True

        notes = list((tmp_path / "reme").rglob("*.md"))
        assert any("hangzhou-residence" in note.name for note in notes)

        reindex = await middleware._run_job("reindex")
        assert reindex.success is True
        search = await middleware._run_job("search", query="杭州")
        assert search.success is True
        results = search.metadata.get("results") or []
        assert any("杭州" in (item.get("text") or "") for item in results)
    finally:
        await middleware.close()


async def test_app_lifespan_closes_coach(monkeypatch):
    from app import main as main_module

    class CloseSpy:
        def __init__(self):
            self.closed = 0

        async def close(self):
            self.closed += 1

    spy = CloseSpy()
    monkeypatch.setattr(main_module, "coach", spy)

    async with main_module.lifespan(main_module.app):
        pass

    assert spy.closed == 1
