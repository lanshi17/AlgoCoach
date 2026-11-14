"""Tests for P2 self-improve recommendation logging and 7-day backtesting.

Every test uses the isolated SQLite database created by ``conftest.py``. The
vector store is replaced with a deterministic fake (or an unavailable stub), so
no Chroma embedding model, network request or LLM call is made.
"""
import asyncio
import json
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select, text

from app.agent import crons, self_improve
from app.agent.coach import TOOLS, AlgoCoach
from app.agent.self_improve import (
    EVALUATION_WINDOW_DAYS,
    MAX_RECOMMENDATIONS,
    OUTCOME_ABANDONED,
    OUTCOME_DECLINED,
    OUTCOME_IMPROVED,
    OUTCOME_NEUTRAL,
    STRATEGY_DUE_REVIEW,
    STRATEGY_SIMILAR_PROBLEM,
    STRATEGY_TOPIC_ONLY,
    evaluate_due_recommendations,
    evaluate_recommendation,
    log_recommendation,
    monthly_strategy_review,
    suggest_next_problem,
)
from app.memory.db import (
    EpisodicRecord,
    Notification,
    RecommendationLog,
    SemanticNode,
    SessionLocal,
    engine,
    init_db,
)
from app.memory.memory_service import memory
from app.memory.vector_store import VectorStoreUnavailable

NOW = datetime(2026, 11, 12, 12, 0, 0)


# ── Helpers ───────────────────────────────────────────────────


def _iso(value: datetime) -> str:
    return value.replace(microsecond=0).isoformat()


async def _seed_mastery(topic: str, mastery: float, attempts: int = 2) -> None:
    async with SessionLocal() as session:
        session.add(SemanticNode(
            topic=topic, mastery=mastery, attempts=attempts, last_seen=""
        ))
        await session.commit()


async def _seed_episode(
    problem_id: str,
    *,
    created_at: datetime,
    topics: list[str],
    status: str = "WRONG_ANSWER",
) -> None:
    async with SessionLocal() as session:
        session.add(EpisodicRecord(
            problem_id=problem_id,
            platform="LEETCODE",
            status=status,
            lang="rust",
            duration_sec=120,
            topics=json.dumps(topics),
            sticking_points="[]",
            created_at=_iso(created_at),
        ))
        await session.commit()


async def _log(
    strategy: str,
    topic: str,
    problem_id: str | None = None,
    before: float | None = None,
    created_at: datetime = NOW,
) -> dict:
    return await log_recommendation(
        strategy, topic, problem_id=problem_id, mastery_before=before,
        now=created_at,
    )


async def _rows() -> list[RecommendationLog]:
    async with SessionLocal() as session:
        return list(
            (
                await session.execute(
                    select(RecommendationLog).order_by(RecommendationLog.id)
                )
            ).scalars()
        )


async def _row(rec_id: int) -> RecommendationLog | None:
    async with SessionLocal() as session:
        return await session.get(RecommendationLog, rec_id)


async def _mark_evaluated(
    rec_id: int, *, score: int, outcome: str, evaluated_at: datetime
) -> None:
    async with SessionLocal() as session:
        row = await session.get(RecommendationLog, rec_id)
        row.score = score
        row.outcome = outcome
        row.evaluated_at = _iso(evaluated_at)
        await session.commit()



class FakeVectorStore:
    """Deterministic local vector-memory stand-in; no model, no network."""

    def __init__(self, mapping: dict | None = None, error: Exception | None = None):
        self.mapping = mapping or {}
        self.error = error
        self.queries: list[tuple[str, int]] = []

    async def find_similar_problems(self, text: str, top_k: int = 5):
        self.queries.append((text, top_k))
        if self.error is not None:
            raise self.error
        return list(self.mapping.get(text, []))


def _problem_result(slug: str) -> dict:
    return {
        "id": slug,
        "document": "statement",
        "metadata": {"problem_id": slug, "title": slug},
        "distance": 0.1,
    }


def _field(trigger, name: str) -> list[str]:
    for field in trigger.fields:
        if field.name == name:
            return [str(expression) for expression in field.expressions]
    raise AssertionError(f"missing trigger field {name}")


# ── Schema / migration ────────────────────────────────────────


@pytest.mark.asyncio
async def test_recommendation_log_migration_is_rerunnable_and_preserves_rows():
    legacy_created = NOW - timedelta(days=8)
    async with engine.begin() as conn:
        await conn.execute(text("DROP TABLE recommendation_log"))
        await conn.execute(text(
            "CREATE TABLE recommendation_log ("
            "id INTEGER PRIMARY KEY AUTOINCREMENT, "
            "topic VARCHAR(64) NOT NULL, "
            "problem_id VARCHAR(64), "
            "mastery_before FLOAT NOT NULL, "
            "created_at VARCHAR(32) NOT NULL, "
            "evaluated_at VARCHAR(32), "
            "score INTEGER)"
        ))
        await conn.execute(
            text(
                "INSERT INTO recommendation_log "
                "(topic, problem_id, mastery_before, created_at) "
                "VALUES ('DP', 'coin-change', 0.5, :created)"
            ),
            {"created": _iso(legacy_created)},
        )
        # A row evaluated by the previous revision keeps its score and must
        # not gain a fabricated audit snapshot.
        await conn.execute(
            text(
                "INSERT INTO recommendation_log "
                "(topic, problem_id, mastery_before, created_at, evaluated_at, score) "
                "VALUES ('Array', 'two-sum', 0.4, :created, :evaluated, 1)"
            ),
            {
                "created": _iso(legacy_created),
                "evaluated": _iso(legacy_created + timedelta(days=7)),
            },
        )

    await init_db()
    await init_db()  # rerunnable

    async with engine.connect() as conn:
        columns = {
            row[1]
            for row in (
                await conn.execute(text("PRAGMA table_info(recommendation_log)"))
            ).fetchall()
        }
        indexes = {
            row[1]
            for row in (
                await conn.execute(text("PRAGMA index_list(recommendation_log)"))
            ).fetchall()
        }
        rows = (
            await conn.execute(text(
                "SELECT id, topic, problem_id, strategy, evaluation_due_at, outcome, "
                "mastery_after FROM recommendation_log"
            ))
        ).fetchall()

    assert {
        "id", "strategy", "topic", "problem_id", "mastery_before", "created_at",
        "evaluation_due_at", "evaluated_at", "score", "outcome", "mastery_after",
    } <= columns
    assert "ix_recommendation_log_due" in indexes
    assert len(rows) == 2
    rec_id, topic, problem_id, strategy, due_at, outcome, mastery_after = rows[0]
    assert (topic, problem_id) == ("DP", "coin-change")
    assert strategy == "" and due_at == "" and outcome is None
    assert mastery_after is None  # legacy rows keep a NULL audit snapshot
    already_id, already_topic = rows[1][0], rows[1][1]
    assert already_topic == "Array"
    assert rows[1][6] is None

    # A legacy row with blank due time is still evaluable: the window falls
    # back to created_at + 7 days, and no activity means abandoned.
    assert await evaluate_recommendation(rec_id, now=NOW) == -1
    row = await _row(rec_id)
    assert row.outcome == OUTCOME_ABANDONED
    assert row.evaluated_at == _iso(NOW)
    assert row.mastery_after == 0.5  # no events: rebuilt at the baseline

    # A previously evaluated legacy row is idempotent and keeps its NULL
    # audit snapshot (no fabricated mastery_after).
    assert await evaluate_recommendation(already_id, now=NOW) == 1
    already = await _row(already_id)
    assert already.evaluated_at == _iso(legacy_created + timedelta(days=7))
    assert already.mastery_after is None


# ── Mastery lookup and logging ───────────────────────────────


@pytest.mark.asyncio
async def test_get_mastery_returns_project_default_for_unknown_topic():
    assert await memory.get_mastery("never-seen") == {
        "topic": "never-seen", "mastery": 0.5, "attempts": 0,
    }
    await _seed_mastery("zero", 0.0, attempts=4)
    await _seed_mastery("one", 1.0, attempts=9)

    assert (await memory.get_mastery("zero"))["mastery"] == 0.0
    assert (await memory.get_mastery("one"))["mastery"] == 1.0
    assert (await memory.get_mastery(" zero "))["attempts"] == 4
    assert await memory.get_mastery("") == {
        "topic": "", "mastery": 0.5, "attempts": 0,
    }


@pytest.mark.asyncio
async def test_log_recommendation_defaults_and_validation():
    row = await log_recommendation(STRATEGY_TOPIC_ONLY, "UnknownTopic", now=NOW)

    assert row["mastery_before"] == 0.5  # project default for an unknown topic
    assert row["problem_id"] is None
    assert row["created_at"] == _iso(NOW)
    assert row["evaluation_due_at"] == _iso(
        NOW + timedelta(days=EVALUATION_WINDOW_DAYS)
    )
    assert row["evaluated_at"] is None
    assert row["score"] is None
    assert row["outcome"] is None
    assert row["mastery_after"] is None

    with pytest.raises(ValueError):
        await log_recommendation("not-a-strategy", "DP", now=NOW)
    with pytest.raises(ValueError):
        await log_recommendation(STRATEGY_TOPIC_ONLY, "   ", now=NOW)
    with pytest.raises(LookupError):
        await evaluate_recommendation(999_999, now=NOW)


# ── Evaluation window and scoring ────────────────────────────


@pytest.mark.asyncio
async def test_evaluation_waits_for_the_seven_day_window():
    rec = await _log(
        STRATEGY_TOPIC_ONLY, "BFS", created_at=NOW - timedelta(days=7)
    )
    assert rec["evaluation_due_at"] == _iso(NOW)

    assert await evaluate_recommendation(rec["id"], now=NOW - timedelta(seconds=1)) is None
    pending = await _row(rec["id"])
    assert pending.evaluated_at is None
    assert pending.score is None
    assert pending.outcome is None

    # The boundary itself is inside the window.
    assert await evaluate_recommendation(rec["id"], now=NOW) == -1
    evaluated = await _row(rec["id"])
    assert evaluated.outcome == OUTCOME_ABANDONED
    assert evaluated.mastery_after == 0.5


def test_replay_mastery_uses_elo_deltas_and_clamps():
    assert self_improve._replay_mastery(
        0.50,
        [
            (NOW, 1, 0, "ACCEPTED"),
            (NOW, 2, 0, "ACCEPTED"),
            (NOW, 3, 0, "WRONG_ANSWER"),
        ],
    ) == pytest.approx(0.52)
    assert self_improve._replay_mastery(
        0.98, [(NOW, 1, 0, "ACCEPTED")]
    ) == pytest.approx(1.0)
    assert self_improve._replay_mastery(
        0.01, [(NOW, 1, 0, "WRONG_ANSWER")]
    ) == pytest.approx(0.0)


def test_score_values_applies_the_documented_thresholds():
    # Pure threshold boundary checks: "at least +0.10" and "at least -0.05"
    # are inclusive, and an empty window is always abandoned.
    assert self_improve._score_values(0.40, 0.50, has_events=True) == (
        1, OUTCOME_IMPROVED,
    )
    assert self_improve._score_values(0.40, 0.4999, has_events=True) == (
        0, OUTCOME_NEUTRAL,
    )
    assert self_improve._score_values(0.60, 0.55, has_events=True) == (
        -1, OUTCOME_DECLINED,
    )
    assert self_improve._score_values(0.60, 0.5501, has_events=True) == (
        0, OUTCOME_NEUTRAL,
    )
    assert self_improve._score_values(0.50, 0.50, has_events=False) == (
        -1, OUTCOME_ABANDONED,
    )


@pytest.mark.asyncio
async def test_evaluation_replays_only_episodes_inside_the_window():
    cases = [
        # name, before, [statuses in window], expected score, outcome, after
        ("improved-exact", 0.40, ["ACCEPTED", "ACCEPTED"], 1, OUTCOME_IMPROVED, 0.50),
        ("improved-below", 0.40, ["ACCEPTED"], 0, OUTCOME_NEUTRAL, 0.45),
        ("declined", 0.60, ["WRONG_ANSWER"], -1, OUTCOME_DECLINED, 0.52),
        ("neutral-clamped", 0.04, ["WRONG_ANSWER"], 0, OUTCOME_NEUTRAL, 0.0),
        ("abandoned", 0.50, [], -1, OUTCOME_ABANDONED, 0.50),
    ]
    for name, before, statuses, expected, outcome, after in cases:
        topic = f"topic-{name}"
        for index, status in enumerate(statuses):
            await _seed_episode(
                f"p-{name}-{index}",
                created_at=NOW - timedelta(days=4, minutes=index),
                topics=[topic],
                status=status,
            )
        rec = await _log(
            STRATEGY_DUE_REVIEW, topic, f"p-{name}", before,
            created_at=NOW - timedelta(days=8),
        )

        assert await evaluate_recommendation(rec["id"], now=NOW) == expected, name
        row = await _row(rec["id"])
        assert row.score == expected, name
        assert row.outcome == outcome, name
        assert row.mastery_after == pytest.approx(after), name
        assert row.evaluated_at == _iso(NOW), name


@pytest.mark.asyncio
async def test_delayed_evaluation_ignores_practice_after_the_due_time():
    topic = "delayed"
    await _seed_mastery(topic, 0.90)  # live mastery is deliberately misleading
    created = NOW - timedelta(days=10)
    await _seed_episode(
        "day-2-accepted", created_at=created + timedelta(days=2),
        topics=[topic], status="ACCEPTED",
    )
    # Days 8-9 are outside the fixed window and must never affect the score,
    # even though a large run of accepted submissions there would move live
    # mastery well above the improvement threshold.
    await _seed_episode(
        "day-8-wrong", created_at=created + timedelta(days=8),
        topics=[topic], status="WRONG_ANSWER",
    )
    for index in range(3):
        await _seed_episode(
            f"day-9-accepted-{index}",
            created_at=created + timedelta(days=9, minutes=index),
            topics=[topic], status="ACCEPTED",
        )
    rec = await _log(
        STRATEGY_DUE_REVIEW, topic, "day-2-accepted", 0.5, created_at=created
    )

    # Day-2 activity alone moved mastery +0.05: neutral, not "declined" from
    # the later live mastery and not "improved" from post-window practice.
    assert await evaluate_recommendation(rec["id"], now=NOW) == 0
    row = await _row(rec["id"])
    assert row.score == 0
    assert row.outcome == OUTCOME_NEUTRAL
    assert row.mastery_after == pytest.approx(0.55)


@pytest.mark.asyncio
async def test_window_boundary_episode_counts_and_later_one_does_not():
    created = NOW - timedelta(days=8)
    due = created + timedelta(days=EVALUATION_WINDOW_DAYS)

    on_boundary = "boundary-in"
    await _seed_episode(
        "at-due", created_at=due, topics=[on_boundary], status="ACCEPTED"
    )
    rec_in = await _log(
        STRATEGY_DUE_REVIEW, on_boundary, "at-due", 0.5, created_at=created
    )
    assert await evaluate_recommendation(rec_in["id"], now=NOW) == 0
    row_in = await _row(rec_in["id"])
    assert row_in.outcome == OUTCOME_NEUTRAL
    assert row_in.mastery_after == pytest.approx(0.55)

    after_due = "boundary-out"
    await _seed_episode(
        "after-due", created_at=due + timedelta(seconds=1),
        topics=[after_due], status="ACCEPTED",
    )
    rec_out = await _log(
        STRATEGY_DUE_REVIEW, after_due, "after-due", 0.5, created_at=created
    )
    assert await evaluate_recommendation(rec_out["id"], now=NOW) == -1
    row_out = await _row(rec_out["id"])
    assert row_out.outcome == OUTCOME_ABANDONED
    assert row_out.mastery_after == pytest.approx(0.5)


@pytest.mark.asyncio
async def test_replay_orders_episodes_by_time_then_id():
    topic = "ordered"
    same_instant = NOW - timedelta(days=4)
    # Same timestamp: insertion order assigns increasing ids, and ACCEPTED
    # must be replayed before WRONG_ANSWER (+0.05 -0.08 => 0.42, neutral).
    # The reverse order would give 0.37 and a false "declined".
    await _seed_episode(
        "first-accepted", created_at=same_instant, topics=[topic], status="ACCEPTED"
    )
    await _seed_episode(
        "second-wrong", created_at=same_instant, topics=[topic], status="WRONG_ANSWER"
    )
    rec = await _log(
        STRATEGY_DUE_REVIEW, topic, "first-accepted", 0.45,
        created_at=NOW - timedelta(days=8),
    )

    assert await evaluate_recommendation(rec["id"], now=NOW) == 0
    row = await _row(rec["id"])
    assert row.outcome == OUTCOME_NEUTRAL
    assert row.mastery_after == pytest.approx(0.42)


@pytest.mark.asyncio
async def test_evaluation_is_idempotent_and_a_retry_keeps_the_first_score():
    created = NOW - timedelta(days=8)
    await _seed_episode(
        "day-1", created_at=created + timedelta(days=1), topics=["DP"],
        status="ACCEPTED",
    )
    await _seed_episode(
        "day-2", created_at=created + timedelta(days=2), topics=["DP"],
        status="WRONG_ANSWER",
    )
    rec = await _log(
        STRATEGY_DUE_REVIEW, "DP", "day-1", 0.5, created_at=created
    )

    assert await evaluate_recommendation(rec["id"], now=NOW) == 0
    first = await _row(rec["id"])
    first_evaluated_at = first.evaluated_at
    assert first.mastery_after == pytest.approx(0.47)

    # A previously missed in-window failure would change a fresh evaluation
    # to -1; the retry must keep the original neutral score snapshot.
    await _seed_episode(
        "day-5", created_at=created + timedelta(days=5), topics=["DP"],
        status="WRONG_ANSWER",
    )
    assert await evaluate_recommendation(
        rec["id"], now=NOW + timedelta(days=1)
    ) == 0

    retried = await _row(rec["id"])
    assert retried.score == 0
    assert retried.outcome == OUTCOME_NEUTRAL
    assert retried.mastery_after == pytest.approx(0.47)
    assert retried.evaluated_at == first_evaluated_at
    assert len(await _rows()) == 1


@pytest.mark.asyncio
async def test_concurrent_evaluation_produces_one_score():
    await _seed_episode(
        "p1", created_at=NOW - timedelta(days=4), topics=["BFS"],
        status="ACCEPTED",
    )
    rec = await _log(
        STRATEGY_DUE_REVIEW, "BFS", "p1", 0.5,
        created_at=NOW - timedelta(days=8),
    )

    results = await asyncio.gather(
        evaluate_recommendation(rec["id"], now=NOW),
        evaluate_recommendation(rec["id"], now=NOW),
    )

    assert results == [0, 0]
    rows = await _rows()
    assert len(rows) == 1
    assert rows[0].score == 0
    assert rows[0].mastery_after == pytest.approx(0.55)
    assert rows[0].evaluated_at == _iso(NOW)


@pytest.mark.asyncio
async def test_due_evaluation_batch_skips_open_windows_and_reruns_safely():
    due = await _log(
        STRATEGY_TOPIC_ONLY, "due-topic", created_at=NOW - timedelta(days=8)
    )
    not_due = await _log(
        STRATEGY_TOPIC_ONLY, "later-topic", created_at=NOW - timedelta(days=1)
    )
    already = await _log(
        STRATEGY_TOPIC_ONLY, "done-topic", created_at=NOW - timedelta(days=10)
    )
    await _mark_evaluated(
        already["id"], score=1, outcome=OUTCOME_IMPROVED,
        evaluated_at=NOW - timedelta(days=2),
    )

    first = await evaluate_due_recommendations(now=NOW)
    assert first["checked"] == 2
    assert first["evaluated_count"] == 1
    assert first["evaluated"] == [{"id": due["id"], "score": -1}]
    assert first["not_due"] == [not_due["id"]]
    assert first["failed_count"] == 0
    assert (await _row(already["id"])).score == 1
    assert (await _row(not_due["id"])).evaluated_at is None

    # A retry finds nothing newly due and must not rescore anything.
    second = await evaluate_due_recommendations(now=NOW)
    assert second["checked"] == 1
    assert second["evaluated_count"] == 0
    assert second["not_due"] == [not_due["id"]]

    # Once its window elapses the remaining row is scored exactly once.
    third = await evaluate_due_recommendations(now=NOW + timedelta(days=7))
    assert third["evaluated_count"] == 1
    assert third["evaluated"] == [{"id": not_due["id"], "score": -1}]


# ── suggest_next_problem ─────────────────────────────────────


@pytest.mark.asyncio
async def test_suggestion_prefers_a_due_review_problem_and_logs_it(monkeypatch):
    await _seed_mastery("DP", 0.3)
    await _seed_episode(
        "coin-change", created_at=NOW - timedelta(days=10), topics=["DP"]
    )
    fake = FakeVectorStore()
    monkeypatch.setattr(self_improve, "vector_store", fake)

    result = await suggest_next_problem(now=NOW)

    assert result["ok"] is True
    assert result["count"] == 1
    recommendation = result["recommendations"][0]
    assert recommendation["strategy"] == STRATEGY_DUE_REVIEW
    assert recommendation["topic"] == "DP"
    assert recommendation["problem_id"] == "coin-change"
    assert recommendation["mastery_before"] == pytest.approx(0.3)
    assert recommendation["evaluated_in_days"] == EVALUATION_WINDOW_DAYS
    assert fake.queries == [("DP", 3)]

    rows = await _rows()
    assert len(rows) == 1
    assert rows[0].id == recommendation["id"]
    assert rows[0].strategy == STRATEGY_DUE_REVIEW
    assert rows[0].topic == "DP"
    assert rows[0].problem_id == "coin-change"
    assert rows[0].mastery_before == pytest.approx(0.3)


@pytest.mark.asyncio
async def test_suggestion_uses_only_confirmed_indexed_problem_slugs(monkeypatch):
    await _seed_mastery("BFS", 0.35)
    fake = FakeVectorStore({
        "BFS": [
            _problem_result("graph-bfs"),
            # No confirmed slug: this item must not become a problem id.
            {"id": "record-id", "metadata": {"title": "unknown"}},
        ],
    })
    monkeypatch.setattr(self_improve, "vector_store", fake)

    result = await suggest_next_problem(now=NOW)

    recommendation = result["recommendations"][0]
    assert recommendation["strategy"] == STRATEGY_SIMILAR_PROBLEM
    assert recommendation["problem_id"] == "graph-bfs"
    assert recommendation["topic"] == "BFS"
    assert recommendation["mastery_before"] == pytest.approx(0.35)
    row = await _row(recommendation["id"])
    assert row.strategy == STRATEGY_SIMILAR_PROBLEM
    assert row.problem_id == "graph-bfs"


@pytest.mark.asyncio
async def test_suggestion_degrades_to_topic_only_when_vector_memory_is_down(
    monkeypatch,
):
    await _seed_mastery("Greedy", 0.2)
    monkeypatch.setattr(
        self_improve, "vector_store",
        FakeVectorStore(error=VectorStoreUnavailable("chromadb missing")),
    )

    result = await suggest_next_problem(now=NOW)

    recommendation = result["recommendations"][0]
    assert recommendation["strategy"] == STRATEGY_TOPIC_ONLY
    assert recommendation["problem_id"] is None
    assert recommendation["topic"] == "Greedy"
    row = await _row(recommendation["id"])
    assert row.strategy == STRATEGY_TOPIC_ONLY
    assert row.problem_id is None


@pytest.mark.asyncio
async def test_suggestion_returns_nothing_without_a_weak_topic(monkeypatch):
    monkeypatch.setattr(self_improve, "vector_store", FakeVectorStore())

    result = await suggest_next_problem(now=NOW)

    assert result["ok"] is True
    assert result["count"] == 0
    assert result["recommendations"] == []
    assert "薄弱 topic" in result["note"]
    assert await _rows() == []


@pytest.mark.asyncio
async def test_suggestion_excludes_the_active_problem(monkeypatch):
    await _seed_mastery("DP", 0.3)
    await _seed_episode(
        "active", created_at=NOW - timedelta(days=10), topics=["DP"]
    )
    await _seed_episode(
        "other", created_at=NOW - timedelta(days=9), topics=["DP"]
    )
    monkeypatch.setattr(self_improve, "vector_store", FakeVectorStore())

    result = await suggest_next_problem(now=NOW, exclude_problem_id="active")

    recommendation = result["recommendations"][0]
    assert recommendation["strategy"] == STRATEGY_DUE_REVIEW
    assert recommendation["problem_id"] == "other"


@pytest.mark.asyncio
async def test_suggestion_clamps_limit_and_accepts_an_explicit_topic(monkeypatch):
    for index, mastery in enumerate([0.1, 0.2, 0.3, 0.4, 0.5]):
        await _seed_mastery(f"weak-{index}", mastery)
    fake = FakeVectorStore()
    monkeypatch.setattr(self_improve, "vector_store", fake)

    capped = await suggest_next_problem(now=NOW, limit=50)
    assert capped["count"] == MAX_RECOMMENDATIONS
    assert all(
        item["strategy"] == STRATEGY_TOPIC_ONLY
        for item in capped["recommendations"]
    )
    assert all(item["problem_id"] is None for item in capped["recommendations"])

    floor = await suggest_next_problem(now=NOW, limit=0)
    assert floor["count"] == 1

    # An explicit topic may be recommended even when it is not below the
    # weak-topic threshold, using a confirmed indexed problem.
    await _seed_mastery("Strong", 0.9)
    fake.mapping["Strong"] = [_problem_result("strong-problem")]
    explicit = await suggest_next_problem(now=NOW, topic="Strong", limit=5)
    assert explicit["count"] == 1
    assert explicit["recommendations"][0]["strategy"] == STRATEGY_SIMILAR_PROBLEM
    assert explicit["recommendations"][0]["problem_id"] == "strong-problem"


@pytest.mark.asyncio
async def test_coach_suggest_tool_is_registered_and_records_recommendations(
    monkeypatch,
):
    tool = next(item for item in TOOLS if item["name"] == "suggest_next_problem")
    assert tool["input_schema"]["properties"]["limit"]["maximum"] == MAX_RECOMMENDATIONS

    await _seed_mastery("BFS", 0.3)
    monkeypatch.setattr(
        self_improve, "vector_store",
        FakeVectorStore({"BFS": [_problem_result("graph-bfs")]}),
    )
    agent = AlgoCoach()

    result = await agent._execute_tool(
        "suggest_next_problem", {"limit": 2}, "active-problem"
    )

    assert result["ok"] is True
    assert result["count"] == 1
    assert result["recommendations"][0]["problem_id"] == "graph-bfs"
    rows = await _rows()
    assert len(rows) == 1
    assert rows[0].problem_id == "graph-bfs"


# ── Monthly review ───────────────────────────────────────────


@pytest.mark.asyncio
async def test_monthly_review_counts_only_evaluated_rows_in_the_window():
    first = await _log(
        STRATEGY_DUE_REVIEW, "dp", "p1", 0.4,
        created_at=NOW - timedelta(days=10),
    )
    second = await _log(
        STRATEGY_DUE_REVIEW, "dp", "p2", 0.4,
        created_at=NOW - timedelta(days=9),
    )
    third = await _log(
        STRATEGY_DUE_REVIEW, "graph", "p3", 0.5,
        created_at=NOW - timedelta(days=8),
    )
    similar = await _log(
        STRATEGY_SIMILAR_PROBLEM, "bfs", "p4", 0.5,
        created_at=NOW - timedelta(days=12),
    )
    still_open = await _log(
        STRATEGY_TOPIC_ONLY, "greedy", created_at=NOW - timedelta(days=2)
    )
    too_old = await _log(
        STRATEGY_DUE_REVIEW, "old", "p5", created_at=NOW - timedelta(days=50)
    )
    await _mark_evaluated(
        first["id"], score=1, outcome=OUTCOME_IMPROVED,
        evaluated_at=NOW - timedelta(days=3),
    )
    await _mark_evaluated(
        second["id"], score=1, outcome=OUTCOME_IMPROVED,
        evaluated_at=NOW - timedelta(days=2),
    )
    await _mark_evaluated(
        third["id"], score=-1, outcome=OUTCOME_DECLINED,
        evaluated_at=NOW - timedelta(days=1),
    )
    await _mark_evaluated(
        similar["id"], score=0, outcome=OUTCOME_NEUTRAL,
        evaluated_at=NOW - timedelta(days=5),
    )
    await _mark_evaluated(
        too_old["id"], score=1, outcome=OUTCOME_IMPROVED,
        evaluated_at=NOW - timedelta(days=40),
    )

    review = await monthly_strategy_review(now=NOW)

    assert review["window_days"] == 30
    assert review["window_start"] == _iso(NOW - timedelta(days=30))
    assert review["window_end"] == _iso(NOW)
    assert review["overall"] == {
        "samples": 4,
        "improved": 2,
        "neutral": 1,
        "declined": 1,
        "abandoned": 0,
        "success_rate": pytest.approx(0.5),
    }
    by_strategy = {item["strategy"]: item for item in review["strategies"]}
    assert by_strategy[STRATEGY_DUE_REVIEW]["samples"] == 3
    assert by_strategy[STRATEGY_DUE_REVIEW]["improved"] == 2
    assert by_strategy[STRATEGY_DUE_REVIEW]["declined"] == 1
    assert by_strategy[STRATEGY_DUE_REVIEW]["success_rate"] == pytest.approx(0.6667)
    assert by_strategy[STRATEGY_SIMILAR_PROBLEM]["samples"] == 1
    assert by_strategy[STRATEGY_SIMILAR_PROBLEM]["success_rate"] == 0.0

    suggestions = "\n".join(review["suggestions"])
    assert "2/3" in suggestions  # successful / sample denominator
    assert "1 条已评样本" in suggestions  # small-sample strategy is not judged
    assert "未自动修改" in suggestions
    assert review["auto_tuning_applied"] is False

    # Analysis-only: the still-open row is untouched and no notification exists.
    assert (await _row(still_open["id"])).evaluated_at is None
    async with SessionLocal() as session:
        assert list(
            (await session.execute(select(Notification))).scalars()
        ) == []


@pytest.mark.asyncio
async def test_monthly_review_with_no_evaluated_samples_is_explicit():
    review = await monthly_strategy_review(now=NOW)

    assert review["overall"]["samples"] == 0
    assert review["overall"]["success_rate"] is None
    assert review["strategies"] == []
    assert "样本数 0" in review["suggestions"][0]
    assert review["auto_tuning_applied"] is False


# ── Archive interaction ──────────────────────────────────────


@pytest.mark.asyncio
async def test_archive_rows_participate_in_window_replay():
    # Live mastery is deliberately wrong; the score must come from the two
    # archived in-window episodes, not from current semantic state.
    await _seed_mastery("BFS", 0.30)
    rec = await _log(
        STRATEGY_DUE_REVIEW, "BFS", "graph-bfs", 0.6,
        created_at=NOW - timedelta(days=100),
    )
    # Both events are 95/94 days old: inside the recommendation's 7-day
    # window, but old enough for the 90-day consolidation to archive them.
    await _seed_episode(
        "graph-bfs-1", created_at=NOW - timedelta(days=95), topics=["BFS"],
        status="ACCEPTED",
    )
    await _seed_episode(
        "graph-bfs-2", created_at=NOW - timedelta(days=94), topics=["BFS"],
        status="ACCEPTED",
    )

    archived = await memory.archive_old_episodes(now=NOW)
    assert archived["archived"] == 2

    # The recommendation history itself is not touched by archival.
    assert (await _row(rec["id"])) is not None
    assert (await _row(rec["id"])).evaluated_at is None

    # Replay from 0.6: +0.05 +0.05 => 0.70, which is +0.10 and therefore +1.
    assert await evaluate_recommendation(rec["id"], now=NOW) == 1
    row = await _row(rec["id"])
    assert row.outcome == OUTCOME_IMPROVED
    assert row.score == 1
    assert row.mastery_after == pytest.approx(0.70)

    # Retrying after archival is still idempotent.
    assert await evaluate_recommendation(
        rec["id"], now=NOW + timedelta(days=1)
    ) == 1
    retried = await _row(rec["id"])
    assert retried.mastery_after == pytest.approx(0.70)
    assert len(await _rows()) == 1


# ── Scheduler wiring ─────────────────────────────────────────


def test_register_jobs_adds_self_improve_jobs_once_with_the_shared_timezone():
    scheduler = AsyncIOScheduler(timezone=ZoneInfo("Asia/Shanghai"))
    crons.register_jobs(scheduler)
    crons.register_jobs(scheduler)  # replace_existing, not a second copy

    jobs = {job.id: job for job in scheduler.get_jobs()}
    assert sorted(jobs) == sorted(crons.JOB_IDS)
    assert len(jobs) == 6

    evaluation = jobs[crons.JOB_SELF_IMPROVE_EVALUATION]
    assert evaluation.func is crons.self_improve_evaluation
    assert _field(evaluation.trigger, "hour") == ["4"]
    assert _field(evaluation.trigger, "minute") == ["0"]

    monthly = jobs[crons.JOB_SELF_IMPROVE_MONTHLY_REVIEW]
    assert monthly.func is crons.self_improve_monthly_review
    assert _field(monthly.trigger, "day") == ["1"]
    assert _field(monthly.trigger, "hour") == ["4"]
    assert _field(monthly.trigger, "minute") == ["30"]

    for job in jobs.values():
        assert str(job.trigger.timezone) == "Asia/Shanghai"
        assert job.max_instances == 1
        assert job.coalesce is True


@pytest.mark.asyncio
async def test_cron_entrypoints_run_evaluation_and_monthly_review():
    await _seed_mastery("DP", 0.5)
    rec = await _log(
        STRATEGY_DUE_REVIEW, "DP", "p1", 0.5,
        created_at=NOW - timedelta(days=8),
    )

    evaluation = await crons.self_improve_evaluation(now=NOW)
    assert evaluation["evaluated_count"] == 1
    assert evaluation["evaluated"] == [{"id": rec["id"], "score": -1}]

    review = await crons.self_improve_monthly_review(now=NOW)
    assert review["overall"]["samples"] == 1
    assert review["overall"]["abandoned"] == 1
