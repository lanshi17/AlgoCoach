"""Workspace-scoped, deterministic Mastery Path coverage."""

import json
from datetime import timedelta

import pytest
from sqlalchemy import select

from app.agent.coach import TOOLS, AlgoCoach
from app.memory.db import ReviewSchedule, SemanticNode, SessionLocal
from app.memory.memory_service import memory, utcnow

pytestmark = pytest.mark.asyncio


async def test_empty_path_explains_that_training_evidence_is_needed(client):
    response = await client.get("/memory/mastery-path")

    assert response.status_code == 200
    payload = response.json()
    assert payload["workspaceId"] == "local-default"
    assert payload["steps"] == []
    assert "完成一次练习" in payload["emptyReason"]
    assert payload["sourceSummary"] == {"topics": 0, "dueReviews": 0}


async def test_path_prioritises_due_work_and_keeps_workspaces_isolated(client):
    now = utcnow()
    async with SessionLocal() as session:
        session.add_all([
            SemanticNode(
                topic="path-a\x1fWeak", workspace_id="path-a", mastery=0.2,
                attempts=3, last_seen=now.isoformat(), weak_subtopics='["边界" ]',
            ),
            SemanticNode(
                topic="path-a\x1fDueStrong", workspace_id="path-a", mastery=0.85,
                attempts=8, last_seen=now.isoformat(),
            ),
            SemanticNode(
                topic="path-b\x1fOnlyB", workspace_id="path-b", mastery=0.1,
                attempts=1, last_seen=now.isoformat(),
            ),
            ReviewSchedule(
                problem_id="path-a\x1fold-problem", workspace_id="path-a",
                due_at=(now - timedelta(days=1)).isoformat(), interval_days=1,
                mastery=0.85, attempts=8, topics=json.dumps(["DueStrong"]),
                source_episode_id=None, notified_on="", last_notified_at="",
                updated_at=now.isoformat(),
            ),
        ])
        await session.commit()

    response = await client.get("/memory/mastery-path?workspaceId=path-a&limit=3")
    assert response.status_code == 200
    payload = response.json()
    assert payload["workspaceId"] == "path-a"
    assert [step["topic"] for step in payload["steps"]] == [
        "DueStrong", "Weak",
    ]
    assert payload["steps"][0]["recommendedAction"] == "review"
    assert payload["steps"][0]["dueReviews"][0]["problemId"] == "old-problem"
    assert payload["steps"][1]["recommendedAction"] == "reinforce"
    assert "边界" in payload["steps"][1]["reason"]

    other = await client.get("/memory/mastery-path?workspaceId=path-b")
    assert [step["topic"] for step in other.json()["steps"]] == ["OnlyB"]


async def test_path_orders_lowest_mastery_first_without_due_reviews():
    now = utcnow()
    await memory._ensure_topic("mid", "path-order")
    await memory._ensure_topic("weak", "path-order")
    async with SessionLocal() as session:
        rows = list((await session.execute(
            select(SemanticNode).where(
                SemanticNode.workspace_id == "path-order"
            )
        )).scalars())
        for row in rows:
            row.mastery = 0.55 if row.topic.endswith("mid") else 0.15
        await session.commit()

    payload = await memory.mastery_path(now=now, workspace_id="path-order", limit=2)
    assert [step["topic"] for step in payload["steps"]] == ["weak", "mid"]


async def test_mastery_path_tool_is_registered_and_workspace_scoped():
    tool = next(item for item in TOOLS if item["name"] == "get_mastery_path")
    assert tool["input_schema"]["properties"]["limit"]["maximum"] == 12

    agent = AlgoCoach()
    result = await agent._execute_tool("get_mastery_path", {"limit": 2}, None)
    assert result["workspaceId"] == "local-default"
    assert "steps" in result
