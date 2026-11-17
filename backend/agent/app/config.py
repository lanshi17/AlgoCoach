"""Runtime configuration read from environment variables.

Environment is resolved on demand rather than at import time so a single
process can be pointed at throw-away paths (tests) or a mounted container
volume without re-importing modules. Shared gateway and storage settings live
here so the coach tools and cron jobs use one definition.

Only local, on-disk state is configured here: the SQLite database lives at
``DB_PATH`` (``app/memory/db.py`` keeps its existing import-time default) and
the Chroma vector store lives at ``CHROMA_PATH``. Nothing in this module
contacts a network service.
"""
import os

DEFAULT_GATEWAY_BASE_URL = "http://localhost:8080"
DEFAULT_GATEWAY_TIMEOUT_SECONDS = 10.0

# Mirrors ``app/memory/db.py``'s existing default so running uvicorn from
# ``backend/agent`` keeps both stores under the repository's ``data/`` folder.
DEFAULT_CHROMA_PATH = "../../data/chroma"

# ── /chat/stream agent runtime (AgentScope + ReMe) ────────────────────
#
# Prefix used to namespace AgentScope sessions. The router derives per-page,
# per-problem session ids from this prefix and the browser conversation id.
# This remains configurable for isolated local deployments.
DEFAULT_SESSION_ID = "default"
DEFAULT_CLAUDE_MODEL = "claude-opus-5-5"
# Embedded ReMe workspace (memory cards + keyword/vector indexes). Like the
# SQLite/Chroma stores this is local-only; it is never uploaded.
DEFAULT_REME_WORKSPACE = "../../data/reme"
DEFAULT_REME_VECTOR_ENABLED = True


def gateway_base_url() -> str:
    """Base URL of the Java gateway (``GATEWAY_BASE_URL``)."""
    return (
        os.getenv("GATEWAY_BASE_URL", DEFAULT_GATEWAY_BASE_URL).strip()
        or DEFAULT_GATEWAY_BASE_URL
    ).rstrip("/")


def gateway_timeout_seconds() -> float:
    """HTTP timeout for gateway calls (``GATEWAY_TIMEOUT_SECONDS``)."""
    raw = os.getenv("GATEWAY_TIMEOUT_SECONDS", str(DEFAULT_GATEWAY_TIMEOUT_SECONDS))
    try:
        return max(0.1, float(raw))
    except ValueError:
        return DEFAULT_GATEWAY_TIMEOUT_SECONDS


def chroma_path() -> str:
    """Persistent ChromaDB directory (``CHROMA_PATH``).

    Defaults to ``../../data/chroma`` relative to the working directory, the
    same convention as the SQLite database. Local-only: the directory is never
    synced or uploaded by this project.
    """
    return os.getenv("CHROMA_PATH", DEFAULT_CHROMA_PATH).strip() or DEFAULT_CHROMA_PATH


def chat_session_id() -> str:
    """Session namespace prefix for ``POST /chat/stream`` (``ALGOCOACH_SESSION_ID``)."""
    return (
        os.getenv("ALGOCOACH_SESSION_ID", DEFAULT_SESSION_ID).strip()
        or DEFAULT_SESSION_ID
    )


def claude_model() -> str:
    """Chat model name shared by the agent and ReMe (``CLAUDE_MODEL``)."""
    return (
        os.getenv("CLAUDE_MODEL", DEFAULT_CLAUDE_MODEL).strip()
        or DEFAULT_CLAUDE_MODEL
    )


def anthropic_base_url() -> str | None:
    """Optional Anthropic-compatible base URL (``ANTHROPIC_BASE_URL``)."""
    return os.getenv("ANTHROPIC_BASE_URL", "").strip() or None


def reme_workspace_dir() -> str:
    """Embedded ReMe workspace directory (``REME_WORKSPACE_DIR``).

    ReMe stores conversation memory cards and their indexes here. It is
    independent from the SQLite and Chroma stores, so existing user data is
    left untouched.
    """
    return (
        os.getenv("REME_WORKSPACE_DIR", DEFAULT_REME_WORKSPACE).strip()
        or DEFAULT_REME_WORKSPACE
    )


def reme_vector_enabled() -> bool:
    """Whether ReMe should use the local MiniLM vector index.

    Enabled by default. Set ``REME_VECTOR_ENABLED=false`` to use ReMe's
    keyword index only, for example on a machine that should not download the
    local ONNX embedding model.
    """
    return os.getenv("REME_VECTOR_ENABLED", "true").strip().lower() != "false"


# ── Generated Remotion code (P2) ────────────────────────────────
#
# The generated-code path is disabled unless REMOTION_CODEGEN_ENABLED is
# explicitly "true". Enabling the flag is not enough: app/remotion/codegen.py
# also performs a real Bubblewrap preflight before the first render and stays
# fail-closed when any isolation property cannot be proven.

DEFAULT_REMOTION_CODEGEN_TIMEOUT_SECONDS = 90.0
DEFAULT_REMOTION_CODEGEN_MAX_ACTIVE_JOBS = 1


# Prebuilt Remotion animations (the coach's ``request_animation`` tool and
# ``POST /animate``). Disabled by default: the tool schema is sent with every
# /chat request, so an unused animation surface costs model tokens on every
# turn. ``REMOTION_ENABLED=true`` opts back in.
DEFAULT_REMOTION_ENABLED = False


def remotion_enabled() -> bool:
    """Whether prebuilt Remotion animations are opted in (exact "true")."""
    return os.getenv("REMOTION_ENABLED", "").strip().lower() == "true"


def remotion_codegen_enabled() -> bool:
    """Whether generated-code rendering is opted in (exact "true")."""
    return os.getenv("REMOTION_CODEGEN_ENABLED", "").strip().lower() == "true"


def remotion_codegen_tmp_root() -> str | None:
    """Optional parent directory for per-render sandbox scratch space."""
    return os.getenv("REMOTION_CODEGEN_TMP_ROOT", "").strip() or None


def remotion_codegen_token() -> str | None:
    """Bearer token required by ``POST /animate/generated``.

    Missing/blank means the feature must fail closed whenever it is enabled.
    The value is never logged or returned by the API.
    """
    return os.getenv("REMOTION_CODEGEN_TOKEN", "").strip() or None


def remotion_codegen_max_active_jobs() -> int:
    """Small admission ceiling for queued + rendering generated jobs.

    Deliberately clamped to 1–2 so a misconfiguration cannot turn the
    generated-code path into an unbounded task/job queue. Prebuilt animation
    jobs are not affected.
    """
    raw = os.getenv(
        "REMOTION_CODEGEN_MAX_ACTIVE_JOBS",
        str(DEFAULT_REMOTION_CODEGEN_MAX_ACTIVE_JOBS),
    )
    try:
        value = int(raw)
    except ValueError:
        return DEFAULT_REMOTION_CODEGEN_MAX_ACTIVE_JOBS
    return min(max(value, 1), 2)


def remotion_codegen_timeout_seconds() -> float:
    """Hard wall-clock timeout for one sandboxed render."""
    raw = os.getenv(
        "REMOTION_CODEGEN_TIMEOUT_SECONDS",
        str(DEFAULT_REMOTION_CODEGEN_TIMEOUT_SECONDS),
    )
    try:
        value = float(raw)
    except ValueError:
        return DEFAULT_REMOTION_CODEGEN_TIMEOUT_SECONDS
    return min(max(value, 10.0), 600.0)


def _optional_bin(var: str) -> str | None:
    return os.getenv(var, "").strip() or None


def remotion_codegen_bwrap_bin() -> str | None:
    """Optional override for the Bubblewrap executable (``bwrap``)."""
    return _optional_bin("REMOTION_CODEGEN_BWRAP_BIN")


def remotion_codegen_node_bin() -> str | None:
    """Optional override for the Node executable used by the renderer."""
    return _optional_bin("REMOTION_CODEGEN_NODE_BIN")


def remotion_codegen_chrome_bin() -> str | None:
    """Optional override for the Chromium/Chrome executable Remotion uses."""
    return _optional_bin("REMOTION_CODEGEN_CHROME_BIN")
