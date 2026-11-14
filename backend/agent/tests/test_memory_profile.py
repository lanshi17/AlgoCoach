"""Tests for the local aggregate profile used by progress and graph views."""
import json
from datetime import timedelta

import pytest

from app.memory.db import EpisodicRecord, SemanticNode, SessionLocal
from app.memory.memory_service import utcnow

pytestmark = pytest.mark.asyncio


async def test_profile_returns_observed_topics_edges_and_progress(client):
    now = utcnow()
    async with SessionLocal() as session:
        session.add_all([
            SemanticNode(topic="DP", mastery=0.4, attempts=2, last_seen=now.isoformat()),
            SemanticNode(topic="Graph", mastery=0.7, attempts=1, last_seen=now.isoformat()),
            SemanticNode(topic="Greedy", mastery=0.55, attempts=1, last_seen=now.isoformat()),
        ])
        session.add_all([
            EpisodicRecord(
                problem_id="today-problem", platform="LEETCODE", status="ACCEPTED",
                lang="cpp", duration_sec=100, topics=json.dumps(["DP", "Graph"]),
                sticking_points="[]", created_at=now.isoformat(),
            ),
            EpisodicRecord(
                problem_id="yesterday-problem", platform="LEETCODE", status="WRONG_ANSWER",
                lang="cpp", duration_sec=300, topics=json.dumps(["DP", "Greedy"]),
                sticking_points="[]", created_at=(now - timedelta(days=1)).isoformat(),
            ),
        ])
        await session.commit()

    response = await client.get("/memory/profile")

    assert response.status_code == 200
    profile = response.json()
    assert {topic["topic"] for topic in profile["topics"]} == {"DP", "Graph", "Greedy"}
    assert {(edge["from"], edge["to"], edge["weight"]) for edge in profile["edges"]} == {
        ("DP", "Graph", 1), ("DP", "Greedy", 1),
    }
    assert profile["stats"] == {
        "totalAttempts": 2, "accepted": 1, "averageDurationSec": 200, "streakDays": 2,
    }
    assert [item["problemId"] for item in profile["recentProblems"]] == [
        "today-problem", "yesterday-problem",
    ]
    assert len(profile["dailyAttempts"]) == 35
    assert sum(day["count"] for day in profile["dailyAttempts"]) == 2


async def test_empty_profile_has_zero_stats_and_empty_graph(client):
    response = await client.get("/memory/profile")

    assert response.status_code == 200
    assert response.json()["topics"] == []
    assert response.json()["edges"] == []
    assert response.json()["stats"] == {
        "totalAttempts": 0, "accepted": 0, "averageDurationSec": 0, "streakDays": 0,
    }
    assert len(response.json()["dailyAttempts"]) == 35
