"""HTTP route tests for the streaming agent and animation endpoints."""
from types import SimpleNamespace

import pytest

from app.agent import router as router_module
from app.remotion.animation_service import animation_service

pytestmark = pytest.mark.asyncio


async def test_chat_stream_emits_thinking_text_and_done_events(client, monkeypatch):
    async def fake_stream(**kwargs):
        assert kwargs["session_id"] != "default"
        assert kwargs["platform"] == "LEETCODE"
        yield {"type": "thinking", "delta": "先确认约束。"}
        yield {"type": "text", "delta": "复杂度是 O(n)。"}
        yield {"type": "done", "content": "复杂度是 O(n)。", "animation_id": None}

    monkeypatch.setattr(router_module.coach, "chat_stream", fake_stream)
    response = await client.post(
        "/chat/stream",
        json={
            "message": "怎么做？", "mode": "PREP", "problemId": "two-sum",
            "platform": "LEETCODE", "conversationId": "test-page",
        },
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert '"type": "thinking"' in response.text
    assert '"delta": "先确认约束。"' in response.text
    assert '"type": "done"' in response.text


async def test_chat_stream_requires_conversation_context(client):
    response = await client.post("/chat/stream", json={"message": "hi", "mode": "PREP"})
    assert response.status_code == 422


async def test_animate_route_keeps_request_and_response_fields(client, monkeypatch):
    captured: dict[str, object] = {}

    async def fake_enqueue(**kwargs):
        captured.update(kwargs)
        return SimpleNamespace(id="job-1", status="QUEUED")

    monkeypatch.setattr(animation_service, "enqueue", fake_enqueue)

    resp = await client.post(
        "/animate",
        json={
            "type": "PRE_EXPLAIN",
            "topic": "BFS",
            "title": "BFS 入门",
            "problemId": "bfs-1",
        },
    )

    assert resp.status_code == 200
    assert resp.json() == {"job_id": "job-1", "status": "QUEUED"}
    assert captured == {
        "kind": "PRE_EXPLAIN",
        "topic": "BFS",
        "title": "BFS 入门",
        "problem_id": "bfs-1",
    }


async def test_animate_fails_closed_unless_opted_in(client, monkeypatch):
    monkeypatch.delenv("REMOTION_ENABLED", raising=False)
    before = len(animation_service._jobs)

    resp = await client.post(
        "/animate",
        json={"type": "PRE_EXPLAIN", "topic": "BFS", "title": "BFS 入门"},
    )

    assert resp.status_code == 503
    assert resp.json()["detail"] == {
        "code": "AnimationDisabled",
        "reason": "remotion_disabled",
    }
    assert len(animation_service._jobs) == before


async def test_poll_animate_keeps_response_fields(client, monkeypatch):
    async def fake_get(job_id):
        assert job_id == "job-1"
        return SimpleNamespace(
            id="job-1",
            status="READY",
            video_url="/animations/job-1.mp4",
            title="BFS 入门",
        )

    monkeypatch.setattr(animation_service, "get", fake_get)

    resp = await client.get("/animate/job-1")

    assert resp.status_code == 200
    assert resp.json() == {
        "id": "job-1",
        "status": "READY",
        "videoUrl": "/animations/job-1.mp4",
        "title": "BFS 入门",
    }
