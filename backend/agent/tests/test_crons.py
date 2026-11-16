"""Tests for the P1 cron jobs, notification persistence and weekly component.

The suite uses the throw-away SQLite database from ``conftest.py``. Every HTTP
and LLM call is mocked: no gateway, Claude or Remotion process is contacted.
"""
import asyncio
import json
from datetime import datetime, timedelta
from pathlib import Path
from types import SimpleNamespace
from zoneinfo import ZoneInfo

import httpx
import pytest
import pytest_asyncio
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select, text

from app.agent import crons
from app.memory.db import (
    EpisodicArchive,
    EpisodicRecord,
    Notification,
    ReviewSchedule,
    SemanticNode,
    SessionLocal,
    engine,
    init_db,
)
from app.main import app
from app.memory.memory_service import memory, next_review_interval_days
from app.remotion.animation_service import PREBUILT, animation_service

REPO_ROOT = Path(__file__).resolve().parents[3]
NOW = datetime(2026, 11, 12, 12, 0, 0)


@pytest_asyncio.fixture(autouse=True)
async def _stop_scheduler():
    """Never leave a scheduler running across pytest event loops."""
    await crons.shutdown_crons()
    yield
    await crons.shutdown_crons()


async def _notifications(kind: str | None = None) -> list[Notification]:
    async with SessionLocal() as session:
        statement = select(Notification).order_by(Notification.id)
        if kind is not None:
            statement = statement.where(Notification.type == kind)
        return list((await session.execute(statement)).scalars())


async def _seed_episode(
    problem_id: str,
    *,
    created_at: datetime,
    status: str = "WRONG_ANSWER",
    topics: list[str] | None = None,
    sticking_points: list[str] | None = None,
) -> EpisodicRecord:
    async with SessionLocal() as session:
        record = EpisodicRecord(
            problem_id=problem_id,
            platform="LEETCODE",
            status=status,
            lang="rust",
            duration_sec=300,
            topics=json.dumps(topics or []),
            sticking_points=json.dumps(sticking_points or []),
            created_at=created_at.isoformat(),
        )
        session.add(record)
        await session.commit()
        return record


async def _seed_review_problems(now: datetime) -> None:
    """Five wrong problems, 10 days old, with mastery 0.2 … 0.9."""
    specs = [("p1", 0.20), ("p2", 0.35), ("p3", 0.50), ("p4", 0.65), ("p5", 0.90)]
    async with SessionLocal() as session:
        for index, (problem_id, mastery) in enumerate(specs):
            topic = f"topic-{index}"
            session.add(EpisodicRecord(
                problem_id=problem_id,
                platform="LEETCODE",
                status="WRONG_ANSWER",
                lang="rust",
                duration_sec=300,
                topics=json.dumps([topic]),
                sticking_points="[]",
                created_at=(now - timedelta(days=10)).isoformat(),
            ))
            session.add(SemanticNode(
                topic=topic, mastery=mastery, attempts=2, last_seen=""
            ))
        await session.commit()


def _field(trigger, name: str) -> list[str]:
    for field in trigger.fields:
        if field.name == name:
            return [str(expression) for expression in field.expressions]
    raise AssertionError(f"missing trigger field {name}")


# ── Configuration / lifecycle ─────────────────────────────────

def test_timezone_defaults_to_shanghai(monkeypatch):
    monkeypatch.delenv("ALGOCOACH_TIMEZONE", raising=False)
    assert crons.get_timezone().key == "Asia/Shanghai"


def test_timezone_env_override(monkeypatch):
    monkeypatch.setenv("ALGOCOACH_TIMEZONE", "America/New_York")
    assert crons.get_timezone().key == "America/New_York"


def test_invalid_timezone_falls_back(monkeypatch):
    monkeypatch.setenv("ALGOCOACH_TIMEZONE", "Mars/Olympus")
    assert crons.get_timezone().key == "Asia/Shanghai"


def test_local_date_uses_configured_timezone(monkeypatch):
    monkeypatch.setenv("ALGOCOACH_TIMEZONE", "Asia/Shanghai")
    # 20:00 UTC is 04:00 the next day in Shanghai.
    assert crons._local_date(datetime(2026, 11, 12, 20, 0, 0)).isoformat() == "2026-11-13"


def test_register_jobs_is_idempotent_and_uses_expected_triggers():
    scheduler = AsyncIOScheduler(timezone=ZoneInfo("Asia/Shanghai"))
    crons.register_jobs(scheduler)
    crons.register_jobs(scheduler)  # replace_existing, not a second copy

    jobs = {job.id: job for job in scheduler.get_jobs()}
    assert sorted(jobs) == sorted(crons.JOB_IDS)
    assert _field(jobs[crons.JOB_DAILY_PROBLEM].trigger, "hour") == ["8"]
    assert _field(jobs[crons.JOB_REVIEW_PUSH].trigger, "hour") == ["20"]
    assert _field(jobs[crons.JOB_WEEKLY_REPORT].trigger, "day_of_week") == ["sun"]
    assert _field(jobs[crons.JOB_WEEKLY_REPORT].trigger, "hour") == ["21"]
    assert _field(jobs[crons.JOB_MEMORY_CONSOLIDATION].trigger, "hour") == ["3"]
    for job in jobs.values():
        assert str(job.trigger.timezone) == "Asia/Shanghai"


@pytest.mark.asyncio
async def test_app_lifespan_starts_and_stops_scheduler(monkeypatch):
    monkeypatch.setenv("ALGOCOACH_CRONS_ENABLED", "true")

    async with app.router.lifespan_context(app):
        scheduler = crons.get_scheduler()
        assert scheduler is not None
        assert scheduler.running
        assert len(scheduler.get_jobs()) == len(crons.JOB_IDS)

    assert crons.get_scheduler() is None


@pytest.mark.asyncio
async def test_start_is_single_and_shutdown_is_idempotent(monkeypatch):
    monkeypatch.setenv("ALGOCOACH_CRONS_ENABLED", "true")
    first = await crons.start_crons()
    assert first is not None
    assert first.running
    assert crons.get_scheduler() is first

    second = await crons.start_crons()
    assert second is first
    assert len(first.get_jobs()) == len(crons.JOB_IDS)

    await crons.shutdown_crons()
    assert not first.running
    assert crons.get_scheduler() is None
    await crons.shutdown_crons()  # safe to repeat


@pytest.mark.asyncio
async def test_disabled_crons_do_not_start(monkeypatch):
    monkeypatch.setenv("ALGOCOACH_CRONS_ENABLED", "false")
    assert await crons.start_crons() is None
    assert crons.get_scheduler() is None


@pytest.mark.asyncio
async def test_init_db_migrates_old_notifications_table():
    async with engine.begin() as conn:
        await conn.execute(text("DROP TABLE notifications"))
        await conn.execute(text(
            "CREATE TABLE notifications ("
            "id INTEGER PRIMARY KEY AUTOINCREMENT, "
            "type VARCHAR(32), content TEXT, created_at VARCHAR(32))"
        ))

    await init_db()
    await init_db()  # rerunnable

    async with engine.connect() as conn:
        columns = {
            row[1]
            for row in (
                await conn.execute(text("PRAGMA table_info(notifications)"))
            ).fetchall()
        }
        indexes = {
            row[1]
            for row in (
                await conn.execute(text("PRAGMA index_list(notifications)"))
            ).fetchall()
        }
    assert {"dedupe_key", "read"} <= columns
    assert "ix_notifications_dedupe_key" in indexes


# ── Daily problem ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_daily_problem_push_persists_once_per_local_day(monkeypatch):
    async def fake_fetch():
        return {
            "title": "Two Sum",
            "titleSlug": "two-sum",
            "difficulty": "EASY",
            "topicTags": [{"name": "Array"}, {"name": "Hash Table"}],
        }

    monkeypatch.setattr(crons, "fetch_daily_problem", fake_fetch)

    first = await crons.daily_problem_push(now=NOW)
    second = await crons.daily_problem_push(now=NOW + timedelta(hours=3))

    assert first is not None
    assert "今日一题" in first.content
    assert "Two Sum" in first.content
    assert "简单" in first.content
    assert "Array" in first.content
    assert "https://leetcode.cn/problems/two-sum/" in first.content
    # A retry on the same day is deduplicated by dedupe_key.
    assert second is None

    rows = await _notifications("daily")
    assert len(rows) == 1
    assert rows[0].dedupe_key == "daily:2026-11-12"
    assert rows[0].read is False


@pytest.mark.asyncio
async def test_daily_gateway_error_persists_nothing(monkeypatch):
    class BrokenClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def get(self, url):
            raise httpx.ConnectTimeout("gateway down")

    monkeypatch.setattr(crons.httpx, "AsyncClient", BrokenClient)

    assert await crons.fetch_daily_problem() is None
    assert await crons.daily_problem_push(now=NOW) is None
    assert await _notifications("daily") == []


def test_daily_guide_is_deterministic_and_does_not_need_coach():
    guide = crons.build_daily_guide({
        "title": "Binary Search",
        "difficulty": "MEDIUM",
        "topicTags": ["Binary Search"],
    })
    assert guide.splitlines()[0] == "今日一题：Binary Search（中等）"
    assert "考点：Binary Search" in guide


# ── Spaced repetition ────────────────────────────────────────

def test_review_interval_follows_documented_formula():
    assert next_review_interval_days(0.2, 1, 4) == 2      # reinforce: halve
    assert next_review_interval_days(0.9, 1, 20) == 30    # maintain: double, capped
    assert next_review_interval_days(0.5, 3, 4) == 8      # normal: EF 1.95
    assert next_review_interval_days(0.5, 3, 100) == 30   # always capped


@pytest.mark.asyncio
async def test_review_selection_is_weakest_first_and_limited_to_three():
    await _seed_review_problems(NOW)

    due = await memory.due_reviews(now=NOW, limit=3)

    assert [item["problem_id"] for item in due] == ["p1", "p2", "p3"]
    assert all(item["due_at"] <= NOW.isoformat() for item in due)


@pytest.mark.asyncio
async def test_review_push_caps_three_per_day_and_does_not_repeat():
    await _seed_review_problems(NOW)

    first = await crons.spaced_repetition_push(now=NOW)
    first_ids = [notification.dedupe_key.rsplit(":", 1)[-1] for notification in first]
    assert first_ids == ["p1", "p2", "p3"]
    assert len(await _notifications("review")) == 3

    # A second run on the same local day must not add a fourth or repeat one.
    assert await crons.spaced_repetition_push(now=NOW + timedelta(hours=1)) == []
    assert len(await _notifications("review")) == 3

    # The next day pushes the remaining due problems, never the same three.
    next_day = NOW + timedelta(days=1)
    second = await crons.spaced_repetition_push(now=next_day)
    second_ids = [notification.dedupe_key.rsplit(":", 1)[-1] for notification in second]
    assert second_ids == ["p4", "p5"]
    assert set(second_ids).isdisjoint(set(first_ids))


@pytest.mark.asyncio
async def test_review_schedule_is_derived_from_eligible_existing_episodes():
    await _seed_episode("wrong", created_at=NOW - timedelta(days=10))
    await _seed_episode(
        "accepted-clean",
        created_at=NOW - timedelta(days=10),
        status="ACCEPTED",
    )
    await _seed_episode(
        "accepted-stuck",
        created_at=NOW - timedelta(days=10),
        status="ACCEPTED",
        sticking_points=["边界条件"],
    )

    inserted = await memory.seed_review_schedule(now=NOW)
    assert inserted == 2

    async with SessionLocal() as session:
        rows = list((await session.execute(select(ReviewSchedule))).scalars())
    by_problem = {row.problem_id: row for row in rows}
    assert set(by_problem) == {"wrong", "accepted-stuck"}
    # Ten days old + a 1–3 day initial interval is already overdue.
    assert all(row.due_at <= NOW.isoformat() for row in rows)
    # Re-running the seed is a no-op.
    assert await memory.seed_review_schedule(now=NOW) == 0


@pytest.mark.asyncio
async def test_record_attempt_schedules_new_wrong_answers():
    await memory.record_attempt(
        problem_id="fresh-wrong",
        platform="LEETCODE",
        status="WRONG_ANSWER",
        lang="rust",
        duration_sec=120,
        topics=["DP"],
        sticking_points=[],
    )
    async with SessionLocal() as session:
        schedule = await session.get(ReviewSchedule, "fresh-wrong")
    assert schedule is not None
    assert schedule.due_at > crons.utcnow().isoformat()


# ── Archive ──────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_archive_moves_only_old_episodes_and_is_idempotent():
    old = await _seed_episode(
        "old", created_at=NOW - timedelta(days=100), topics=["BFS"]
    )
    recent = await _seed_episode(
        "recent", created_at=NOW - timedelta(days=10), topics=["DP"]
    )

    first = await memory.archive_old_episodes(now=NOW)
    assert first["archived"] == 1
    assert first["removed"] == 1

    async with SessionLocal() as session:
        hot = list((await session.execute(select(EpisodicRecord))).scalars())
        archived = list((await session.execute(select(EpisodicArchive))).scalars())
    assert [row.problem_id for row in hot] == ["recent"]
    assert [row.problem_id for row in archived] == ["old"]
    assert archived[0].id == old.id
    assert archived[0].topics == json.dumps(["BFS"])
    assert recent.id is not None

    second = await memory.archive_old_episodes(now=NOW)
    assert second["archived"] == 0
    assert second["removed"] == 0
    async with SessionLocal() as session:
        assert len(list((await session.execute(select(EpisodicArchive))).scalars())) == 1
        assert len(list((await session.execute(select(EpisodicRecord))).scalars())) == 1


@pytest.mark.asyncio
async def test_memory_consolidation_job_archives_without_mastery_decay():
    await _seed_episode("old", created_at=NOW - timedelta(days=100))
    async with SessionLocal() as session:
        session.add(SemanticNode(topic="DP", mastery=0.5, attempts=2, last_seen=""))
        await session.commit()

    result = await crons.memory_consolidation(now=NOW)

    assert result["archived"] == 1
    async with SessionLocal() as session:
        node = await session.get(SemanticNode, "DP")
    # The 0.005/day decay mentioned in the plan is explicitly not applied.
    assert node.mastery == pytest.approx(0.5)


# ── Weekly report ────────────────────────────────────────────

@pytest.mark.asyncio
async def test_weekly_report_persists_once_and_enqueues_prebuilt_component(monkeypatch):
    await _seed_episode(
        "two-sum",
        created_at=NOW - timedelta(days=1),
        status="ACCEPTED",
        topics=["Array"],
    )

    async def fake_summary(stats):
        assert stats["total_attempts"] == 1
        return "本周完成 1 题，通过 1 题。"

    captured: dict[str, object] = {}

    async def fake_enqueue(**kwargs):
        captured.update(kwargs)
        return SimpleNamespace(id="weekly-job", status="QUEUED")

    monkeypatch.setattr(crons, "generate_weekly_summary", fake_summary)
    monkeypatch.setattr(crons.animation_service, "enqueue", fake_enqueue)

    notification = await crons.weekly_report(now=NOW)
    assert notification is not None
    assert notification.type == "weekly_report"
    assert notification.content == "本周完成 1 题，通过 1 题。"
    assert notification.dedupe_key == "weekly:2026-W46"

    rows = await _notifications("weekly_report")
    assert len(rows) == 1
    assert captured["kind"] == "WEEKLY_REPORT"
    assert captured["component"] == "WeeklyReport"
    assert captured["composition_id"] == "WeeklyReport"
    assert captured["props"]["totalAttempts"] == 1

    # A retry in the same ISO week must not duplicate the notification/render.
    assert await crons.weekly_report(now=NOW + timedelta(days=1)) is None
    assert len(await _notifications("weekly_report")) == 1


@pytest.mark.asyncio
async def test_weekly_report_keeps_text_but_skips_animation_when_disabled(monkeypatch):
    monkeypatch.delenv("REMOTION_ENABLED", raising=False)

    async def fake_summary(stats):
        return "仅文本周报"

    monkeypatch.setattr(crons, "generate_weekly_summary", fake_summary)
    before = len(crons.animation_service._jobs)

    # A different ISO week so the earlier weekly-report test cannot dedupe this.
    notification = await crons.weekly_report(now=NOW - timedelta(days=70))

    assert notification is not None
    assert notification.content == "仅文本周报"
    # The disabled service refuses the enqueue; no render job is created.
    assert len(crons.animation_service._jobs) == before


@pytest.mark.asyncio
async def test_weekly_report_monday_retry_dedupes_against_sunday(monkeypatch):
    async def fake_summary(stats):
        return "周报"

    async def fake_enqueue(**kwargs):
        return SimpleNamespace(id="weekly-job", status="QUEUED")

    monkeypatch.setattr(crons, "generate_weekly_summary", fake_summary)
    monkeypatch.setattr(crons.animation_service, "enqueue", fake_enqueue)

    # Sunday 21:00 Shanghai == Sunday 13:00 UTC.
    sunday = datetime(2026, 11, 15, 13, 0, 0)
    # Monday 08:30 Shanghai retry still belongs to the Sunday report's ISO week.
    monday = datetime(2026, 11, 16, 0, 30, 0)

    assert await crons.weekly_report(now=sunday) is not None
    assert await crons.weekly_report(now=monday) is None
    rows = await _notifications("weekly_report")
    assert [row.dedupe_key for row in rows] == ["weekly:2026-W46"]


@pytest.mark.asyncio
async def test_weekly_summary_falls_back_when_llm_fails(monkeypatch):
    async def broken_llm(prompt):
        raise RuntimeError("offline")

    monkeypatch.setattr(crons, "_call_weekly_llm", broken_llm)
    stats = await memory.weekly_stats(now=NOW)

    summary = await crons.generate_weekly_summary(stats)

    assert "本周刷题周报" in summary
    assert "下周从最薄弱的考点开始" in summary


# ── Weekly Remotion component registration ───────────────────

def test_weekly_report_component_is_registered_everywhere():
    assert PREBUILT["WEEKLY_REPORT"] == "WeeklyReport"
    assert animation_service._guess_component("WEEKLY_REPORT") == "WeeklyReport"

    root = (REPO_ROOT / "remotion-compositions/src/Root.tsx").read_text(encoding="utf-8")
    assert 'id="WeeklyReport"' in root
    assert "width={1920}" in root
    assert "height={1080}" in root
    assert "fps={60}" in root

    main = (
        REPO_ROOT / "remotion-compositions/src/compositions/MainComp.tsx"
    ).read_text(encoding="utf-8")
    assert "WeeklyReport" in main


@pytest.mark.asyncio
async def test_enqueue_uses_dedicated_weekly_composition(monkeypatch):
    async def fake_render(job_id):
        return None

    monkeypatch.setattr(animation_service, "_render", fake_render)

    weekly = await animation_service.enqueue(
        kind="WEEKLY_REPORT",
        topic="WEEKLY_REPORT",
        title="周报",
        component="WeeklyReport",
        props={"totalAttempts": 1},
    )
    chat = await animation_service.enqueue(
        kind="PRE_EXPLAIN",
        topic="BFS",
        title="BFS",
        component="BfsGraph",
        props={},
    )
    await asyncio.sleep(0)

    assert weekly.composition_id == "WeeklyReport"
    assert chat.composition_id == "MainComp"


# ── Notification dedupe ─────────────────────────────────────

@pytest.mark.asyncio
async def test_notify_user_dedupe_key_is_idempotent():
    first = await memory.notify_user("daily", "first", dedupe_key="same", now=NOW)
    second = await memory.notify_user("daily", "second", dedupe_key="same", now=NOW)

    assert first is not None
    assert second is None
    rows = await _notifications("daily")
    assert len(rows) == 1
    assert rows[0].content == "first"
