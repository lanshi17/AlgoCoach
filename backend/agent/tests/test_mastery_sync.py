"""Contract tests for cross-device mastery and review-schedule sync."""
import json

import pytest
from sqlalchemy import select

from app.memory.db import EpisodicRecord, ReviewSchedule, SemanticNode, SessionLocal

pytestmark = pytest.mark.asyncio

VALID_BUNDLE = {
    "format": "algocoach-mastery-v2",
    "workspaceId": "remote-device",
    "exportedAt": "2026-01-01T00:00:00",
    "topics": [
        {"topic": "Array", "mastery": 0.6, "attempts": 5, "lastSeen": "2026-02-01T00:00:00"},
        {"topic": "Graph", "mastery": 0.4, "attempts": 2, "lastSeen": "2026-01-20T00:00:00"},
    ],
    "reviewSchedules": [
        {
            "problemId": "two-sum", "dueAt": "2026-02-10T00:00:00", "intervalDays": 5,
            "mastery": 0.6, "attempts": 5, "topics": ["Array"],
            "updatedAt": "2026-02-05T00:00:00",
        },
    ],
}

V1_BUNDLE = {
    "format": "algocoach-mastery-v1",
    "workspaceId": "remote-device",
    "exportedAt": "2026-01-01T00:00:00",
    "topics": [{"topic": "Array", "mastery": 0.6, "attempts": 5, "lastSeen": "2026-02-01T00:00:00"}],
}


async def _seed(topic: str, mastery: float, attempts: int, last_seen: str, workspace_id: str = "local-default"):
    async with SessionLocal() as session:
        session.add(SemanticNode(
            topic=topic, workspace_id=workspace_id, mastery=mastery,
            attempts=attempts, last_seen=last_seen,
        ))
        await session.commit()


async def _seed_schedule(
    problem_id: str, due_at: str, interval_days: int, mastery: float,
    attempts: int, topics: list[str], updated_at: str,
    workspace_id: str = "local-default", notified_on: str = "", last_notified_at: str = "",
):
    async with SessionLocal() as session:
        session.add(ReviewSchedule(
            problem_id=problem_id, workspace_id=workspace_id, due_at=due_at,
            interval_days=interval_days, mastery=mastery, attempts=attempts,
            topics=json.dumps(topics), source_episode_id=None,
            notified_on=notified_on, last_notified_at=last_notified_at,
            updated_at=updated_at,
        ))
        await session.commit()


async def _nodes(workspace_id: str = "local-default") -> dict[str, SemanticNode]:
    async with SessionLocal() as session:
        rows = (await session.execute(
            select(SemanticNode).where(SemanticNode.workspace_id == workspace_id)
        )).scalars()
        return {node.topic: node for node in rows}


async def _schedules(workspace_id: str = "local-default") -> dict[str, ReviewSchedule]:
    async with SessionLocal() as session:
        rows = (await session.execute(
            select(ReviewSchedule).where(ReviewSchedule.workspace_id == workspace_id)
        )).scalars()
        return {schedule.problem_id: schedule for schedule in rows}


async def test_export_returns_sorted_topics_and_review_schedules(client):
    await _seed("Graph", 0.4, 2, "2026-01-20T00:00:00")
    await _seed("Array", 0.6, 5, "2026-02-01T00:00:00")
    await _seed_schedule("two-sum", "2026-02-10T00:00:00", 5, 0.6, 5, ["Array"], "2026-02-05T00:00:00")

    response = await client.get("/memory/mastery-export")

    assert response.status_code == 200
    body = response.json()
    assert body["format"] == "algocoach-mastery-v2"
    assert body["workspaceId"] == "local-default"
    assert [topic["topic"] for topic in body["topics"]] == ["Array", "Graph"]
    assert body["topics"][0] == {
        "topic": "Array", "mastery": 0.6, "attempts": 5,
        "lastSeen": "2026-02-01T00:00:00",
    }
    assert body["reviewSchedules"] == [{
        "problemId": "two-sum", "dueAt": "2026-02-10T00:00:00", "intervalDays": 5,
        "mastery": 0.6, "attempts": 5, "topics": ["Array"],
        "updatedAt": "2026-02-05T00:00:00",
    }]


async def test_import_merges_new_and_larger_values_and_is_idempotent(client):
    await _seed("Array", 0.55, 3, "2026-01-01T00:00:00")

    first = await client.post("/memory/mastery-import", json=VALID_BUNDLE)
    assert first.status_code == 200
    assert first.json() == {
        "ok": True, "workspaceId": "local-default",
        "imported": 1, "updated": 1, "unchanged": 0,
        "schedulesImported": 1, "schedulesUpdated": 0, "schedulesUnchanged": 0,
    }

    nodes = await _nodes()
    assert nodes["Array"].mastery == pytest.approx(0.6)
    assert nodes["Array"].attempts == 5
    assert nodes["Array"].last_seen == "2026-02-01T00:00:00"
    assert nodes["Graph"].mastery == pytest.approx(0.4)
    schedule = (await _schedules())["two-sum"]
    assert schedule.due_at == "2026-02-10T00:00:00"
    assert schedule.interval_days == 5
    assert schedule.source_episode_id is None

    second = await client.post("/memory/mastery-import", json=VALID_BUNDLE)
    assert second.status_code == 200
    assert second.json()["imported"] == 0
    assert second.json()["updated"] == 0
    assert second.json()["unchanged"] == 2
    assert second.json()["schedulesUnchanged"] == 1


async def test_import_never_lowers_local_mastery_or_attempts(client):
    await _seed("Array", 0.8, 9, "2026-03-01T00:00:00")

    response = await client.post("/memory/mastery-import", json={
        **VALID_BUNDLE,
        "topics": [{"topic": "Array", "mastery": 0.2, "attempts": 1, "lastSeen": "2026-01-01T00:00:00"}],
        "reviewSchedules": [],
    })

    assert response.status_code == 200
    assert response.json()["unchanged"] == 1
    node = (await _nodes())["Array"]
    assert node.mastery == pytest.approx(0.8)
    assert node.attempts == 9
    assert node.last_seen == "2026-03-01T00:00:00"


async def test_newer_schedule_replaces_state_but_keeps_local_notifications(client):
    await _seed_schedule(
        "two-sum", "2026-01-01T00:00:00", 2, 0.3, 2, ["Array"], "2026-01-01T00:00:00",
        notified_on="2026-01-02", last_notified_at="2026-01-02T09:00:00",
    )

    response = await client.post("/memory/mastery-import", json=VALID_BUNDLE)

    assert response.status_code == 200
    assert response.json()["schedulesUpdated"] == 1
    schedule = (await _schedules())["two-sum"]
    assert schedule.due_at == "2026-02-10T00:00:00"
    assert schedule.interval_days == 5
    assert schedule.mastery == pytest.approx(0.6)
    assert schedule.attempts == 5
    assert schedule.notified_on == "2026-01-02"
    assert schedule.last_notified_at == "2026-01-02T09:00:00"


async def test_older_schedule_is_ignored(client):
    await _seed_schedule(
        "two-sum", "2026-03-01T00:00:00", 8, 0.7, 6, ["Array"], "2026-03-01T00:00:00",
    )

    response = await client.post("/memory/mastery-import", json=VALID_BUNDLE)

    assert response.status_code == 200
    assert response.json()["schedulesUnchanged"] == 1
    schedule = (await _schedules())["two-sum"]
    assert schedule.due_at == "2026-03-01T00:00:00"
    assert schedule.updated_at == "2026-03-01T00:00:00"


async def test_import_targets_the_query_workspace_only(client):
    response = await client.post(
        "/memory/mastery-import?workspaceId=contest",
        json=VALID_BUNDLE,
    )

    assert response.status_code == 200
    assert response.json()["workspaceId"] == "contest"
    assert await _nodes() == {}
    assert set(await _nodes("contest")) == {"contest\x1fArray", "contest\x1fGraph"}
    assert set(await _schedules("contest")) == {"contest\x1ftwo-sum"}


async def test_v1_bundle_imports_topics_without_touching_review_schedules(client):
    response = await client.post("/memory/mastery-import", json=V1_BUNDLE)

    assert response.status_code == 200
    assert response.json()["schedulesImported"] == 0
    assert response.json()["schedulesUpdated"] == 0
    assert response.json()["schedulesUnchanged"] == 0
    async with SessionLocal() as session:
        assert (await session.execute(select(EpisodicRecord))).scalars().all() == []
        assert (await session.execute(select(ReviewSchedule))).scalars().all() == []


async def test_sync_endpoint_is_disabled_without_a_token(client, monkeypatch):
    monkeypatch.delenv("ALGOCOACH_SYNC_TOKEN", raising=False)
    response = await client.post("/memory/sync", json=VALID_BUNDLE, headers={"x-algocoach-sync-token": "secret"})
    assert response.status_code == 503


async def test_sync_endpoint_rejects_a_wrong_token(client, monkeypatch):
    monkeypatch.setenv("ALGOCOACH_SYNC_TOKEN", "secret")
    response = await client.post("/memory/sync", json=VALID_BUNDLE, headers={"x-algocoach-sync-token": "wrong"})
    assert response.status_code == 403
    assert await _nodes() == {}


async def test_sync_endpoint_merges_and_returns_the_hub_bundle(client, monkeypatch):
    monkeypatch.setenv("ALGOCOACH_SYNC_TOKEN", "secret")
    await _seed("Array", 0.55, 3, "2026-01-01T00:00:00")

    response = await client.post(
        "/memory/sync",
        json=VALID_BUNDLE,
        headers={"x-algocoach-sync-token": "secret"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert body["schedulesImported"] == 1
    assert body["bundle"]["format"] == "algocoach-mastery-v2"
    assert [topic["topic"] for topic in body["bundle"]["topics"]] == ["Array", "Graph"]
    assert body["bundle"]["reviewSchedules"][0]["problemId"] == "two-sum"
    assert (await _nodes())["Array"].mastery == pytest.approx(0.6)
    assert (await _schedules())["two-sum"].updated_at == "2026-02-05T00:00:00"


@pytest.mark.parametrize("payload", [
    {**VALID_BUNDLE, "format": "other-format"},
    {**VALID_BUNDLE, "topics": [{"topic": "Array", "mastery": 1.2, "attempts": 1, "lastSeen": ""}]},
    {**VALID_BUNDLE, "topics": [{"topic": " ", "mastery": 0.5, "attempts": 1, "lastSeen": ""}]},
    {**VALID_BUNDLE, "topics": "Array"},
    {**VALID_BUNDLE, "reviewSchedules": [{"problemId": "x", "dueAt": "not-a-date", "intervalDays": 1, "mastery": 0.5, "attempts": 1, "topics": [], "updatedAt": "2026-01-01T00:00:00"}]},
    {**VALID_BUNDLE, "reviewSchedules": [{"problemId": "x", "dueAt": "2026-01-01T00:00:00", "intervalDays": 0, "mastery": 0.5, "attempts": 1, "topics": [], "updatedAt": "2026-01-01T00:00:00"}]},
])
async def test_invalid_bundles_are_rejected(client, payload):
    response = await client.post("/memory/mastery-import", json=payload)

    assert response.status_code == 422
    assert await _nodes() == {}
    assert await _schedules() == {}
