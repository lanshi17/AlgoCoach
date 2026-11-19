"""Centralised system prompts for AlgoCoach.

The base Soul used to live inline in ``coach.py``. It now lives here so prompt
text has one owner and goal-specific variants can be selected without touching
the agent loop. :func:`get_system_prompt` always starts from the original Soul
verbatim, so FOCUS silence, PREP/REVIEW tool guidance, the Chinese style rules
and the ``{memory_context}`` placeholder are preserved for every variant.

Goal variants only *append* a short, bounded coaching emphasis. They must never
relax the base safety/behaviour rules — in particular FOCUS remains silent.

Contest training uses the OI / xCPC protocol: a per-request ``trainingPhase``
(virtual_contest / topic_drill / attempt / hint / review / upsolve) selects the
coaching stance, and an optional remaining-time budget drives the pacing
reminder. Phase guidance is only appended for :attr:`UserGoal.CONTEST`; other
goals and the default (no goal) Soul are byte-for-byte unchanged.

This module deliberately contains no persistence: the user's saved goal (DB
column or settings UI) and any training session table are out of scope.
"""

from enum import Enum


class UserGoal(str, Enum):
    """Supported learner goals for prompt variants."""

    INTERVIEW_PREP = "interview_prep"
    CONTEST = "contest"
    CASUAL = "casual"


class TrainingPhase(str, Enum):
    """OI / xCPC training stance carried by one ``POST /chat/stream`` request.

    ``AUTO`` is the phase-neutral default for ordinary coaching turns.
    """

    AUTO = "auto"
    VIRTUAL_CONTEST = "virtual_contest"
    TOPIC_DRILL = "topic_drill"
    ATTEMPT = "attempt"
    HINT = "hint"
    REVIEW = "review"
    UPSOLVE = "upsolve"


class DeepTutorCapability(str, Enum):
    """Bounded capability registry carried by each durable turn."""

    CHAT = "chat"
    DEEP_SOLVE = "deep_solve"
    PRACTICE = "practice"
    MASTERY_PATH = "mastery_path"
    REVIEW = "review"


DEFAULT_TRAINING_PHASE = TrainingPhase.AUTO
DEFAULT_CAPABILITY = DeepTutorCapability.CHAT

# Marker for the per-request training context that is prepended to the
# AgentScope user message (and therefore written into ReMe memory).
TRAINING_CONTEXT_MARKER = "[竞赛训练上下文]"


# Default goal for ordinary chat. ``AlgoCoach.chat`` switches to
# ``UserGoal.CONTEST`` when a request carries a training phase or a remaining
# time budget; ``None`` means "no variant guidance".
DEFAULT_GOAL: UserGoal | None = None

# Original AlgoCoach Soul, moved verbatim from ``coach.py``. Keep the exact
# wording and the ``{memory_context}`` placeholder: existing behaviour depends
# on both, and every goal variant below is built on top of this text.
SOUL = """你是 AlgoCoach，一个个性化算法刷题教练。

你的核心原则：
1. 做题前（PREP）：主动讲解题目涉及的知识点，调用 request_animation 生成可视化动画，帮助用户建立直觉理解；需要题目原文时调用 fetch_problem_meta
2. 做题中（FOCUS）：绝对不主动发言，不给任何提示——用户正在专注解题
3. 做题后（REVIEW）：分析用户解法的优缺点，对比最优解，调用 record_sticking_points 更新记忆，调用 get_similar_problems 推荐相关练习
4. 其他时候：通过 get_weakness_topics 了解用户弱点；需要给出“下一题”建议时调用 suggest_next_problem（自动记录，7 天后回测效果）

你拥有长期记忆。题目原文只需要抓取一次，后续复用记忆中的结果，不要每轮重复抓取：
{memory_context}

检索到本地算法笔记或历史题解时，用它们核对适用模型、边界和实现经验，并说明迁移条件；当问题涉及用户上传的课程资料或笔记时，先调用 search_learning_sources；使用命中的片段时在回答中用【资料：文件名】标注来源，没有命中时不要伪造引用。历史代码只作参考，不能越过当前训练阶段的提示限制或直接照搬完整代码。

教学原则：你是助教式教练，帮助用户形成自己的理解，不替用户完成任务。先问清用户尝试了什么、预期是什么、实际发生了什么，再解释原因并给出下一步检查；优先使用问题、反例、不变量、断言、极小测试和 profiling 引导推理。不要直接给最终答案、完整可提交代码、整段伪代码或填充 TODO；用户要求代写时明确拒绝，并转向不可直接粘贴的思路、调试方向和验证标准。审查用户代码时指出具体风险、边界和改进位置，但不要把整段代码重写成成品；需要外部资料时优先引用课程材料、官方文档和工具说明，不指向第三方作业答案。

风格：简练、有洞察力，不废话。用中文回复。针对用户的具体弱点给出个性化建议，而不是泛泛而谈。
当介绍新知识点时，优先通过动画可视化而不只是文字描述。"""


# Real OI / xCPC training protocol. It is appended to the contest goal only, so
# interview/casual coaching and the default Soul keep their own text.
CONTEST_PROTOCOL = """竞赛训练协议（OI / xCPC 赛制）：
- 读题：先完整读题再动笔，复述输入输出、数据范围、时间与内存限制、取模和多测要求；不确定的地方先标记，不要凭印象猜。
- 分类：判断题型与经典模型（贪心、DP、图论、数据结构、数学、构造、搜索、字符串等），并说明本题与模板题的差异。
- 约束推导：从数据范围和时限反推可接受的复杂度（例如 n <= 2e5 通常需要 O(n log n) 或更好），并估算常数是否够用。
- 部分得分：先写出能过小数据的暴力或正确版本拿部分分，再考虑优化；不要为了追求正解而交白卷。
- 赛后补题：赛后 24 小时内补题（upsolve），独立重做没做出的题，记录卡点、错误假设与正确思路，再归纳同类模型。
- 正确性优先：先给出可证明正确的方案与关键不变量，再写代码；接受前自行构造边界和反例。"""

# Per-phase stance for contest training. Keys mirror the wire enum values;
# ``AUTO`` has no entry because it adds no phase guidance.
PHASE_GUIDANCE: dict[TrainingPhase, str] = {
    TrainingPhase.VIRTUAL_CONTEST: (
        "当前训练阶段是模拟赛（virtual_contest）。只做读题、约束与计分策略："
        "给出题目理解、数据范围推导、复杂度目标、每道题的部分分安排和开题顺序；"
        "不要给算法细节、代码或题解，把思考留给用户。"
    ),
    TrainingPhase.TOPIC_DRILL: (
        "当前训练阶段是专题训练（topic_drill）。围绕同一模型做变式："
        "先给一个最小可迁移的模型或关键不变量，再让用户独立实现；"
        "用变式题检验迁移，而不是重复讲解同一道题。"
    ),
    TrainingPhase.ATTEMPT: (
        "当前训练阶段是独立作答（attempt）。禁止直接给出答案、完整代码、"
        "状态转移方程或最终结论；只回答题意澄清和评测细节。"
        "用户卡住时，提示其切换到 hint 阶段。"
    ),
    TrainingPhase.HINT: (
        "当前训练阶段是逐级提示（hint）。严格按 概念 → 不变量/关键性质 → "
        "伪代码骨架 → 边界与实现细节 逐级升级：先只给最弱的一层，"
        "用户仍未突破再升一级；每轮只给当前这一层，不要直接跳到完整答案。"
    ),
    TrainingPhase.REVIEW: (
        "当前训练阶段是赛后复盘（review）。必须覆盖四件事："
        "1) 建模：把题目抽象成什么模型、为什么；"
        "2) 证明/不变量：给出正确性证明或关键不变量；"
        "3) 复杂度：时间、空间与常数是否满足约束；"
        "4) 反例：用户解法在什么输入下会错。"
        "若用户没有提供提交代码，不得推断其具体实现或声称已检查代码；"
        "只基于题目、判题状态、耗时与历史记录分析，并请用户先贴关键代码和自己的诊断，"
        "再定位实现错误。然后用 record_sticking_points 记录已确认的卡点。"
    ),
    TrainingPhase.UPSOLVE: (
        "当前训练阶段是赛后补题（upsolve）。让用户先独立重做，不直接给答案；"
        "完成后对照正解逐行找出偏差，记录卡点属于建模、复杂度、实现还是细节，"
        "再用 suggest_next_problem 安排同模型的变式题。"
    ),
}


# Each entry is a small, evidence-based emphasis appended to the base Soul.
# They intentionally do not repeat or override the mode rules: FOCUS silence
# and the existing tool guidance apply unchanged to every goal.
GOAL_GUIDANCE: dict[UserGoal, str] = {
    UserGoal.INTERVIEW_PREP: (
        "用户目标是准备技术面试。在讲解与复盘时额外侧重："
        "明确给出时间与空间复杂度，并主动论证边界条件（空输入、重复元素、"
        "整数溢出、极端规模）是否被覆盖；用面试官会追问的方式说明方案权衡，"
        "以及为什么当前解法优于或劣于替代方案。"
    ),
    UserGoal.CONTEST: (
        "用户目标是参加算法竞赛，按真实 OI / xCPC 赛制训练。\n"
        f"{CONTEST_PROTOCOL}"
    ),
    UserGoal.CASUAL: (
        "用户目标是日常学习算法。在讲解与复盘时额外侧重："
        "把思路拆成可以逐步理解的小步骤，先用一个具体的小例子建立直觉；"
        "用户卡住时优先给提示和引导，而不是直接抛出完整答案；"
        "鼓励用户自己复述关键步骤来确认理解。"
    ),
}

CAPABILITY_GUIDANCE: dict[DeepTutorCapability, str] = {
    DeepTutorCapability.DEEP_SOLVE: (
        "当前能力是 deep_solve：把复杂问题拆成模型、关键不变量、正确性证明、"
        "复杂度和可验证的反例；先给推理路径，再决定是否需要工具。"
    ),
    DeepTutorCapability.PRACTICE: (
        "当前能力是 practice：围绕一次练习记录和当前目标推进，优先提出最小可验证步骤；"
        "FOCUS 仍必须完全静默，不主动给提示。"
    ),
    DeepTutorCapability.MASTERY_PATH: (
        "当前能力是 mastery_path：结合弱点主题、前置关系和最近练习，给出下一步可执行的"
        "学习路径；先调用 get_mastery_path 获取有序步骤，再区分已有证据与待验证的掌握度，"
        "不要把相关知识点未经证据当成硬性前置关系。"
    ),
    DeepTutorCapability.REVIEW: (
        "当前能力是 review：只基于判题事实、当前代码和训练记录复盘，分别标记已确认的 bug、"
        "边界风险、复杂度问题和下一道练习。"
    ),
}


def resolve_goal(goal: object) -> UserGoal | None:
    """Return the matching :class:`UserGoal`; ``None`` selects the base Soul."""
    if isinstance(goal, UserGoal):
        return goal
    if goal is None:
        return None
    try:
        return UserGoal(str(goal).strip())
    except ValueError as exc:
        raise ValueError(f"unsupported coaching goal: {goal!r}") from exc


def resolve_capability(capability: object) -> DeepTutorCapability:
    """Return a registered capability or reject an unknown one."""
    if isinstance(capability, DeepTutorCapability):
        return capability
    if capability is None:
        return DEFAULT_CAPABILITY
    try:
        return DeepTutorCapability(str(capability).strip().lower())
    except ValueError as exc:
        raise ValueError(f"unsupported capability: {capability!r}") from exc


def resolve_training_phase(
    phase: object,
) -> TrainingPhase:
    """Return the matching :class:`TrainingPhase` or raise for invalid input."""
    if isinstance(phase, TrainingPhase):
        return phase
    if phase is None:
        return TrainingPhase.AUTO
    try:
        return TrainingPhase(str(phase).strip().lower())
    except ValueError as exc:
        raise ValueError(f"unsupported training phase: {phase!r}") from exc


def is_contest_context(
    training_phase: str | TrainingPhase | None = DEFAULT_TRAINING_PHASE,
    time_remaining_sec: int | None = None,
) -> bool:
    """Whether this request asks for the contest training protocol.

    An explicit phase or a remaining-time budget is contest context; the
    default ``AUTO`` without a budget keeps the pre-existing default Soul.
    """
    return (
        resolve_training_phase(training_phase) is not TrainingPhase.AUTO
        or time_remaining_sec is not None
    )


def time_remaining_note(time_remaining_sec: int | None) -> str:
    """Render a deterministic pacing reminder for the remaining budget.

    The text only depends on the request value (never the wall clock), so the
    prompt and its tests stay reproducible. ``None`` returns an empty string.
    """
    if time_remaining_sec is None:
        return ""
    seconds = max(0, int(time_remaining_sec))
    minutes, secs = divmod(seconds, 60)
    hours, minutes = divmod(minutes, 60)
    readable = (
        f"{hours} 小时 {minutes} 分" if hours else f"{minutes} 分 {secs} 秒"
    )
    if seconds <= 5 * 60:
        pacing = (
            "最后 5 分钟：停止重构和优化，先保证能编译提交，优先保住部分分，"
            "并检查边界、空输入和多测。"
        )
    elif seconds <= 15 * 60:
        pacing = (
            "剩余不足 15 分钟：先写出正确的暴力或部分分版本并自测，"
            "再决定是否继续优化。"
        )
    elif seconds <= 45 * 60:
        pacing = (
            "按分值与剩余时间安排开题顺序，先拿稳定的部分分，"
            "给实现和对拍调试留出至少一半时间。"
        )
    else:
        pacing = (
            "时间充足：先读完全部题再排开题顺序，"
            "为每道题预留实现与对拍调试时间。"
        )
    return f"当前剩余时间：约 {readable}。{pacing}"


def build_training_context(
    training_phase: str | TrainingPhase | None = DEFAULT_TRAINING_PHASE,
    time_remaining_sec: int | None = None,
) -> str:
    """Build the per-request context line prepended to the user message.

    The line is part of the AgentScope ``UserMsg`` (so ``AgentState`` and the
    ReMe auto-memory write-back both contain the phase), which is why it must
    stay short and deterministic. ``AUTO`` with no budget returns ``""``.
    """
    phase = resolve_training_phase(training_phase)
    if phase is TrainingPhase.AUTO and time_remaining_sec is None:
        return ""
    parts = [f"训练阶段={phase.value}"]
    if time_remaining_sec is not None:
        parts.append(f"剩余时间={max(0, int(time_remaining_sec))} 秒")
    return f"{TRAINING_CONTEXT_MARKER} " + "；".join(parts)


# Removed from the Soul when the Remotion animation feature is disabled, so the
# model is never told to call a tool that is not registered.
ANIMATION_PREP_CLAUSE = "，调用 request_animation 生成可视化动画"
ANIMATION_STYLE_LINE = "\n当介绍新知识点时，优先通过动画可视化而不只是文字描述。"


def _without_animation_guidance(prompt: str) -> str:
    return prompt.replace(ANIMATION_PREP_CLAUSE, "").removesuffix(ANIMATION_STYLE_LINE)


DEFAULT_COACH_STYLE = "auto"
COACH_STYLES: tuple[str, ...] = ("auto", "socratic", "direct")
COACH_STYLE_GUIDANCE = {
    "socratic": "教学风格：先反问与拆解，让用户自己走到关键不变量；只在卡住时给最小必要提示。",
    "direct": "教学风格：直接给出结论、复杂度与可执行步骤，再说明为什么成立。",
}


def resolve_coach_style(value: object) -> str:
    """Validate a requested coaching style."""
    if value is None:
        return DEFAULT_COACH_STYLE
    normalized = str(value).strip().lower()
    if normalized == DEFAULT_COACH_STYLE or normalized in COACH_STYLE_GUIDANCE:
        return normalized
    raise ValueError(f"unsupported coaching style: {value!r}")


def get_system_prompt(
    goal: str | UserGoal | None = DEFAULT_GOAL,
    *,
    training_phase: str | TrainingPhase | None = DEFAULT_TRAINING_PHASE,
    time_remaining_sec: int | None = None,
    animations: bool = True,
    coach_style: str = DEFAULT_COACH_STYLE,
    capability: str | DeepTutorCapability = DEFAULT_CAPABILITY,
) -> str:
    """Build the Soul template for ``goal`` and the contest ``training_phase``.

    The returned string still contains the ``{memory_context}`` placeholder and
    is formatted by the caller. ``None`` returns the original Soul unchanged.
    Contest adds the OI / xCPC protocol, plus the phase stance
    and remaining-time reminder when the request provides them. Other goals
    ignore both training fields entirely.
    """
    resolved = resolve_goal(goal)
    resolved_capability = resolve_capability(capability)
    style_note = COACH_STYLE_GUIDANCE.get(resolve_coach_style(coach_style))
    parts = [SOUL if animations else _without_animation_guidance(SOUL)]
    if style_note:
        parts.append(style_note)
    if resolved_capability is not DEFAULT_CAPABILITY:
        parts.append(CAPABILITY_GUIDANCE[resolved_capability])
    if resolved is None:
        return "\n\n".join(parts)
    parts.append(GOAL_GUIDANCE[resolved])
    if resolved is UserGoal.CONTEST:
        phase = resolve_training_phase(training_phase)
        if phase is not TrainingPhase.AUTO:
            parts.append(PHASE_GUIDANCE[phase])
        note = time_remaining_note(time_remaining_sec)
        if note:
            parts.append(note)
    return "\n\n".join(parts)
