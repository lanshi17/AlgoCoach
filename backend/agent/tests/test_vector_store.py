"""Unit tests for the local ChromaDB vector memory.

Everything runs against a temporary Chroma directory with the deterministic
``fake_embedding`` fixture from ``conftest.py``: no embedding model download, no
gateway and no LLM calls.
"""
import pytest

from app.memory import vector_store as vector_module
from app.memory.vector_store import (
    COLLECTION_ERROR_DESCRIPTION,
    COLLECTION_PROBLEM_CONTENT,
    COLLECTION_TOPIC_EXPLANATION,
    MAX_RESULT_CHARS,
    MAX_TOP_K,
    VectorRecord,
    VectorStore,
    VectorStoreError,
    VectorStoreUnavailable,
)

pytestmark = pytest.mark.asyncio


@pytest.fixture
def store(tmp_path, fake_embedding):
    return VectorStore(path=str(tmp_path / "chroma"), embedding_function=fake_embedding)


async def test_store_does_not_touch_disk_until_first_use(tmp_path, fake_embedding):
    target = tmp_path / "chroma"
    VectorStore(path=str(target), embedding_function=fake_embedding)
    assert not target.exists()


async def test_upsert_is_idempotent_and_updates_the_document(store):
    await store.index_problem(
        "two-sum", "Two Sum", "find two numbers that add up", ["Array"]
    )
    await store.index_problem(
        "two-sum", "Two Sum", "updated hash table statement", ["Hash Table"]
    )

    assert await store.count(COLLECTION_PROBLEM_CONTENT) == 1
    record = await store.get(COLLECTION_PROBLEM_CONTENT, "two-sum")
    assert "updated hash table statement" in record["document"]
    assert record["metadata"]["problem_id"] == "two-sum"
    assert record["metadata"]["id"] == "two-sum"
    assert record["metadata"]["topic"] == "Hash Table"
    assert record["metadata"]["platform"] == "LEETCODE"
    assert record["metadata"]["created_at"]


async def test_collections_are_isolated(store):
    await store.upsert(
        COLLECTION_PROBLEM_CONTENT,
        [VectorRecord("shared", "binary search statement", {"platform": "LEETCODE"})],
    )
    await store.upsert(
        COLLECTION_ERROR_DESCRIPTION,
        [VectorRecord("shared", "binary search off by one", {"platform": "LEETCODE"})],
    )

    problem = await store.get(COLLECTION_PROBLEM_CONTENT, "shared")
    error = await store.get(COLLECTION_ERROR_DESCRIPTION, "shared")
    assert problem["document"] == "binary search statement"
    assert error["document"] == "binary search off by one"
    assert await store.count(COLLECTION_PROBLEM_CONTENT) == 1
    assert await store.count(COLLECTION_ERROR_DESCRIPTION) == 1


async def test_similar_search_orders_by_distance_and_keeps_metadata(store):
    await store.index_problem(
        "two-sum",
        "Two Sum",
        "hash table array target sum",
        ["Array", "Hash Table"],
        platform="LEETCODE",
    )
    await store.index_problem(
        "binary-search",
        "Binary Search",
        "binary search sorted array midpoint",
        ["Binary Search"],
        platform="LEETCODE",
    )
    await store.index_problem(
        "graph-bfs",
        "BFS Graph",
        "breadth first search graph queue",
        ["BFS"],
        platform="LUOGU",
    )

    results = await store.find_similar_problems("binary search sorted array", top_k=3)

    assert results[0]["id"] == "binary-search"
    assert results[0]["metadata"]["problem_id"] == "binary-search"
    assert results[0]["metadata"]["topic"] == "Binary Search"
    assert results[0]["metadata"]["platform"] == "LEETCODE"
    distances = [item["distance"] for item in results]
    assert distances == sorted(distances)

    filtered = await store.find_similar_problems(
        "graph queue", top_k=3, where={"platform": "LUOGU"}
    )
    assert [item["id"] for item in filtered] == ["graph-bfs"]


async def test_similar_to_problem_excludes_itself(store):
    await store.index_problem("binary-search", "Binary Search", "sorted array midpoint")
    await store.index_problem("lower-bound", "Lower Bound", "sorted array binary search")
    await store.index_problem("two-sum", "Two Sum", "hash table target sum")

    results = await store.similar_to_problem("binary-search", top_k=2)

    assert results
    assert all(item["id"] != "binary-search" for item in results)
    assert results[0]["id"] == "lower-bound"

    assert await store.similar_to_problem("not-indexed") == []


async def test_top_k_and_returned_documents_are_bounded(store):
    for index in range(12):
        await store.index_problem(
            f"p{index}", f"Problem {index}", "common word " * 200 + f"unique{index}"
        )

    results = await store.query(COLLECTION_PROBLEM_CONTENT, "common word", top_k=999)

    assert 0 < len(results) <= MAX_TOP_K
    assert all(len(item["document"]) <= MAX_RESULT_CHARS for item in results)


async def test_export_all_returns_full_documents_and_metadata_without_embeddings(store):
    await store.index_problem("two-sum", "Two Sum", "complete stored statement", ["Array"])
    await store.index_error_descriptions("two-sum", ["missed empty input"])

    exported = await store.export_all()

    problem = exported[COLLECTION_PROBLEM_CONTENT][0]
    error = exported[COLLECTION_ERROR_DESCRIPTION][0]
    assert problem["id"] == "two-sum"
    assert "complete stored statement" in problem["document"]
    assert problem["metadata"]["topic"] == "Array"
    assert error["document"] == "two-sum missed empty input"
    assert COLLECTION_TOPIC_EXPLANATION in exported


async def test_empty_queries_and_empty_collections_return_empty(store):
    assert await store.query(COLLECTION_PROBLEM_CONTENT, "   ") == []
    assert await store.find_similar_problems("binary search") == []
    assert await store.count(COLLECTION_PROBLEM_CONTENT) == 0
    assert await store.get(COLLECTION_PROBLEM_CONTENT, "two-sum") is None


async def test_topic_explanations_are_idempotent(store):
    first = await store.index_topic_explanation("BFS", "queue level traversal")
    second = await store.index_topic_explanation("BFS", "queue level traversal")

    assert first == second
    assert await store.count(COLLECTION_TOPIC_EXPLANATION) == 1
    results = await store.find_topic_explanations("queue traversal")
    assert results[0]["metadata"]["topic"] == "BFS"


async def test_error_descriptions_are_idempotent_and_searchable(store):
    first = await store.index_error_descriptions(
        "two-sum", ["边界条件漏判", "hash 冲突处理"]
    )
    second = await store.index_error_descriptions(
        "two-sum", ["边界条件漏判", "hash 冲突处理"]
    )

    assert first == second
    assert len(first) == 2
    assert await store.count(COLLECTION_ERROR_DESCRIPTION) == 2

    results = await store.find_similar_errors("hash 冲突处理")
    assert results[0]["metadata"]["problem_id"] == "two-sum"
    assert "hash" in results[0]["document"]


async def test_anonymized_telemetry_is_disabled(store):
    client = store._ensure_client()
    settings = client.get_settings()

    assert settings.anonymized_telemetry is False


async def test_missing_chromadb_raises_unavailable(tmp_path, monkeypatch):
    def missing():
        raise ImportError("chromadb is not installed")

    monkeypatch.setattr(vector_module, "_import_chromadb", missing)
    store = VectorStore(path=str(tmp_path / "chroma"))

    with pytest.raises(VectorStoreUnavailable):
        await store.query(COLLECTION_PROBLEM_CONTENT, "binary search")
    with pytest.raises(VectorStoreUnavailable):
        await store.count(COLLECTION_PROBLEM_CONTENT)


async def test_invalid_records_and_collections_are_rejected(store):
    with pytest.raises(VectorStoreError):
        await store.upsert("not_a_collection", [VectorRecord("x", "text")])
    with pytest.raises(VectorStoreError):
        await store.upsert(COLLECTION_PROBLEM_CONTENT, [VectorRecord("", "text")])
    with pytest.raises(VectorStoreError):
        await store.upsert(COLLECTION_PROBLEM_CONTENT, [VectorRecord("id", "   ")])
