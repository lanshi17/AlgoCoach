"""Tests for the gateway problem client and its response normalisation."""
import httpx
import pytest

from app.agent.gateway import MAX_TOOL_CONTENT_CHARS, fetch_problem, normalize_problem


def test_normalize_problem_reads_translated_fields_and_strips_html():
    problem = normalize_problem(
        {
            "titleSlug": "two-sum",
            "translatedTitle": "两数之和",
            "translatedContent": "<p>给定一个整数数组 <code>nums</code>。</p><p>示例：…</p>",
            "difficulty": "easy",
            "topicTags": [
                {"name": "Array", "nameTranslated": "数组"},
                {"name": "Hash Table", "nameTranslated": "哈希表"},
            ],
        }
    )

    assert problem == {
        "problem_id": "two-sum",
        "title": "两数之和",
        "difficulty": "EASY",
        "topics": ["数组", "哈希表"],
        "content": "给定一个整数数组 nums 。 示例：…",
    }


def test_normalize_problem_rejects_empty_or_unidentifiable_payloads():
    assert normalize_problem(None) is None
    assert normalize_problem({}) is None
    assert normalize_problem({"title": "no slug"}) is None


def test_normalize_problem_bounds_the_content_length():
    problem = normalize_problem(
        {"titleSlug": "long", "content": "x" * (MAX_TOOL_CONTENT_CHARS + 500)}
    )
    assert len(problem["content"]) == MAX_TOOL_CONTENT_CHARS


@pytest.mark.asyncio
async def test_fetch_problem_returns_none_on_gateway_errors(monkeypatch):
    class BrokenClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def get(self, url):
            raise httpx.ConnectTimeout("gateway down")

    monkeypatch.setattr(httpx, "AsyncClient", BrokenClient)

    assert await fetch_problem("two-sum") is None
    assert await fetch_problem("   ") is None


@pytest.mark.asyncio
async def test_fetch_problem_normalises_a_successful_response(monkeypatch):
    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "titleSlug": "two-sum",
                "title": "Two Sum",
                "content": "<p>Find the pair.</p>",
                "difficulty": "Easy",
                "topicTags": ["Array"],
            }

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def get(self, url):
            assert url.endswith("/api/problems/two-sum")
            return FakeResponse()

    monkeypatch.setattr(httpx, "AsyncClient", FakeClient)

    problem = await fetch_problem("two-sum")

    assert problem["problem_id"] == "two-sum"
    assert problem["title"] == "Two Sum"
    assert problem["content"] == "Find the pair."
    assert problem["topics"] == ["Array"]
    assert problem["difficulty"] == "EASY"
