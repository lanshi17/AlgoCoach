"""Pure unit tests for the centralized system prompts.

No model, gateway, database or vector store is touched here. The base Soul is
pinned verbatim so a refactor cannot silently change FOCUS silence, the PREP /
REVIEW tool guidance, the Chinese style or the ``{memory_context}`` slot.
"""

import json

import pytest
from conftest import FakeChatModel, RecordingReMe

from app.agent import coach as coach_module
from app.agent.coach import AlgoCoach
from app.agent.prompts import (
    DEFAULT_GOAL,
    GOAL_GUIDANCE,
    SOUL,
    UserGoal,
    get_system_prompt,
    resolve_goal,
)

# Verbatim copy of the Soul that used to live in coach.py. This is a regression
# pin, not a second source of truth: prompt changes must update it explicitly.
BASE_SOUL = """你是 AlgoCoach，一个个性化算法刷题教练。

你的核心原则：
1. 做题前（PREP）：主动讲解题目涉及的知识点，调用 request_animation 生成可视化动画，帮助用户建立直觉理解；需要题目原文时调用 fetch_problem_meta
2. 做题中（FOCUS）：绝对不主动发言，不给任何提示——用户正在专注解题
3. 做题后（REVIEW）：分析用户解法的优缺点，对比最优解，调用 record_sticking_points 更新记忆，调用 get_similar_problems 推荐相关练习
4. 其他时候：通过 get_weakness_topics 了解用户弱点；需要给出“下一题”建议时调用 suggest_next_problem（自动记录，7 天后回测效果）

你拥有长期记忆。题目原文只需要抓取一次，后续复用记忆中的结果，不要每轮重复抓取：
{memory_context}

检索到本地算法笔记或历史题解时，用它们核对适用模型、边界和实现经验，并说明迁移条件；历史代码只作参考，不能越过当前训练阶段的提示限制或直接照搬完整代码。

教学原则：你是助教式教练，帮助用户形成自己的理解，不替用户完成任务。先问清用户尝试了什么、预期是什么、实际发生了什么，再解释原因并给出下一步检查；优先使用问题、反例、不变量、断言、极小测试和 profiling 引导推理。不要直接给最终答案、完整可提交代码、整段伪代码或填充 TODO；用户要求代写时明确拒绝，并转向不可直接粘贴的思路、调试方向和验证标准。审查用户代码时指出具体风险、边界和改进位置，但不要把整段代码重写成成品；需要外部资料时优先引用课程材料、官方文档和工具说明，不指向第三方作业答案。

风格：简练、有洞察力，不废话。用中文回复。针对用户的具体弱点给出个性化建议，而不是泛泛而谈。
当介绍新知识点时，优先通过动画可视化而不只是文字描述。"""


def test_default_prompt_is_the_base_soul_verbatim():
    assert SOUL == BASE_SOUL
    assert get_system_prompt() == BASE_SOUL
    assert get_system_prompt(DEFAULT_GOAL) == BASE_SOUL
    # The caller still renders the memory snapshot into the same placeholder.
    rendered = SOUL.format(memory_context='{"weak": []}')
    assert '{"weak": []}' in rendered


def test_disabled_animations_remove_only_the_animation_guidance():
    prompt = get_system_prompt(animations=False)
    assert "request_animation" not in prompt
    assert "动画可视化" not in prompt
    # Everything else is untouched: mode rules, other tools, memory slot.
    assert "fetch_problem_meta" in prompt
    assert "绝对不主动发言" in prompt
    assert "record_sticking_points" in prompt
    assert "{memory_context}" in prompt
    # Opting in restores the base Soul verbatim.
    assert get_system_prompt(animations=True) == BASE_SOUL
    # Goal variants inherit the same stripping.
    assert "request_animation" not in get_system_prompt(
        UserGoal.CONTEST, animations=False
    )


def test_coach_style_appends_its_guidance():
    socratic = get_system_prompt(coach_style="socratic")
    direct = get_system_prompt(coach_style="direct")
    assert "先反问" in socratic
    assert "直接给出结论" in direct
    # Auto keeps the base Soul; invalid styles are rejected.
    assert get_system_prompt(coach_style="auto") == BASE_SOUL
    with pytest.raises(ValueError):
        get_system_prompt(coach_style="wild")
    assert get_system_prompt(coach_style=None) == BASE_SOUL


def test_default_prompt_keeps_mode_and_style_rules():
    prompt = get_system_prompt()
    assert "PREP" in prompt and "request_animation" in prompt
    assert "FOCUS" in prompt and "绝对不主动发言" in prompt
    assert "REVIEW" in prompt and "record_sticking_points" in prompt
    assert "get_similar_problems" in prompt
    assert "用中文回复" in prompt
    assert "不替用户完成任务" in prompt
    assert "不要直接给最终答案" in prompt
    assert "profiling" in prompt


def test_each_goal_selects_its_own_variant():
    for goal in UserGoal:
        prompt = get_system_prompt(goal)
        # Variants extend the untouched base instead of rewriting it.
        assert prompt.startswith(BASE_SOUL)
        assert GOAL_GUIDANCE[goal] in prompt
        assert prompt != BASE_SOUL
        # The appended emphasis must not weaken FOCUS silence or tool guidance.
        assert "FOCUS" in prompt
        assert "绝对不主动发言" in prompt

    variants = {goal: get_system_prompt(goal) for goal in UserGoal}
    assert len(set(variants.values())) == len(UserGoal)


def test_goal_guidance_matches_the_requested_emphasis():
    interview = get_system_prompt(UserGoal.INTERVIEW_PREP)
    contest = get_system_prompt(UserGoal.CONTEST)
    casual = get_system_prompt(UserGoal.CASUAL)

    assert "复杂度" in interview and "边界条件" in interview
    assert "约束" in contest and "证明" in contest and "复杂度" in contest
    assert "逐步" in casual and "小例子" in casual

    # No variant leaks another goal's distinctive paragraph.
    assert GOAL_GUIDANCE[UserGoal.CONTEST] not in interview
    assert GOAL_GUIDANCE[UserGoal.INTERVIEW_PREP] not in contest
    assert GOAL_GUIDANCE[UserGoal.CASUAL] not in interview


def test_missing_goal_uses_the_base_soul():
    assert resolve_goal(None) is None
    assert get_system_prompt(None) == BASE_SOUL


@pytest.mark.parametrize("goal", ["", "unknown_goal", "interview-prep", "Interview_Prep", 42])
def test_unknown_goal_is_rejected(goal):
    with pytest.raises(ValueError):
        resolve_goal(goal)
    with pytest.raises(ValueError):
        get_system_prompt(goal)


def test_known_goal_strings_resolve_to_enum_members():
    assert resolve_goal("interview_prep") is UserGoal.INTERVIEW_PREP
    assert resolve_goal("contest") is UserGoal.CONTEST
    assert resolve_goal("casual") is UserGoal.CASUAL
    assert resolve_goal(UserGoal.CASUAL) is UserGoal.CASUAL


@pytest.mark.asyncio
async def test_focus_mode_never_calls_model_or_tools(tmp_path, monkeypatch):
    """FOCUS must return before the agent, memory and every tool."""

    async def explode(*args, **kwargs):
        raise AssertionError("memory/tools must not be called in FOCUS")

    model = FakeChatModel()
    reme = RecordingReMe(str(tmp_path / "reme"))
    agent = AlgoCoach(
        chat_model=model,
        reme_middleware=reme,
    )
    monkeypatch.setattr(coach_module.memory, "build_context_snapshot", explode)

    result = await agent.chat("focus-session", "help", "FOCUS", "two-sum")

    assert result == {"content": "", "animation_id": None}
    assert model.calls == []
    assert reme.start_count == 0
    assert reme.jobs == []


@pytest.mark.asyncio
async def test_chat_sends_the_default_soul_to_the_model(tmp_path, monkeypatch):
    """The agent still renders domain memory into the default Soul template."""

    async def fake_snapshot():
        return {"weak_topics": ["DP"]}

    model = FakeChatModel()
    reme = RecordingReMe(str(tmp_path / "reme"))
    agent = AlgoCoach(
        chat_model=model,
        reme_middleware=reme,
    )
    monkeypatch.setattr(coach_module.memory, "build_context_snapshot", fake_snapshot)

    result = await agent.chat("prep-session", "讲讲 DP", "PREP")

    assert result == {"content": "好的", "animation_id": None}
    assert len(model.calls) == 1
    system = model.calls[0]["messages"][0].get_text_content()
    expected = get_system_prompt(DEFAULT_GOAL).format(
        memory_context=json.dumps({"weak_topics": ["DP"]}, ensure_ascii=False, indent=2)
    )
    assert system.startswith(expected)
    assert system.startswith(BASE_SOUL.split("{memory_context}")[0])
    # ReMe's "both" mode appends its memory_search instructions after the Soul.
    assert "memory_search" in system
