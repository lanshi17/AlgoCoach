"""Regression tests for the pre-existing ``/chat`` and ``/animate`` routes.

The P0 refactor moved the request models into ``app.models.schemas``; these
tests pin the wire contract so field names and response shapes stay unchanged.
"""
from types import SimpleNamespace

import pytest

from app.remotion.animation_service import animation_service

pytestmark = pytest.mark.asyncio


async def test_chat_focus_mode_still_returns_empty_content(client):
    resp = await client.post(
        "/chat",
        json={"message": "help me", "mode": "FOCUS", "problemId": "two-sum"},
    )

    assert resp.status_code == 200
    # FOCUS mode must stay silent and is answered without calling Claude.
    assert resp.json() == {"content": "", "animationId": None}


async def test_chat_still_requires_message(client):
    resp = await client.post("/chat", json={"mode": "FOCUS"})

    assert resp.status_code == 422


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
