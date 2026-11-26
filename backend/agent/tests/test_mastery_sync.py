"""Contract tests for cross-device mastery export/import."""
import pytest
from sqlalchemy import select

from app.memory.db import EpisodicRecord, ReviewSchedule, SemanticNode, SessionLocal

pytestmark = pytest.mark.asyncio

VALID_BUNDLE = {
    "format": "algocoach-mastery-v1",
    "workspaceId": "remote-device",
    "exportedAt": "2026-01-01T00:00:00",
    "topics": [
        {"topic": "Array", "mastery": 0.6, "attempts": 5, "lastSeen": "2026-02-01T00:00:00"},
        {"topic": "Graph", "mastery": 0.4, "attempts": 2, "lastSeen": "2026-01-20T00:00:00"},
    ],
}


async def _seed(topic: str, mastery: float, attempts: int, last_seen: str, workspace_id: str = "local-default"):
    async with SessionLocal() as session:
        session.add(SemanticNode(
            topic=topic, workspace_id=workspace_id, mastery=mastery,
            attempts=attempts, last_seen=last_seen,
        ))
        await session.commit()


async def _nodes(workspace_id: str = "local-default") -> dict[str, SemanticNode]:
    async with SessionLocal() as session:
        rows = (await session.execute(
            select(SemanticNode).where(SemanticNode.workspace_id == workspace_id)
        )).scalars()
        return {node.topic: node for node in rows}


async def test_export_returns_a_sorted_topic_bundle(client):
    await _seed("Graph", 0.4, 2, "2026-01-20T00:00:00")
    await _seed("Array", 0.6, 5, "2026-02-01T00:00:00")

    response = await client.get("/memory/mastery-export")

    assert response.status_code == 200
    body = response.json()
    assert body["format"] == "algocoach-mastery-v1"
    assert body["workspaceId"] == "local-default"
    assert [topic["topic"] for topic in body["topics"]] == ["Array", "Graph"]
    assert body["topics"][0] == {
        "topic": "Array", "mastery": 0.6, "attempts": 5,
        "lastSeen": "2026-02-01T00:00:00",
    }


async def test_import_merges_new_and_larger_values_and_is_idempotent(client):
    await _seed("Array", 0.55, 3, "2026-01-01T00:00:00")

    first = await client.post("/memory/mastery-import", json=VALID_BUNDLE)
    assert first.status_code == 200
    assert first.json() == {
        "ok": True, "workspaceId": "local-default",
        "imported": 1, "updated": 1, "unchanged": 0,
    }

    nodes = await _nodes()
    assert nodes["Array"].mastery == pytest.approx(0.6)
    assert nodes["Array"].attempts == 5
    assert nodes["Array"].last_seen == "2026-02-01T00:00:00"
    assert nodes["Graph"].mastery == pytest.approx(0.4)

    second = await client.post("/memory/mastery-import", json=VALID_BUNDLE)
    assert second.status_code == 200
    assert second.json()["imported"] == 0
    assert second.json()["updated"] == 0
    assert second.json()["unchanged"] == 2


async def test_import_never_lowers_local_mastery_or_attempts(client):
    await _seed("Array", 0.8, 9, "2026-03-01T00:00:00")

    response = await client.post("/memory/mastery-import", json={
        **VALID_BUNDLE,
        "topics": [{"topic": "Array", "mastery": 0.2, "attempts": 1, "lastSeen": "2026-01-01T00:00:00"}],
    })

    assert response.status_code == 200
    assert response.json()["unchanged"] == 1
    node = (await _nodes())["Array"]
    assert node.mastery == pytest.approx(0.8)
    assert node.attempts == 9
    assert node.last_seen == "2026-03-01T00:00:00"


async def test_import_targets_the_query_workspace_only(client):
    response = await client.post(
        "/memory/mastery-import?workspaceId=contest",
        json=VALID_BUNDLE,
    )

    assert response.status_code == 200
    assert response.json()["workspaceId"] == "contest"
    assert await _nodes() == {}
    assert set(await _nodes("contest")) == {"contest\x1fArray", "contest\x1fGraph"}


async def test_import_does_not_create_episodes_or_review_schedules(client):
    response = await client.post("/memory/mastery-import", json=VALID_BUNDLE)
    assert response.status_code == 200
    async with SessionLocal() as session:
        assert (await session.execute(select(EpisodicRecord))).scalars().all() == []
        assert (await session.execute(select(ReviewSchedule))).scalars().all() == []


@pytest.mark.parametrize("payload", [
    {**VALID_BUNDLE, "format": "other-format"},
    {**VALID_BUNDLE, "topics": [{"topic": "Array", "mastery": 1.2, "attempts": 1, "lastSeen": ""}]},
    {**VALID_BUNDLE, "topics": [{"topic": " ", "mastery": 0.5, "attempts": 1, "lastSeen": ""}]},
    {**VALID_BUNDLE, "topics": "Array"},
])
async def test_invalid_bundles_are_rejected(client, payload):
    response = await client.post("/memory/mastery-import", json=payload)

    assert response.status_code == 422
    assert await _nodes() == {}
