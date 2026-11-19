"""Contract tests for ``POST /memory/record``.

Covers the gateway-facing request/response shape, episodic persistence, the
semantic-mastery side effect, and the input validation the plan requires.
"""
import json

import pytest
from sqlalchemy import select

from app.memory.db import EpisodicRecord, SemanticNode, SessionLocal

pytestmark = pytest.mark.asyncio

VALID_PAYLOAD = {
    "problem_id": "two-sum",
    "platform": "LEETCODE",
    "status": "ACCEPTED",
    "lang": "rust",
    "duration_sec": 480,
    "topics": ["Array", "Hash Table"],
}


async def _episodes() -> list[EpisodicRecord]:
    async with SessionLocal() as session:
        result = await session.execute(select(EpisodicRecord))
        return list(result.scalars())


async def _mastery() -> dict[str, SemanticNode]:
    async with SessionLocal() as session:
        result = await session.execute(select(SemanticNode))
        return {node.topic: node for node in result.scalars()}


async def test_record_persists_episode_and_updates_mastery(client):
    resp = await client.post("/memory/record", json=VALID_PAYLOAD)

    assert resp.status_code == 200
    assert resp.json() == {"ok": True}

    episodes = await _episodes()
    assert len(episodes) == 1
    episode = episodes[0]
    assert episode.problem_id == "two-sum"
    assert episode.platform == "LEETCODE"
    assert episode.status == "ACCEPTED"
    assert episode.lang == "rust"
    assert episode.duration_sec == 480
    assert json.loads(episode.topics) == ["Array", "Hash Table"]
    # The gateway callback has no sticking points; REVIEW fills them later.
    assert json.loads(episode.sticking_points) == []

    nodes = await _mastery()
    assert set(nodes) == {"Array", "Hash Table"}
    for node in nodes.values():
        assert node.mastery == pytest.approx(0.55)
        assert node.attempts == 1


async def test_non_accepted_submission_lowers_mastery(client):
    payload = {
        **VALID_PAYLOAD,
        "problem_id": "climb-stairs",
        "status": "WRONG_ANSWER",
        "topics": ["DP"],
    }
    resp = await client.post("/memory/record", json=payload)

    assert resp.status_code == 200
    nodes = await _mastery()
    assert nodes["DP"].mastery == pytest.approx(0.42)
    assert nodes["DP"].attempts == 1


async def test_existing_topic_is_incremented(client):
    async with SessionLocal() as session:
        session.add(SemanticNode(topic="BFS", mastery=0.5, attempts=2, last_seen=""))
        await session.commit()

    resp = await client.post(
        "/memory/record", json={**VALID_PAYLOAD, "topics": ["BFS"]}
    )

    assert resp.status_code == 200
    node = (await _mastery())["BFS"]
    assert node.mastery == pytest.approx(0.55)
    assert node.attempts == 3


@pytest.mark.parametrize(
    "payload",
    [
        {**VALID_PAYLOAD, "duration_sec": -1},
        {**VALID_PAYLOAD, "problem_id": "   "},
        {**VALID_PAYLOAD, "platform": ""},
        {**VALID_PAYLOAD, "status": ""},
        {**VALID_PAYLOAD, "lang": ""},
        {**VALID_PAYLOAD, "topics": "BFS"},
        {**VALID_PAYLOAD, "topics": [1, 2]},
        {**VALID_PAYLOAD, "topics": ["BFS", "  "]},
    ],
)
async def test_invalid_payload_is_rejected_without_writing(client, payload):
    resp = await client.post("/memory/record", json=payload)

    assert resp.status_code == 422
    assert await _episodes() == []
    assert await _mastery() == {}


@pytest.mark.parametrize(
    "missing",
    ["problem_id", "platform", "status", "lang", "duration_sec", "topics"],
)
async def test_missing_required_field_is_rejected(client, missing):
    payload = {k: v for k, v in VALID_PAYLOAD.items() if k != missing}

    resp = await client.post("/memory/record", json=payload)

    assert resp.status_code == 422
    assert await _episodes() == []

async def test_local_practice_is_recorded_without_penalising_mastery(client):
    resp = await client.post('/memory/record', json={
        **VALID_PAYLOAD, 'problem_id': 'local-two-sum', 'platform': 'LOCAL',
        'status': 'LOCAL_PRACTICE', 'lang': 'unknown', 'topics': ['Array'],
    })
    assert resp.status_code == 200
    nodes = await _mastery()
    assert nodes['Array'].mastery == pytest.approx(0.5)
    assert nodes['Array'].attempts == 0

async def test_client_id_makes_memory_record_idempotent(client):
    payload = {**VALID_PAYLOAD, 'platform': 'LOCAL', 'status': 'LOCAL_PRACTICE', 'client_id': 'local-sync-1'}
    first = await client.post('/memory/record', json=payload)
    second = await client.post('/memory/record', json=payload)
    assert first.status_code == second.status_code == 200
    assert len(await _episodes()) == 1

@pytest.mark.parametrize(
    ('status', 'expected_mastery'),
    [('LOCAL_ACCEPTED', 0.55), ('LOCAL_FAILED', 0.42)],
)
async def test_local_run_outcome_updates_mastery_only_when_a_result_exists(client, status, expected_mastery):
    resp = await client.post('/memory/record', json={
        **VALID_PAYLOAD, 'problem_id': 'local-two-sum', 'platform': 'LOCAL',
        'status': status, 'lang': 'python3', 'topics': ['Array'],
    })
    assert resp.status_code == 200
    assert (await _mastery())['Array'].mastery == pytest.approx(expected_mastery)
