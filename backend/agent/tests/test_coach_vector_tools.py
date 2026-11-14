"""Integration tests for the vector-memory coach tools.

The gateway is faked and Chroma uses the deterministic ``fake_embedding``
fixture, so no real network, model download or LLM call happens here.
"""
import pytest

from app.agent import coach as coach_module
from app.agent.coach import MAX_SIMILAR_RESULTS, AlgoCoach
from app.memory import vector_store as vector_module
from app.memory.vector_store import (
    COLLECTION_ERROR_DESCRIPTION,
    COLLECTION_PROBLEM_CONTENT,
    VectorStore,
    VectorStoreUnavailable,
)

pytestmark = pytest.mark.asyncio


@pytest.fixture
def store(tmp_path, fake_embedding):
    return VectorStore(path=str(tmp_path / "chroma"), embedding_function=fake_embedding)


@pytest.fixture
def agent(monkeypatch, store):
    instance = AlgoCoach()
    monkeypatch.setattr(coach_module, "vector_store", store)
    return instance


async def test_fetch_problem_meta_caches_and_indexes_once(agent, store, monkeypatch):
    calls: list[str] = []

    async def fake_fetch(slug):
        calls.append(slug)
        return {
            "problem_id": slug,
            "title": "Two Sum",
            "difficulty": "EASY",
            "topics": ["Array", "Hash Table"],
            "content": "Given an array of integers, return indices of the two numbers.",
        }

    monkeypatch.setattr(coach_module, "fetch_problem", fake_fetch)

    first = await agent._execute_tool("fetch_problem_meta", {"slug": "two-sum"}, None)
    second = await agent._execute_tool("fetch_problem_meta", {"slug": "two-sum"}, None)

    assert first["ok"] is True
    assert first["title"] == "Two Sum"
    assert second["ok"] is True
    # Cached in-process: a chatty agentic loop must not refetch every turn.
    assert calls == ["two-sum"]
    assert await store.count(COLLECTION_PROBLEM_CONTENT) == 1
    record = await store.get(COLLECTION_PROBLEM_CONTENT, "two-sum")
    assert record["metadata"]["topic"] == "Array,Hash Table"


async def test_fetch_problem_meta_can_use_the_active_problem_id(agent, store, monkeypatch):
    async def fake_fetch(slug):
        return {
            "problem_id": slug,
            "title": "BFS",
            "difficulty": "MEDIUM",
            "topics": ["BFS"],
            "content": "Traverse the graph breadth first.",
        }

    monkeypatch.setattr(coach_module, "fetch_problem", fake_fetch)

    result = await agent._execute_tool("fetch_problem_meta", {}, "graph-bfs")

    assert result["ok"] is True
    assert result["problem_id"] == "graph-bfs"
    assert await store.get(COLLECTION_PROBLEM_CONTENT, "graph-bfs") is not None


async def test_fetch_problem_meta_reports_gateway_failure(agent, store, monkeypatch):
    async def failing_fetch(slug):
        return None

    monkeypatch.setattr(coach_module, "fetch_problem", failing_fetch)

    result = await agent._execute_tool("fetch_problem_meta", {"slug": "missing"}, None)

    assert result["ok"] is False
    assert "gateway" in result["error"]
    # A failed fetch must not be cached or indexed.
    assert await store.count(COLLECTION_PROBLEM_CONTENT) == 0


async def test_record_sticking_points_indexes_errors_idempotently(agent, store):
    inputs = {
        "problem_id": "two-sum",
        "sticking_points": ["边界条件漏判", "hash 冲突处理"],
    }

    assert (await agent._execute_tool("record_sticking_points", inputs, None))["ok"] is True
    assert await store.count(COLLECTION_ERROR_DESCRIPTION) == 2

    # Repeating the review writes the same episodes/patterns, and upsert must
    # not duplicate the vectors either.
    assert (await agent._execute_tool("record_sticking_points", inputs, None))["ok"] is True
    assert await store.count(COLLECTION_ERROR_DESCRIPTION) == 2

    results = await store.find_similar_errors("hash 冲突处理")
    assert results[0]["metadata"]["problem_id"] == "two-sum"


async def test_similar_problems_tool_clamps_top_k(agent, store):
    for index in range(10):
        await store.index_problem(
            f"p{index}", f"Problem {index}", f"binary search variant {index}", ["Binary Search"]
        )

    result = await agent._execute_tool(
        "get_similar_problems", {"query": "binary search", "top_k": 50}, None
    )

    assert result["ok"] is True
    assert 0 < len(result["results"]) <= MAX_SIMILAR_RESULTS


async def test_similar_problems_tool_can_search_by_problem_id(agent, store):
    await store.index_problem("two-sum", "Two Sum", "hash table array target sum")
    await store.index_problem("two-sum-ii", "Two Sum II", "sorted array two pointers target sum")
    await store.index_problem("graph-bfs", "BFS", "graph queue breadth first")

    result = await agent._execute_tool(
        "get_similar_problems", {"problem_id": "two-sum", "top_k": 1}, None
    )

    assert result["ok"] is True
    assert len(result["results"]) == 1
    assert result["results"][0]["id"] == "two-sum-ii"

    missing = await agent._execute_tool(
        "get_similar_problems", {"problem_id": "not-indexed"}, None
    )
    assert missing["ok"] is True
    assert missing["results"] == []
    assert "not indexed" in missing["note"]


async def test_similar_problems_tool_requires_a_query(agent):
    result = await agent._execute_tool("get_similar_problems", {}, None)

    assert result["ok"] is False
    assert "problem_id or query" in result["error"]


async def test_similar_problems_tool_degrades_when_chromadb_is_missing(
    tmp_path, monkeypatch
):
    def missing():
        raise ImportError("chromadb is not installed")

    monkeypatch.setattr(vector_module, "_import_chromadb", missing)
    monkeypatch.setattr(
        coach_module, "vector_store", VectorStore(path=str(tmp_path / "chroma"))
    )
    instance = AlgoCoach()

    result = await instance._execute_tool(
        "get_similar_problems", {"query": "binary search"}, None
    )

    assert result["ok"] is False
    assert "unavailable" in result["error"]


async def test_fetch_indexing_failure_never_breaks_the_tool(agent, store, monkeypatch):
    async def fake_fetch(slug):
        return {
            "problem_id": slug,
            "title": "Two Sum",
            "difficulty": "EASY",
            "topics": ["Array"],
            "content": "statement",
        }

    async def broken_index(**kwargs):
        raise VectorStoreUnavailable("disk full")

    monkeypatch.setattr(coach_module, "fetch_problem", fake_fetch)
    monkeypatch.setattr(store, "index_problem", broken_index)

    result = await agent._execute_tool("fetch_problem_meta", {"slug": "two-sum"}, None)

    assert result["ok"] is True
    assert result["title"] == "Two Sum"


async def test_focus_mode_stays_silent_and_never_fetches(agent, monkeypatch):
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

    monkeypatch.setattr(coach_module, "fetch_problem", fake_fetch)

    result = await agent.chat("focus-session", "help", "FOCUS", "two-sum")

    assert result == {"content": "", "animation_id": None}
    # FOCUS returns before the tool loop: no gateway call, no vector work.
    assert calls == []
