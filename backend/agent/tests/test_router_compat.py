"""Regression tests for the pre-existing ``/chat`` and ``/animate`` routes.

The P0 refactor moved the request models into ``app.models.schemas``; these
tests pin the wire contract so field names and response shapes stay unchanged.
"""
from types import SimpleNamespace

import pytest

from app.agent import router as router_module
from app.agent.coach import ProviderConfigurationError
from app.remotion.animation_service import animation_service

pytestmark = pytest.mark.asyncio


async def test_chat_sessions_are_isolated_by_platform_and_problem(client, monkeypatch):
    calls = []

    async def fake_chat(**kwargs):
        calls.append(kwargs)
        return {"content": "ok", "animation_id": None}

    monkeypatch.setattr(router_module.coach, "chat", fake_chat)
    for platform, problem in [("LEETCODE", "1"), ("HDU", "1"), ("HDU", "2"), ("HDU", "1")]:
        response = await client.post("/chat", json={
            "message": "hi", "mode": "PREP", "platform": platform, "problemId": problem,
        })
        assert response.status_code == 200

    sessions = [call["session_id"] for call in calls]
    assert len(set(sessions[:3])) == 3
    assert sessions[1] == sessions[3]
    assert calls[1]["platform"] == "HDU"


async def test_chat_separates_page_conversations(client, monkeypatch):
    sessions = []

    async def fake_chat(**kwargs):
        sessions.append(kwargs["session_id"])
        return {"content": "ok", "animation_id": None}

    monkeypatch.setattr(router_module.coach, "chat", fake_chat)
    for conversation in ("first-page", "second-page", "first-page"):
        response = await client.post("/chat", json={
            "message": "hi", "mode": "IDLE", "conversationId": conversation,
        })
        assert response.status_code == 200
    assert sessions[0] != sessions[1]
    assert sessions[0] == sessions[2]


async def test_chat_mode_transitions_keep_one_coaching_conversation(client, monkeypatch):
    sessions = []

    async def fake_chat(**kwargs):
        sessions.append(kwargs["session_id"])
        return {"content": "ok", "animation_id": None}

    monkeypatch.setattr(router_module.coach, "chat", fake_chat)
    for mode in ("IDLE", "PREP", "REVIEW", "IDLE"):
        response = await client.post("/chat", json={
            "message": "hi", "mode": mode, "conversationId": "same-page",
        })
        assert response.status_code == 200

    assert len(set(sessions)) == 1


async def test_legacy_clients_keep_mode_transitions_in_one_session(client, monkeypatch):
    sessions = []

    async def fake_chat(**kwargs):
        sessions.append(kwargs["session_id"])
        return {"content": "ok", "animation_id": None}

    monkeypatch.setattr(router_module.coach, "chat", fake_chat)
    for mode in ("IDLE", "PREP", "REVIEW"):
        response = await client.post("/chat", json={"message": "hi", "mode": mode})
        assert response.status_code == 200

    assert len(set(sessions)) == 1


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


async def test_provider_configuration_error_has_a_stable_repair_code(client, monkeypatch):
    async def missing_key(**_kwargs):
        raise ProviderConfigurationError(
            "provider_api_key_required",
            "当前 Provider 需要 API key，请在设置页配置",
        )

    monkeypatch.setattr(router_module.coach, "chat", missing_key)
    response = await client.post("/chat", json={"message": "hi", "mode": "IDLE"})

    assert response.status_code == 400
    assert response.json() == {
        "detail": {
            "code": "provider_api_key_required",
            "message": "当前 Provider 需要 API key，请在设置页配置",
        },
    }


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
