"""
Scheduled local training reminders and reports.

Six jobs are registered on one ``AsyncIOScheduler``:

====================  =========================  =================================
job id                trigger                    purpose
====================  =========================  =================================
daily_problem         every day 08:00            fetch gateway daily problem, notify
review_push           every day 20:00            push at most 3 due weak problems
weekly_report         Sunday 21:00               weekly summary + WEEKLY_REPORT video
memory_consolidation  every day 03:00            archive 90-day-old episodes
self_improve_eval     every day 04:00            score recommendations due after 7d
self_improve_monthly  1st of month 04:30         analysis-only strategy review
====================  =========================  =================================

The scheduler is started and stopped exactly once by the FastAPI lifespan. Job
ids are stable and registered with ``replace_existing=True``; ``start_crons()``
also refuses to start a second scheduler, so a service reload or a retried
startup cannot stack duplicate jobs. Tests and local runs can disable the
scheduler with ``ALGOCOACH_CRONS_ENABLED=false``.

All persisted timestamps are naive UTC; ``ALGOCOACH_TIMEZONE`` (default
``Asia/Shanghai``) only decides when cron triggers fire and which local date
labels notifications use.
"""
import asyncio
import json
import logging
import os
from datetime import date, datetime, timedelta, timezone
from typing import cast
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import httpx
from anthropic import AsyncAnthropic
from anthropic.types import TextBlock
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.agent.self_improve import (
    evaluate_due_recommendations,
    monthly_strategy_review,
)
from app.config import gateway_base_url, gateway_timeout_seconds
from app.memory.memory_service import memory, utcnow
from app.remotion.animation_service import animation_service

logger = logging.getLogger(__name__)

DEFAULT_TIMEZONE = "Asia/Shanghai"
DEFAULT_MODEL = "claude-opus-5-5"

JOB_DAILY_PROBLEM = "daily_problem_push"
JOB_REVIEW_PUSH = "spaced_repetition_push"
JOB_WEEKLY_REPORT = "weekly_report"
JOB_MEMORY_CONSOLIDATION = "memory_consolidation"
JOB_SELF_IMPROVE_EVALUATION = "self_improve_evaluation"
JOB_SELF_IMPROVE_MONTHLY_REVIEW = "self_improve_monthly_review"

JOB_IDS = (
    JOB_DAILY_PROBLEM,
    JOB_REVIEW_PUSH,
    JOB_WEEKLY_REPORT,
    JOB_MEMORY_CONSOLIDATION,
    JOB_SELF_IMPROVE_EVALUATION,
    JOB_SELF_IMPROVE_MONTHLY_REVIEW,
)

_scheduler: AsyncIOScheduler | None = None


# ── Configuration helpers ─────────────────────────────────────

def crons_enabled() -> bool:
    """Cron jobs default to on; tests/local runs set the env var to false."""
    raw = os.getenv("ALGOCOACH_CRONS_ENABLED", "true").strip().lower()
    return raw not in {"0", "false", "no", "off", ""}


def get_timezone() -> ZoneInfo:
    """Scheduler timezone from ``ALGOCOACH_TIMEZONE``, default Asia/Shanghai.

    An unknown zone logs a warning and falls back to the default instead of
    crashing the service at startup.
    """
    name = os.getenv("ALGOCOACH_TIMEZONE", DEFAULT_TIMEZONE).strip() or DEFAULT_TIMEZONE
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError):
        logger.warning("Unknown ALGOCOACH_TIMEZONE %r; falling back to %s", name, DEFAULT_TIMEZONE)
        return ZoneInfo(DEFAULT_TIMEZONE)


def _local_date(now_utc: datetime) -> date:
    """Convert a naive-UTC instant to the configured scheduling timezone."""
    return now_utc.replace(tzinfo=timezone.utc).astimezone(get_timezone()).date()


# ── Scheduler lifecycle ───────────────────────────────────────

def register_jobs(
    scheduler: AsyncIOScheduler,
    timezone: ZoneInfo | None = None,
) -> AsyncIOScheduler:
    """Register the four cron jobs. Safe to call twice on the same scheduler."""
    tz = timezone or get_timezone()
    common = {
        "replace_existing": True,
        "coalesce": True,
        "max_instances": 1,
        "misfire_grace_time": 3600,
    }
    scheduler.add_job(
        daily_problem_push,
        CronTrigger(hour=8, minute=0, timezone=tz),
        id=JOB_DAILY_PROBLEM,
        name="Daily problem push (08:00)",
        **common,
    )
    scheduler.add_job(
        spaced_repetition_push,
        CronTrigger(hour=20, minute=0, timezone=tz),
        id=JOB_REVIEW_PUSH,
        name="Spaced repetition push (20:00)",
        **common,
    )
    scheduler.add_job(
        weekly_report,
        CronTrigger(day_of_week="sun", hour=21, minute=0, timezone=tz),
        id=JOB_WEEKLY_REPORT,
        name="Weekly report (Sunday 21:00)",
        **common,
    )
    scheduler.add_job(
        memory_consolidation,
        CronTrigger(hour=3, minute=0, timezone=tz),
        id=JOB_MEMORY_CONSOLIDATION,
        name="Memory consolidation (03:00)",
        **common,
    )
    # 04:00 sits after consolidation and before the 08:00 daily push, so a
    # recommendation made during the previous day is scored with the day's
    # completed activity.
    scheduler.add_job(
        self_improve_evaluation,
        CronTrigger(hour=4, minute=0, timezone=tz),
        id=JOB_SELF_IMPROVE_EVALUATION,
        name="Recommendation backtest (04:00)",
        **common,
    )
    # Analysis-only monthly report; it never rewrites weights or prompts.
    scheduler.add_job(
        self_improve_monthly_review,
        CronTrigger(day=1, hour=4, minute=30, timezone=tz),
        id=JOB_SELF_IMPROVE_MONTHLY_REVIEW,
        name="Monthly strategy review (1st 04:30)",
        **common,
    )
    return scheduler


async def start_crons() -> AsyncIOScheduler | None:
    """Start the process-wide scheduler once; return ``None`` when disabled."""
    global _scheduler
    if not crons_enabled():
        logger.info("Cron scheduler disabled by ALGOCOACH_CRONS_ENABLED")
        return None
    if _scheduler is not None and _scheduler.running:
        return _scheduler
    # A stopped scheduler may remain from a previous lifespan in the same
    # process (tests, reload); discard it before creating a fresh one.
    _scheduler = None
    scheduler = AsyncIOScheduler(timezone=get_timezone())
    register_jobs(scheduler)
    scheduler.start()
    _scheduler = scheduler
    logger.info(
        "Cron scheduler started (timezone=%s, jobs=%s)",
        get_timezone().key,
        ",".join(JOB_IDS),
    )
    return scheduler


async def shutdown_crons() -> None:
    """Stop the scheduler if it is running; safe to call repeatedly."""
    global _scheduler
    scheduler = _scheduler
    _scheduler = None
    if scheduler is not None and scheduler.running:
        scheduler.shutdown(wait=False)
        # AsyncIOScheduler.shutdown is scheduled onto the running loop, so let
        # it actually transition to STOPPED before returning.
        await asyncio.sleep(0)
        await asyncio.sleep(0)
        logger.info("Cron scheduler stopped")


def get_scheduler() -> AsyncIOScheduler | None:
    return _scheduler


# ── Daily problem ─────────────────────────────────────────────

async def fetch_daily_problem() -> dict | None:
    """GET ``/api/problems/daily`` from the Java gateway.

    Upstream failures (timeout, connection error, non-2xx, invalid JSON) are
    logged and return ``None``; the job then skips notification for the day
    instead of persisting a broken message.
    """
    url = f"{gateway_base_url()}/api/problems/daily"
    try:
        async with httpx.AsyncClient(timeout=gateway_timeout_seconds()) as client:
            response = await client.get(url)
            response.raise_for_status()
            payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("Daily problem fetch failed: %s", exc)
        return None
    if not isinstance(payload, dict) or not payload:
        logger.warning("Daily problem response was not a JSON object")
        return None
    return payload


_DIFFICULTY_CN = {"EASY": "简单", "MEDIUM": "中等", "HARD": "困难"}


def build_daily_guide(problem: dict) -> str:
    """Deterministic short Chinese guide; deliberately does not call the LLM.

    Calling ``coach.chat`` here would pollute the user's working-memory session
    with a system-generated prompt, so the daily push uses a template instead.
    Kept as a standalone function so tests and future LLM variants can replace
    it without touching scheduling.
    """
    title = str(
        problem.get("translatedTitle")
        or problem.get("title")
        or "今日题目"
    ).strip()
    slug = str(problem.get("titleSlug") or "").strip()
    difficulty = _DIFFICULTY_CN.get(
        str(problem.get("difficulty") or "").upper(),
        str(problem.get("difficulty") or "").strip(),
    )
    tags: list[str] = []
    raw_tags = problem.get("topicTags")
    for tag in raw_tags if isinstance(raw_tags, list) else []:
        if isinstance(tag, dict):
            name = tag.get("translatedName") or tag.get("nameTranslated") or tag.get("name")
        else:
            name = tag
        if isinstance(name, str) and name.strip():
            tags.append(name.strip())

    header = f"今日一题：{title}"
    if difficulty:
        header += f"（{difficulty}）"
    lines = [header]
    if tags:
        lines.append("考点：" + "、".join(tags[:5]))
    lines.append("先读题 2 分钟，写清输入、输出和边界条件，再开始编码。")
    if slug:
        lines.append(f"链接：https://leetcode.cn/problems/{slug}/")
    return "\n".join(lines)


async def daily_problem_push(now: datetime | None = None):
    """Fetch and persist the daily problem notification (idempotent per day)."""
    now = now or utcnow()
    problem = await fetch_daily_problem()
    if problem is None:
        return None
    content = build_daily_guide(problem)
    dedupe_key = f"daily:{_local_date(now).isoformat()}"
    return await memory.notify_user("daily", content, dedupe_key=dedupe_key, now=now)


# ── Spaced repetition ─────────────────────────────────────────

def build_review_message(item: dict) -> str:
    topics = item.get("topics") or []
    mastery_pct = round(float(item.get("mastery", 0.5)) * 100)
    lines = [f"该复习了：{item['problem_id']}（掌握度 {mastery_pct}%）"]
    if topics:
        lines.append("相关考点：" + "、".join(topics[:5]))
    lines.append("先回忆思路，再独立写一遍；卡住的地方记下来。")
    return "\n".join(lines)


async def spaced_repetition_push(
    now: datetime | None = None,
    limit: int = 3,
) -> list:
    """Push at most three due problems, weakest first, once per problem/day.

    ``memory.due_reviews`` already excludes problems notified on the same local
    day and returns the weakest candidates. A notification is only marked as
    pushed when its dedupe key actually inserted, so restarts and retries do
    not advance the schedule twice.
    """
    now = now or utcnow()
    local_date = _local_date(now).isoformat()
    # The three-per-day budget spans all runs of this job, not just one call.
    already_sent = await memory.review_push_count(local_date)
    remaining = max(0, int(limit) - already_sent)
    if remaining == 0:
        return []
    due = await memory.due_reviews(now=now, limit=remaining, local_date=local_date)
    sent = []
    for item in due:
        dedupe_key = f"review:{local_date}:{item['problem_id']}"
        notification = await memory.notify_user(
            "review", build_review_message(item), dedupe_key=dedupe_key, now=now
        )
        if notification is None:
            continue
        await memory.mark_review_pushed(
            item["problem_id"], now=now, local_date=local_date
        )
        sent.append(notification)
    return sent


# ── Weekly report ─────────────────────────────────────────────

async def _call_weekly_llm(prompt: str) -> str:
    """Dedicated LLM call; never touches ``coach._sessions``."""
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY is not configured")
    client = AsyncAnthropic(api_key=api_key)
    response = await client.messages.create(
        model=os.getenv("CLAUDE_MODEL", DEFAULT_MODEL),
        max_tokens=500,
        system=(
            "你是 AlgoCoach 的数据总结助手。只根据给定的本周统计写一段中文周报，"
            "语气克制、具体，不虚构用户没有做过的题，不超过 180 字。"
        ),
        messages=[{"role": "user", "content": prompt}],
    )
    return "".join(
        cast(TextBlock, block).text
        for block in response.content
        if getattr(block, "type", "") == "text"
    ).strip()


def render_weekly_summary(stats: dict) -> str:
    """Deterministic fallback used when the LLM is unavailable."""
    lines = [
        f"本周刷题周报（{stats['week_start']} ~ {stats['week_end']}）",
        (
            f"共提交 {stats['total_attempts']} 次，通过 {stats['accepted']} 次，"
            f"复盘 {stats['reviewed']} 次。"
        ),
    ]
    topics = stats.get("topics") or []
    if topics:
        lines.append(
            "考点分布：" + "、".join(f"{t['name']}×{t['count']}" for t in topics[:5])
        )
    weak = stats.get("weak_topics") or []
    if weak:
        lines.append(
            "薄弱考点：" + "、".join(f"{t['topic']}({t['mastery']:.2f})" for t in weak)
        )
    sticking = stats.get("sticking_points") or []
    if sticking:
        lines.append("反复卡点：" + "、".join(sticking[:3]))
    lines.append("下周从最薄弱的考点开始，每天 1–2 题即可。")
    return "\n".join(lines)


async def generate_weekly_summary(stats: dict) -> str:
    """LLM summary with a deterministic fallback on any failure.

    Mockable seam: tests patch this function (or ``_call_weekly_llm``) so no
    network request is made.
    """
    prompt = (
        "以下是本周刷题统计的 JSON，请写一段中文周报总结：\n"
        + json.dumps(stats, ensure_ascii=False, indent=2)
    )
    try:
        summary = await _call_weekly_llm(prompt)
    except Exception as exc:  # network, auth, model or response-shape failure
        logger.warning("Weekly report LLM unavailable, using fallback: %s", exc)
        return render_weekly_summary(stats)
    return summary or render_weekly_summary(stats)


def weekly_report_props(stats: dict) -> dict:
    """Props consumed by the prebuilt ``WeeklyReport`` Remotion composition."""
    return {
        "weekStart": stats["week_start"],
        "weekEnd": stats["week_end"],
        "totalAttempts": stats["total_attempts"],
        "accepted": stats["accepted"],
        "reviewed": stats["reviewed"],
        "topics": stats.get("topics") or [],
        "weakTopics": stats.get("weak_topics") or [],
        "stickingPoints": stats.get("sticking_points") or [],
    }


async def _enqueue_weekly_animation(stats: dict, local: date) -> None:
    try:
        await animation_service.enqueue(
            kind="WEEKLY_REPORT",
            topic="WEEKLY_REPORT",
            title=f"{local.isoformat()} 周报",
            component="WeeklyReport",
            composition_id="WeeklyReport",
            props=weekly_report_props(stats),
        )
    except Exception as exc:  # a failed render must not lose the text report
        logger.warning("Weekly report animation enqueue failed: %s", exc)


async def weekly_report(now: datetime | None = None):
    """Summarise the last seven days and persist one notification per ISO week."""
    now = now or utcnow()
    local = _local_date(now)
    stats = await memory.weekly_stats(now=now)
    summary = await generate_weekly_summary(stats)
    # A retry that spills past Sunday midnight should still dedupe against the
    # Sunday report it belongs to, not the new ISO week.
    week_anchor = local - timedelta(days=1) if local.weekday() == 0 else local
    iso_year, iso_week, _ = week_anchor.isocalendar()
    dedupe_key = f"weekly:{iso_year}-W{iso_week:02d}"
    notification = await memory.notify_user(
        "weekly_report", summary, dedupe_key=dedupe_key, now=now
    )
    if notification is None:
        return None
    await _enqueue_weekly_animation(stats, local)
    return notification


# ── Memory consolidation ──────────────────────────────────────

async def self_improve_evaluation(now: datetime | None = None) -> dict:
    """Daily 04:00: score recommendations whose 7-day window has elapsed.

    The wrapper is the scheduler's stable entry point and the test seam; the
    evaluation logic itself lives in ``app.agent.self_improve`` and is
    idempotent, so a retry cannot double-score a recommendation.
    """
    now = now or utcnow()
    result = await evaluate_due_recommendations(now=now)
    logger.info(
        "Self-improve evaluation checked=%s evaluated=%s not_due=%s failed=%s",
        result["checked"], result["evaluated_count"],
        result["not_due_count"], result["failed_count"],
    )
    return result


async def self_improve_monthly_review(now: datetime | None = None) -> dict:
    """Monthly 1st 04:30: analysis-only strategy review (no auto tuning)."""
    now = now or utcnow()
    return await monthly_strategy_review(now=now)


async def memory_consolidation(now: datetime | None = None) -> dict:
    """Daily 03:00 maintenance: move episodes older than 90 days to the archive.

    This deliberately does not decay ``semantic.mastery``. The plan mentions a
    future 0.005/day tuning direction that was not approved for this ticket.
    """
    now = now or utcnow()
    result = await memory.archive_old_episodes(now=now)
    logger.info(
        "Memory consolidation archived=%s already_archived=%s removed=%s cutoff=%s",
        result["archived"], result["already_archived"], result["removed"], result["cutoff"],
    )
    return result
