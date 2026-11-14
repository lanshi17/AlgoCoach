"""
AlgoCoach — the /chat agent runtime.

The old hand-written Claude tool loop and its in-process ``_sessions``
conversation cache have been replaced by AgentScope 2.0.11:

* :class:`agentscope.agent.Agent` owns the reasoning/acting loop, the model and
  the conversation state (``AgentState``), addressed by a stable session id.
* The official :class:`agentscope.middleware.ReMeMiddleware` embeds ReMe
  in-process as the long-term conversation memory. It automatically retrieves
  relevant memories before a reply and writes each completed exchange back
  after it; there is no manual memory add tool.

The coach-specific tool surface (weak topics, animations, problem metadata,
similar problems, next-problem suggestions) is unchanged from the model's
point of view: the same JSON schemas and descriptions are wrapped as
AgentScope ``FunctionTool`` objects. FOCUS mode still returns before the model,
the memory and every tool are touched.

Tools:
  - get_weakness_topics     : query memory for user weak points
  - request_animation       : trigger Remotion render job
  - record_sticking_points  : write post-review learnings to episodic memory
  - fetch_problem_meta      : fetch a problem statement from the gateway, index it
  - get_similar_problems    : search local vector memory for similar problems
  - suggest_next_problem    : recommend next problem based on weak topics
"""
import asyncio
import hashlib
import json
import logging
import os
from contextvars import ContextVar
from typing import Any

from agentscope.agent import Agent
from agentscope.credential import (
    AnthropicCredential,
    DashScopeCredential,
    DeepSeekCredential,
    MiniMaxCredential,
    MoonshotCredential,
    OpenAICredential,
    VolcengineCredential,
    XAICredential,
)
from agentscope.message import UserMsg
from agentscope.middleware import ReMeMiddleware
from agentscope.model import (
    AnthropicChatModel,
    DashScopeChatModel,
    DeepSeekChatModel,
    MiniMaxChatModel,
    MoonshotChatModel,
    OpenAIChatModel,
    ChatModelBase,
    VolcengineChatModel,
    XAIChatModel,
)
from agentscope.permission import PermissionBehavior, PermissionDecision
from agentscope.state import AgentState
from agentscope.tool import FunctionTool, Toolkit
from pydantic import SecretStr

from app.agent.gateway import fetch_problem
from app.agent.prompts import (  # noqa: F401
    DEFAULT_GOAL,
    DEFAULT_TRAINING_PHASE,
    SOUL,
    TrainingPhase,
    UserGoal,
    build_training_context,
    get_system_prompt,
    is_contest_context,
    resolve_goal,
    resolve_training_phase,
)
from app.agent.self_improve import MAX_RECOMMENDATIONS, suggest_next_problem
from app.config import (
    anthropic_base_url,
    claude_model,
    reme_workspace_dir,
)
from app.memory.memory_service import memory
from app.memory.vector_store import (
    VectorStoreError,
    VectorStoreUnavailable,
    vector_store,
)
from app.remotion.animation_service import animation_service

logger = logging.getLogger(__name__)

# A tool call cannot ask for more than this many similar problems, regardless
# of what the model sends. The vector store enforces its own, higher ceiling.
MAX_SIMILAR_RESULTS = 5
# Successful problem metadata is cached per process so consecutive chat turns
# never re-fetch (and re-index) the same problem from the gateway.
MAX_PROBLEM_CACHE = 100
# ReMe retrieves at most this many memory cards per turn.
REME_TOP_K = 5

# The tool surface advertised to the model. These schemas/descriptions are the
# pre-migration contract; AgentScope wraps the same JSON schema so the model
# sees no tool-interface change.
TOOLS: list[dict[str, Any]] = [
    {
        "name": "get_weakness_topics",
        "description": "Query the user's knowledge graph to find weakest algorithm topics.",
        "input_schema": {
            "type": "object",
            "properties": {
                "threshold": {"type": "number", "description": "Mastery threshold 0–1, default 0.6"},
            },
        },
    },
    {
        "name": "request_animation",
        "description": (
            "Trigger generation of a Remotion algorithm visualization animation. "
            "Use proactively when introducing a new concept or reviewing a solution."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "type": {
                    "type": "string",
                    "enum": ["PRE_EXPLAIN", "SOLUTION_COMPARE", "CONCEPT"],
                    "description": "Animation type",
                },
                "topic": {"type": "string", "description": "Algorithm topic e.g. 'BFS', 'DP背包'"},
                "problem_id": {"type": "string"},
                "title": {"type": "string"},
            },
            "required": ["type", "topic", "title"],
        },
    },
    {
        "name": "record_sticking_points",
        "description": "After reviewing a submission, persist the user's sticking points to memory.",
        "input_schema": {
            "type": "object",
            "properties": {
                "problem_id": {"type": "string"},
                "sticking_points": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of specific concepts or patterns the user struggled with",
                },
                "pattern_key": {"type": "string", "description": "Short key for a recurring error pattern"},
                "pattern_description": {"type": "string"},
            },
            "required": ["problem_id", "sticking_points"],
        },
    },
    {
        "name": "fetch_problem_meta",
        "description": (
            "Fetch the real statement of one problem from the local Java gateway. "
            "Use it in PREP when you need the actual text instead of guessing. "
            "The first successful fetch is indexed into local vector memory; "
            "later calls in this process reuse the cached result, so do not call "
            "it again every turn."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "slug": {
                    "type": "string",
                    "description": "LeetCode titleSlug, e.g. 'two-sum'",
                },
            },
            "required": ["slug"],
        },
    },
    {
        "name": "get_similar_problems",
        "description": (
            "Search the user's local problem vector memory for similar problems. "
            "Use it in REVIEW to recommend related practice. Pass problem_id for "
            "'more like this' or query with free text when the problem has not "
            "been indexed yet."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "problem_id": {"type": "string", "description": "An indexed problem slug"},
                "query": {"type": "string", "description": "Free-text statement to match"},
                "top_k": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": MAX_SIMILAR_RESULTS,
                    "description": "Number of results, default 5",
                },
            },
        },
    },
    {
        "name": "suggest_next_problem",
        "description": (
            "Recommend the next 1–3 problems to practise, based on the user's "
            "weakest topics, already-due spaced-repetition problems and locally "
            "indexed similar problems. Use it when the user asks what to do next "
            "or after finishing a review. Each suggestion is recorded for a "
            "7-day effectiveness backtest. It never invents a problem: if no "
            "problem slug can be confirmed it returns a topic-only suggestion "
            "with an empty problem_id."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "topic": {
                    "type": "string",
                    "description": "Optional topic to focus on; defaults to weakest topics",
                },
                "limit": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": MAX_RECOMMENDATIONS,
                    "description": "How many suggestions to return, default 3",
                },
            },
        },
    },
]

# Per-reply values that tool executions read. ``contextvars`` keep concurrent
# sessions isolated even though the tools are shared across the process.
_active_problem_id: ContextVar[str | None] = ContextVar(
    "algocoach_active_problem_id", default=None
)
_animation_sink: ContextVar[dict | None] = ContextVar(
    "algocoach_animation_sink", default=None
)


class AlgoCoach:
    """Single-process AgentScope runtime for the coach's ``POST /chat`` route.

    One ReMe middleware (and therefore one embedded ReMe app) is shared by all
    sessions; each stable ``session_id`` gets its own Agent/AgentState so
    conversation history and ReMe write-back remain scoped correctly.
    """

    def __init__(
        self,
        *,
        chat_model: ChatModelBase | None = None,
        reme_middleware: ReMeMiddleware | None = None,
    ) -> None:
        # Construction is lazy: the Anthropic client and the embedded ReMe app
        # are only created on the first non-FOCUS chat. That keeps app startup
        # and FOCUS requests independent from credentials/network.
        self._chat_model = chat_model
        self._memory = reme_middleware
        self._agents: dict[str, Agent] = {}
        self._locks: dict[str, asyncio.Lock] = {}
        self._init_lock = asyncio.Lock()
        self._provider_fingerprint: str | None = None
        # Successful gateway problem metadata, keyed by slug (process-local).
        self._problem_meta: dict[str, dict] = {}

    # ── Agent / middleware lifecycle ──────────────────────────

    async def _get_agent(self, session_id: str, provider: dict[str, Any] | None = None) -> Agent:
        """Return the per-session Agent, building the shared runtime once."""
        async with self._init_lock:
            fingerprint = self._fingerprint_provider(provider)
            if self._provider_fingerprint not in (None, fingerprint) and self._memory is not None:
                middleware = self._memory
                self._memory = None
                self._chat_model = None
                self._agents.clear()
                self._locks.clear()
                await middleware.close()
            existing = self._agents.get(session_id)
            if existing is not None:
                return existing

            if self._chat_model is None:
                self._chat_model = self._build_chat_model(provider)
            self._provider_fingerprint = fingerprint
            if self._memory is None:
                self._memory = ReMeMiddleware(
                    workspace_dir=reme_workspace_dir(),
                    parameters=ReMeMiddleware.Parameters(
                        chat_model=self._chat_model,
                        mode="both",
                        top_k=REME_TOP_K,
                    ),
                )

            # ReMe's write path is automatic; "both" also exposes the optional
            # memory_search tool, which must be registered explicitly.
            tools: list[Any] = self._build_tools()
            tools.extend(await self._memory.list_tools())

            agent = Agent(
                name="AlgoCoach",
                system_prompt=get_system_prompt(DEFAULT_GOAL),
                model=self._chat_model,
                toolkit=Toolkit(tools=tools),
                middlewares=[self._memory],
                state=AgentState(session_id=session_id),
            )
            self._agents[session_id] = agent
            self._locks[session_id] = asyncio.Lock()
            return agent

    async def close(self) -> None:
        """Close the embedded ReMe app (idempotent).

        AgentScope does not manage middleware lifecycle, so the FastAPI
        lifespan calls this explicitly on shutdown.
        """
        async with self._init_lock:
            middleware = self._memory
            self._memory = None
            self._agents.clear()
            self._locks.clear()
            self._provider_fingerprint = None
        if middleware is not None:
            await middleware.close()

    # ── Model / tool wiring ──────────────────────────────────

    @staticmethod
    def _fingerprint_provider(provider: dict[str, Any] | None) -> str:
        payload = json.dumps(provider or {"protocol": "env"}, sort_keys=True)
        return hashlib.sha256(payload.encode()).hexdigest()

    def _build_chat_model(self, provider: dict[str, Any] | None = None) -> ChatModelBase:
        """Build the Anthropic chat model from the existing environment.

        ``ANTHROPIC_API_KEY`` is required for non-FOCUS chat. The optional
        ``ANTHROPIC_BASE_URL`` keeps working for compatible proxies.
        ``CLAUDE_MODEL`` defaults to the model name used before the migration.
        The model instance is shared by the agent and ReMe's memory extraction.
        """
        cfg = provider or {
            "protocol": "anthropic",
            "baseUrl": anthropic_base_url() or "",
            "model": claude_model(),
            "apiKey": os.getenv("ANTHROPIC_API_KEY", ""),
        }
        protocol = str(cfg.get("protocol", "anthropic"))
        model = str(cfg.get("model", "")).strip()
        api_key = str(cfg.get("apiKey", "")).strip()
        base_url = str(cfg.get("baseUrl", "")).strip() or None
        if protocol != "ollama" and not api_key:
            raise RuntimeError("当前 Provider 需要 API key，请在设置页配置")
        if not model:
            raise RuntimeError("当前 Provider 没有配置模型名")
        # Ollama's OpenAI-compatible endpoint ignores the key, but the OpenAI
        # SDK still requires a non-empty credential object.
        secret = SecretStr(api_key or ("ollama" if protocol == "ollama" else ""))
        params: dict[str, Any] = {"max_tokens": 1024}
        if protocol == "anthropic":
            return AnthropicChatModel(
                credential=AnthropicCredential(api_key=secret, base_url=base_url),
                model=model, parameters=AnthropicChatModel.Parameters(**params),
            )
        if protocol in {"openai", "gemini", "ollama"}:
            compatible_url = base_url
            if protocol == "gemini" and not compatible_url:
                compatible_url = "https://generativelanguage.googleapis.com/v1beta/openai"
            if protocol == "ollama" and not compatible_url:
                compatible_url = "http://host.docker.internal:11434/v1"
            return OpenAIChatModel(
                credential=OpenAICredential(api_key=secret, base_url=compatible_url),
                model=model, parameters=OpenAIChatModel.Parameters(**params),
            )
        if protocol == "deepseek":
            return DeepSeekChatModel(
                credential=DeepSeekCredential(api_key=secret, base_url=base_url or "https://api.deepseek.com"),
                model=model, parameters=DeepSeekChatModel.Parameters(**params),
            )
        if protocol == "dashscope":
            return DashScopeChatModel(
                credential=DashScopeCredential(api_key=secret, base_url=base_url or "https://dashscope.aliyuncs.com/compatible-mode/v1"),
                model=model, parameters=DashScopeChatModel.Parameters(**params),
            )
        if protocol == "moonshot":
            return MoonshotChatModel(
                credential=MoonshotCredential(api_key=secret, base_url=base_url or "https://api.moonshot.cn/v1"),
                model=model, parameters=MoonshotChatModel.Parameters(**params),
            )
        if protocol == "minimax":
            return MiniMaxChatModel(
                credential=MiniMaxCredential(api_key=secret, base_url=base_url or "https://api.minimax.io/anthropic"),
                model=model, parameters=MiniMaxChatModel.Parameters(**params),
            )
        if protocol == "volcengine":
            return VolcengineChatModel(
                credential=VolcengineCredential(api_key=secret, base_url=base_url or "https://ark.cn-beijing.volces.com/api/v3"),
                model=model, parameters=VolcengineChatModel.Parameters(**params),
            )
        if protocol == "xai":
            return XAIChatModel(
                credential=XAICredential(api_key=secret, api_host=base_url or "api.x.ai"),
                model=model, parameters=XAIChatModel.Parameters(**params),
            )
        raise RuntimeError(f"不支持的 Provider 协议: {protocol}")

    def _build_tools(self) -> list[FunctionTool]:
        """Wrap the coach's internal tool dispatcher as AgentScope tools.

        The model-facing schema is exactly :data:`TOOLS`; only the execution
        adapter changed. Every coach tool is an internal capability and is
        auto-allowed rather than prompting for user confirmation.
        """
        permission = PermissionDecision(
            behavior=PermissionBehavior.ALLOW,
            message="auto-allowed: AlgoCoach internal tool",
        )

        def _make_call(tool_name: str):
            """Bind one tool name; the model can never supply it as an input."""

            async def _call(**inputs: Any) -> Any:
                return await self._execute_tool(
                    tool_name, inputs, _active_problem_id.get()
                )

            return _call

        tools: list[FunctionTool] = []
        for spec in TOOLS:
            name = str(spec["name"])
            tools.append(
                FunctionTool(
                    _make_call(name),
                    name=name,
                    description=spec["description"],
                    input_schema=spec["input_schema"],
                    permission=permission,
                )
            )
        return tools

    # ── Chat entry point ─────────────────────────────────────

    async def chat(
        self,
        session_id: str,
        message: str,
        mode: str,
        problem_id: str | None = None,
        *,
        goal: str | UserGoal | None = DEFAULT_GOAL,
        training_phase: str | TrainingPhase | None = DEFAULT_TRAINING_PHASE,
        time_remaining_sec: int | None = None,
        provider: dict[str, Any] | None = None,
    ) -> dict:
        """Main entry point. Returns {"content": str, "animation_id": str | None}.

        ``training_phase`` / ``time_remaining_sec`` are the optional OI / xCPC
        training context from ``POST /chat``. An explicit phase or a remaining
        time budget selects the contest goal variant; the phase and budget are
        also stamped into the user message so AgentScope state and the ReMe
        memory write-back contain them. With the default phase and no budget the
        legacy message, Soul and FOCUS guarantees are unchanged.
        """
        # In FOCUS mode the agent must stay silent: no model, memory or tools.
        # This check stays first even when a training context is supplied.
        if mode == "FOCUS":
            return {"content": "", "animation_id": None}

        phase = resolve_training_phase(training_phase)
        resolved_goal = resolve_goal(goal) or (
            UserGoal.CONTEST
            if is_contest_context(phase, time_remaining_sec)
            else DEFAULT_GOAL
        )
        training_context = build_training_context(phase, time_remaining_sec)
        user_content = (
            f"{training_context}\n{message}" if training_context else message
        )

        agent = await self._get_agent(session_id, provider)
        lock = self._locks[session_id]

        async with lock:
            # The domain memory snapshot (weak topics, recent problems,
            # mistakes) still personalises the Soul. ReMe handles conversational
            # long-term memory through the middleware hooks.
            ctx = await memory.build_context_snapshot()
            # AgentScope keeps the constructor prompt on the private attr and
            # has no public setter; update it in place so every turn gets the
            # current domain-memory snapshot and training context.
            agent._system_prompt = get_system_prompt(
                resolved_goal,
                training_phase=phase,
                time_remaining_sec=time_remaining_sec,
            ).format(memory_context=json.dumps(ctx, ensure_ascii=False, indent=2))

            sink: dict = {}
            animation_token = _animation_sink.set(sink)
            problem_token = _active_problem_id.set(problem_id)
            try:
                reply = await agent.reply(
                    UserMsg(name="user", content=user_content)
                )
            finally:
                _active_problem_id.reset(problem_token)
                _animation_sink.reset(animation_token)

        content = reply.get_text_content() or ""
        return {"content": content, "animation_id": sink.get("animation_id")}

    # ── Tool dispatcher ──────────────────────────────────────

    async def _execute_tool(self, name: str, inputs: dict, problem_id: str | None) -> object:
        if name == "get_weakness_topics":
            threshold = inputs.get("threshold", 0.6)
            return await memory.weak_topics(threshold=threshold)

        if name == "request_animation":
            job = await animation_service.enqueue(
                kind=inputs["type"],
                topic=inputs["topic"],
                title=inputs["title"],
                problem_id=inputs.get("problem_id") or problem_id,
            )
            sink = _animation_sink.get()
            if sink is not None:
                sink["animation_id"] = job.id
            return {"job_id": job.id, "status": job.status}

        if name == "record_sticking_points":
            pid = inputs.get("problem_id") or problem_id or "unknown"
            await memory.record_attempt(
                problem_id=pid,
                platform="LEETCODE",
                status="REVIEWED",
                lang="unknown",
                duration_sec=0,
                topics=[],
                sticking_points=inputs.get("sticking_points", []),
            )
            if inputs.get("pattern_key"):
                await memory.upsert_pattern(
                    inputs["pattern_key"],
                    inputs.get("pattern_description", ""),
                )
            await self._index_errors_best_effort(
                pid, inputs.get("sticking_points") or []
            )
            return {"ok": True}

        if name == "fetch_problem_meta":
            return await self._fetch_problem_meta(
                inputs.get("slug") or problem_id or ""
            )

        if name == "get_similar_problems":
            return await self._similar_problems(inputs)

        if name == "suggest_next_problem":
            # The active problem is excluded so the agent does not recommend
            # what the user is already working on.
            requested_limit = inputs.get("limit")
            limit = (
                requested_limit
                if isinstance(requested_limit, int) and not isinstance(requested_limit, bool)
                else MAX_RECOMMENDATIONS
            )
            return await suggest_next_problem(
                limit=limit,
                topic=inputs.get("topic"),
                exclude_problem_id=problem_id,
            )

        return {"error": f"unknown tool: {name}"}

    # ── Vector-memory tools ───────────────────────────────────

    async def _fetch_problem_meta(self, slug: str) -> dict:
        """Return problem metadata, caching it and indexing it on first success.

        The gateway is contacted only when this process has no cached copy for
        the slug, so an agentic loop that mentions the same problem every turn
        does not refetch it each time.
        """
        slug = str(slug or "").strip()
        if not slug:
            return {"ok": False, "error": "slug is required"}

        cached = self._problem_meta.get(slug)
        if cached is None:
            cached = await fetch_problem(slug)
            if cached is None:
                return {
                    "ok": False,
                    "error": f"could not fetch problem {slug!r} from the gateway",
                }
            while len(self._problem_meta) >= MAX_PROBLEM_CACHE:
                self._problem_meta.pop(next(iter(self._problem_meta)))
            self._problem_meta[slug] = cached
            await self._index_problem_best_effort(cached)
        return {"ok": True, **cached}

    async def _similar_problems(self, inputs: dict) -> dict:
        """Query local vector memory, bounded by ``MAX_SIMILAR_RESULTS``."""
        problem_id = str(inputs.get("problem_id") or "").strip()
        query = str(inputs.get("query") or "").strip()
        top_k = _tool_top_k(inputs.get("top_k"))
        if not problem_id and not query:
            return {"ok": False, "error": "provide problem_id or query"}

        try:
            if problem_id:
                results = await vector_store.similar_to_problem(problem_id, top_k)
            else:
                results = await vector_store.find_similar_problems(query, top_k)
        except VectorStoreUnavailable as exc:
            logger.warning("Similar-problem search skipped: %s", exc)
            return {"ok": False, "error": f"local vector memory unavailable: {exc}"}
        except VectorStoreError as exc:
            return {"ok": False, "error": str(exc)}
        except Exception:
            logger.warning("Similar-problem search failed", exc_info=True)
            return {"ok": False, "error": "local vector memory query failed"}

        payload: dict = {"ok": True, "results": results, "count": len(results)}
        if problem_id and not results:
            payload["note"] = (
                "problem not indexed yet; call fetch_problem_meta first "
                "or search with a free-text query"
            )
        return payload

    async def _index_problem_best_effort(self, problem: dict) -> None:
        """Index a fetched problem; vector-memory failures never fail the chat."""
        try:
            await vector_store.index_problem(
                problem_id=problem["problem_id"],
                title=problem.get("title", ""),
                content=problem.get("content", ""),
                topics=problem.get("topics") or [],
                platform="LEETCODE",
                difficulty=problem.get("difficulty") or "",
            )
        except VectorStoreUnavailable as exc:
            logger.warning("Problem indexing skipped: %s", exc)
        except Exception:
            logger.warning(
                "Problem %r could not be indexed", problem.get("problem_id"), exc_info=True
            )

    async def _index_errors_best_effort(
        self, problem_id: str, sticking_points: list
    ) -> None:
        """Index the user's sticking points for later error-pattern search."""
        points = [point for point in sticking_points if str(point).strip()]
        if not points:
            return
        try:
            await vector_store.index_error_descriptions(
                problem_id=problem_id,
                sticking_points=points,
                platform="LEETCODE",
            )
        except VectorStoreUnavailable as exc:
            logger.warning("Error indexing skipped: %s", exc)
        except Exception:
            logger.warning(
                "Sticking points for %r could not be indexed", problem_id, exc_info=True
            )


def _tool_top_k(value: object) -> int:
    """Clamp a model-provided top_k to the tool's small, fixed ceiling."""
    if isinstance(value, bool) or not isinstance(value, (int, str, float)):
        return MAX_SIMILAR_RESULTS
    try:
        parsed = int(value)
    except (OverflowError, TypeError, ValueError):
        return MAX_SIMILAR_RESULTS
    return max(1, min(parsed, MAX_SIMILAR_RESULTS))


coach = AlgoCoach()
