"""Pydantic request/response models shared by the agent HTTP routes.

Keeping every wire model in one module makes the JSON contract explicit and
keeps ``agent/router.py`` focused on routing. Field names are part of the
existing API contract (the frontend and the Java gateway use them verbatim),
so they must not be renamed without a coordinated client change.
"""
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

from app.agent.prompts import (
    DEFAULT_TRAINING_PHASE,
    resolve_capability,
    resolve_coach_style,
    resolve_goal,
    resolve_training_phase,
)

DeepTutorCapability = Literal[
    "chat", "deep_solve", "practice", "mastery_path", "review",
]


class ChatRequest(BaseModel):
    """Body of ``POST /chat/stream``.

    ``trainingPhase`` and ``timeRemainingSec`` carry the OI / xCPC training
    context for the current frontend contract.
    """

    message: str
    mode: str                       # IDLE | PREP | FOCUS | REVIEW
    capability: DeepTutorCapability = "chat"
    workspaceId: str = Field(default="local-default", min_length=1, max_length=128)
    turnId: str | None = Field(default=None, min_length=1, max_length=128)
    afterSequence: int = Field(default=0, ge=0)
    problemId: str | None = None
    platform: str | None = None
    code: str | None = Field(default=None, max_length=50_000)
    codeLanguage: str | None = Field(default=None, max_length=32)
    conversationId: str = Field(min_length=1, max_length=128)
    goal: str | None = None
    trainingPhase: str = DEFAULT_TRAINING_PHASE.value
    timeRemainingSec: int | None = Field(default=None, ge=0)
    # UI preferences (设置 → AI 教练).
    animations: bool = True
    coachStyle: str = "auto"
    provider: "ProviderConfig | None" = None

    @field_validator("capability", mode="before")
    @classmethod
    def _known_capability(cls, value: object) -> str:
        return resolve_capability(value).value

    @field_validator("trainingPhase", mode="before")
    @classmethod
    def _known_training_phase(cls, value: object) -> str:
        """Validate and normalize a training phase."""
        return resolve_training_phase(value).value

    @field_validator("coachStyle", mode="before")
    @classmethod
    def _known_coach_style(cls, value: object) -> str:
        """Validate and normalize the coaching style."""
        return resolve_coach_style(value)

    @field_validator("goal", mode="before")
    @classmethod
    def _known_goal(cls, value: object) -> str | None:
        resolved = resolve_goal(value)
        return resolved.value if resolved is not None else None

    @field_validator("timeRemainingSec", mode="before")
    @classmethod
    def _seconds_not_bool(cls, value: object) -> object:
        """Reject booleans; the field is an optional non-negative integer."""
        if isinstance(value, bool):
            raise ValueError("must be a non-negative integer")
        return value


class TurnReplayRequest(BaseModel):
    """Request body for replaying a persisted terminal turn."""

    turnId: str = Field(min_length=1, max_length=128)
    afterSequence: int = Field(default=0, ge=0)


class ProviderConfig(BaseModel):
    """Ephemeral model connection selected in the local settings page.

    The API key is accepted only for the current request and is never written
    to SQLite, ReMe, logs, exports, or the browser's localStorage.
    """

    id: str = "custom"
    name: str = "Custom provider"
    protocol: Literal[
        "anthropic", "openai", "openai-response", "deepseek", "dashscope", "gemini",
        "moonshot", "minimax", "ollama", "volcengine", "xai",
    ] = "openai"
    baseUrl: str = ""
    model: str = ""
    apiKey: str = ""


class AnimateRequest(BaseModel):
    """Body of ``POST /animate``."""

    type: str                       # PRE_EXPLAIN | SOLUTION_COMPARE | CONCEPT
    topic: str
    title: str
    problemId: str | None = None


class MemoryRecordRequest(BaseModel):
    """Submission result the Java gateway reports via ``POST /memory/record``.

    Field names follow the contract in ``docs/backend-agent.md`` §10. The
    gateway owns submission storage; the agent only persists an episodic
    record and propagates it to semantic mastery.
    """

    problem_id: str
    platform: str
    status: str
    lang: str
    duration_sec: int = Field(ge=0)
    topics: list[str]
    client_id: str | None = Field(default=None, max_length=128)

    @field_validator("problem_id", "platform", "status", "lang", mode="before")
    @classmethod
    def _required_text(cls, value: object) -> str:
        """Reject missing/blank scalars instead of persisting empty strings."""
        if not isinstance(value, str) or not value.strip():
            raise ValueError("must be a non-empty string")
        return value.strip()

    @field_validator("client_id", mode="before")
    @classmethod
    def _client_id_text(cls, value: object) -> str | None:
        if value is None or value == "":
            return None
        if not isinstance(value, str) or not value.strip():
            raise ValueError("client_id must be a non-empty string")
        return value.strip()

    @field_validator("topics")
    @classmethod
    def _topic_names(cls, topics: list[str]) -> list[str]:
        """Each topic must be a usable, non-blank name."""
        cleaned: list[str] = []
        for topic in topics:
            if not isinstance(topic, str) or not topic.strip():
                raise ValueError("topics must be a list of non-empty strings")
            cleaned.append(topic.strip())
        return cleaned


class MemoryRecordResponse(BaseModel):
    """Acknowledgement returned by ``POST /memory/record``."""

    ok: bool = True


class GeneratedAnimationRequest(BaseModel):
    """Body of ``POST /animate/generated`` (P2, feature-flagged).

    The generated TSX is untrusted input. The route only validates the wire
    shape and delegates the allow-list/depth/size checks to
    ``app.remotion.codegen`` before any scratch file or subprocess exists.
    """

    title: str = Field(default="Generated animation", max_length=120)
    code: str = Field(min_length=1, max_length=48 * 1024)
    props: dict[str, Any] = Field(default_factory=dict)
