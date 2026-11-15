"""Test bootstrap: import ``app`` from ``backend/agent`` and isolate the DB.

The agent modules read ``DB_PATH`` at import time, so it must point at a
throw-away SQLite file before ``app`` is imported. This keeps the real
``data/agent.db`` untouched by the test suite.
"""
import atexit
import hashlib
import os
import re
import shutil
import sys
import tempfile
from pathlib import Path
from types import SimpleNamespace

import pytest

AGENT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(AGENT_ROOT))

_TEST_DIR = tempfile.mkdtemp(prefix="algocoach-agent-tests-")
os.environ["DB_PATH"] = str(Path(_TEST_DIR) / "agent.db")
os.environ.setdefault("ANTHROPIC_API_KEY", "test-key-not-used")
os.environ.setdefault("OUTPUT_DIR", str(Path(_TEST_DIR) / "animations"))
# Never let a test fall through to the real local Chroma directory or a live
# gateway; the vector tests pass an explicit temporary path.
os.environ.setdefault("CHROMA_PATH", str(Path(_TEST_DIR) / "chroma"))
os.environ.setdefault("REME_WORKSPACE_DIR", str(Path(_TEST_DIR) / "reme"))
os.environ.setdefault("GATEWAY_BASE_URL", "http://gateway.invalid")
# The ASGI test transport does not run lifespan, but disabling crons keeps any
# future lifespan-based test from starting real scheduled work.
os.environ.setdefault("ALGOCOACH_CRONS_ENABLED", "false")
# Animations are opt-in in production (REMOTION_ENABLED defaults to false); the
# suite enables them so the existing animation tests keep covering the feature.
# The disabled path is covered explicitly in test_router_compat/test_prompts.
os.environ.setdefault("REMOTION_ENABLED", "true")
atexit.register(shutil.rmtree, _TEST_DIR, ignore_errors=True)

import httpx  # noqa: E402
import pytest_asyncio  # noqa: E402
from agentscope.credential import AnthropicCredential  # noqa: E402
from agentscope.formatter import AnthropicChatFormatter  # noqa: E402
from agentscope.message import TextBlock  # noqa: E402
from agentscope.middleware import ReMeMiddleware  # noqa: E402
from agentscope.model import ChatModelBase, ChatResponse  # noqa: E402

from app.main import app  # noqa: E402
from app.memory.db import Base, engine  # noqa: E402

_WORD_RE = re.compile(r"[a-z0-9]+")
_CJK_RE = re.compile(r"[\u4e00-\u9fff]")


class FakeEmbedding:
    """Deterministic bag-of-tokens embedding: no model, no network.

    Hashing tokens into a small vector gives stable, meaningful similarity for
    the tests while keeping the exact ChromaDB code path (upsert/query) real.
    """

    def __init__(self, dim: int = 128):
        self.dim = dim

    @staticmethod
    def name() -> str:
        return "deterministic-fake"

    def __call__(self, input):  # Chroma's EmbeddingFunction protocol
        return [self.embed(text) for text in input]

    def embed_query(self, input):  # ChromaDB >= 1.x query path
        return self(input)

    def embed_documents(self, input):
        return self(input)

    def is_legacy(self) -> bool:
        """Keep Chroma on the simple callable path (no config round-trip)."""
        return True

    def embed(self, text: str) -> list[float]:
        raw = str(text).lower()
        tokens = _WORD_RE.findall(raw) + _CJK_RE.findall(raw)
        vector = [0.0] * self.dim
        for token in tokens:
            digest = hashlib.sha1(token.encode("utf-8")).digest()
            index = int.from_bytes(digest[:4], "big") % self.dim
            vector[index] += 1.0
        norm = sum(value * value for value in vector) ** 0.5
        if norm:
            return [value / norm for value in vector]
        vector[0] = 1.0
        return vector


class FakeChatModel(ChatModelBase):
    """AgentScope chat-model double: deterministic replies, no network.

    ``responses`` are returned in order (each a ``ChatResponse``); when the
    script is exhausted the model answers with ``default_text``. Every call is
    recorded so tests can assert the system prompt, tool set and session
    context the agent actually saw.
    """

    def __init__(self, responses=None, default_text: str = "好的"):
        super().__init__(
            credential=AnthropicCredential(api_key="test-key-not-used"),
            model="fake-agent-model",
            parameters=ChatModelBase.Parameters(),
            stream=False,
        )
        self.responses = list(responses or [])
        self.default_text = default_text
        self.formatter = AnthropicChatFormatter()
        self.calls: list[dict] = []

    async def _call_api(
        self,
        model_name,
        messages,
        tools=None,
        tool_choice=None,
        **kwargs,
    ):
        self.calls.append(
            {
                "messages": messages,
                "tools": tools,
                "tool_choice": tool_choice,
            }
        )
        if self.responses:
            return self.responses.pop(0)
        return ChatResponse(
            content=[TextBlock(text=self.default_text)],
            is_last=True,
        )


class RecordingReMe(ReMeMiddleware):
    """ReMe middleware double that records jobs without starting ReMe.

    The real embedded ReMe app is exercised separately; this double lets the
    /chat tests assert the middleware invocation contract (search on reply,
    auto_memory write-back, session scoping, close) deterministically.
    """

    def __init__(self, workspace_dir: str, search_results=None):
        super().__init__(
            workspace_dir=workspace_dir,
            parameters=ReMeMiddleware.Parameters(mode="both", top_k=5),
        )
        self.search_results = list(search_results or [])
        self.jobs: list[tuple[str, dict]] = []
        self.start_count = 0
        self.close_count = 0

    async def _ensure_started(self) -> None:
        if not self._started:
            self.start_count += 1
            self._started = True

    async def _run_job(self, name: str, **kwargs):
        await self._ensure_started()
        self.jobs.append((name, kwargs))
        if name == "search":
            return SimpleNamespace(
                success=True,
                answer="",
                metadata={
                    "results": [{"text": text} for text in self.search_results]
                },
            )
        return SimpleNamespace(success=True, answer="", metadata={})

    async def close(self) -> None:
        self.close_count += 1
        self._started = False


@pytest.fixture
def fake_embedding():
    return FakeEmbedding()


@pytest_asyncio.fixture(autouse=True)
async def _fresh_db():
    """Give every test an empty schema, then release pooled connections."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    # Each test runs on its own event loop; drop pooled connections so the
    # next test does not reuse an aiosqlite connection bound to a dead loop.
    await engine.dispose()


@pytest_asyncio.fixture
async def client():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
