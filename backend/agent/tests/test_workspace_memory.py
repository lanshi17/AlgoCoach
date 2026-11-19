"""Workspace boundaries for the local agent memory store."""

import json
from datetime import timedelta

import pytest
from sqlalchemy import select

from app.memory.db import EpisodicRecord, SemanticNode, SessionLocal
from app.memory.memory_service import memory, utcnow

pytestmark = pytest.mark.asyncio


PAYLOAD = {
    "problem_id": "two-sum",
    "platform": "LEETCODE",
    "status": "ACCEPTED",
    "lang": "rust",
    "duration_sec": 60,
    "topics": ["Array"],
}


async def test_attempts_and_mastery_are_isolated_by_workspace(client):
    first = await client.post(
        "/memory/record",
        json={**PAYLOAD, "workspaceId": "workspace-a", "client_id": "same-id"},
    )
    second = await client.post(
        "/memory/record",
        json={**PAYLOAD, "workspaceId": "workspace-b", "client_id": "same-id"},
    )

    assert first.status_code == second.status_code == 200
    async with SessionLocal() as session:
        episodes = list((await session.execute(select(EpisodicRecord))).scalars())
        nodes = list((await session.execute(select(SemanticNode))).scalars())
    assert {episode.workspace_id for episode in episodes} == {"workspace-a", "workspace-b"}
    assert {(node.workspace_id, node.topic) for node in nodes} == {
        ("workspace-a", "workspace-a\x1fArray"),
        ("workspace-b", "workspace-b\x1fArray"),
    }

    profile_a = await client.get("/memory/profile?workspaceId=workspace-a")
    profile_b = await client.get("/memory/profile?workspaceId=workspace-b")
    profile_default = await client.get("/memory/profile")
    assert profile_a.json()["stats"]["totalAttempts"] == 1
    assert profile_b.json()["stats"]["totalAttempts"] == 1
    assert profile_a.json()["topics"][0]["topic"] == "Array"
    assert profile_b.json()["topics"][0]["topic"] == "Array"
    assert profile_default.json()["stats"]["totalAttempts"] == 0


async def test_workspace_client_id_is_idempotent_only_inside_its_workspace():
    kwargs = {**PAYLOAD, "sticking_points": []}
    assert await memory.record_attempt(**kwargs, client_id="same-id", workspace_id="a")
    assert not await memory.record_attempt(**kwargs, client_id="same-id", workspace_id="a")
    assert await memory.record_attempt(**kwargs, client_id="same-id", workspace_id="b")

    async with SessionLocal() as session:
        rows = list((await session.execute(select(EpisodicRecord))).scalars())
    assert len(rows) == 2
    assert {row.workspace_id for row in rows} == {"a", "b"}


async def test_workspace_export_filters_structured_rows(client):
    await client.post(
        "/memory/record",
        json={**PAYLOAD, "workspaceId": "workspace-a"},
    )
    response = await client.get("/memory/export?workspaceId=workspace-a")
    assert response.status_code == 200
    from io import BytesIO
    from zipfile import ZipFile

    with ZipFile(BytesIO(response.content)) as archive:
        snapshot = json.loads(archive.read("memory.json"))
    assert snapshot["workspace_id"] == "workspace-a"
    assert {row["workspace_id"] for row in snapshot["tables"]["episodic"]} == {
        "workspace-a"
    }
    assert snapshot["tables"]["episodic_archive"] == []


async def test_review_queue_and_recommendation_baseline_stay_in_workspace():
    now = utcnow()
    kwargs = {
        **PAYLOAD,
        "status": "WRONG_ANSWER",
        "sticking_points": [],
    }
    await memory.record_attempt(**kwargs, workspace_id="workspace-a")
    await memory.record_attempt(
        **{**kwargs, "problem_id": "other"}, workspace_id="workspace-b"
    )

    due_a = await memory.due_reviews(
        now=now + timedelta(days=3), workspace_id="workspace-a"
    )
    due_b = await memory.due_reviews(
        now=now + timedelta(days=3), workspace_id="workspace-b"
    )
    assert [item["problem_id"] for item in due_a] == ["two-sum"]
    assert [item["problem_id"] for item in due_b] == ["other"]
    assert await memory.due_reviews(
        now=now + timedelta(days=3), workspace_id="local-default"
    ) == []
