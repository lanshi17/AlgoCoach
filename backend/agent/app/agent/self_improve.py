"""
Self-improve — recommendation logging and 7-day backtesting (P2 MVP).

This module closes a small, local-only feedback loop around problem
recommendations:

1. ``suggest_next_problem`` builds at most three recommendations from the
   user's weakest topics and problems that already exist in local state
   (due spaced-repetition problems first, then locally indexed similar
   problems). It never invents a slug and never calls an external model or
   upstream API. When no slug can be confirmed it returns a topic-only
   recommendation with ``problem_id=None``.
2. Every recommendation is written to ``recommendation_log`` with the strategy,
   topic, problem id and the topic's mastery at recommendation time.
3. Seven days later ``evaluate_due_recommendations`` rebuilds the topic's
   mastery *as of ``evaluation_due_at``*: starting from ``mastery_before``, it
   replays only episodes whose timestamp falls inside the fixed window (ELO:
   ``ACCEPTED`` +0.05, otherwise -0.08, clamp ``[0, 1]``). It scores ``+1`` when
   the replayed mastery rose by at least ``0.10``, ``-1`` when it fell by at
   least ``0.05``, ``-1`` when the window had no event at all (abandoned),
   otherwise ``0``. Practice after the due time is never read, so a delayed
   worker cannot change the attribution.
4. ``monthly_strategy_review`` aggregates only already-evaluated rows and
   exposes the per-strategy success rate together with the sample denominator.

Timing and idempotency
----------------------
All persisted timestamps are naive UTC strings, matching ``episodic`` and the
rest of the memory store. ``ALGOCOACH_TIMEZONE`` only decides when the cron
jobs fire, never how a window is measured.

``evaluation_due_at = created_at + 7 days``. A row is never scored before its
due time. Scoring is a single conditional ``UPDATE ... WHERE evaluated_at IS
NULL`` inside the SQLite transaction, so concurrent or repeated evaluations of
the same id can produce one score at most; a retry returns the stored score
without overwriting ``evaluated_at``. The reconstructed value is persisted in
``mastery_after`` for audit.

Archive interaction
-------------------
The 90-day episodic archive is far outside the 7-day evaluation window, so a
normal evaluation can never lose evidence to consolidation. The replay reads
``episodic_archive`` as well as the hot table, which covers a delayed run (for
example a service that was down past the archive cutoff). Recommendations have
no foreign key to episodic, so archiving episodes never deletes or duplicates
recommendation history.

This is an analysis-only MVP: monthly reviews are logged/returned, and nothing
here rewrites the Soul, prompts, recommendation weights or configuration
automatically. There is no UI or user notification for these reports.
"""
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update

from app.memory.db import (
    EpisodicArchive,
    EpisodicRecord,
    RecommendationLog,
    SessionLocal,
)
from app.memory.memory_service import _iso, _json_list, _parse_iso, memory, utcnow
from app.memory.vector_store import (
    VectorStoreError,
    VectorStoreUnavailable,
    vector_store,
)

logger = logging.getLogger(__name__)

# A recommendation is backtested seven days after it was made.
EVALUATION_WINDOW_DAYS = 7
# Mastery movement that counts as a success / failure.
IMPROVED_THRESHOLD = 0.10
DECLINED_THRESHOLD = 0.05
# Rolling window used by the monthly review; the denominator is always shown.
MONTHLY_REVIEW_WINDOW_DAYS = 30
# The tool is deliberately small: a handful of suggestions, not a dump.
MAX_RECOMMENDATIONS = 3
# Per-topic vector lookups stay small even if the index has many problems.
SIMILAR_PROBLEMS_PER_TOPIC = 3
# Weak-topic threshold matches the get_weakness_topics tool default.
WEAK_TOPIC_THRESHOLD = 0.6
# A strategy needs this many evaluated samples before its rate is judged.
MIN_STRATEGY_SAMPLES = 3

STRATEGY_DUE_REVIEW = "due_review"
STRATEGY_SIMILAR_PROBLEM = "similar_problem"
STRATEGY_TOPIC_ONLY = "topic_only"
STRATEGIES = (
    STRATEGY_DUE_REVIEW,
    STRATEGY_SIMILAR_PROBLEM,
    STRATEGY_TOPIC_ONLY,
)

OUTCOME_IMPROVED = "improved"
OUTCOME_NEUTRAL = "neutral"
OUTCOME_DECLINED = "declined"
OUTCOME_ABANDONED = "abandoned"

# Mastery is stored as a float, so a threshold such as +0.10 can miss by one
# ulp (0.4 + 0.1 != 0.5 exactly in binary). "At least 0.10" is inclusive.
_THRESHOLD_EPSILON = 1e-9


# ── Logging recommendations ───────────────────────────────────


async def log_recommendation(
    strategy: str,
    topic: str,
    problem_id: str | None = None,
    mastery_before: float | None = None,
    now: datetime | None = None,
) -> dict:
    """Persist one recommendation and return the stored row as a dict.

    ``mastery_before`` is captured here so a later mastery change cannot move
    the baseline. When omitted it is read from ``memory.get_mastery``, whose
    unknown-topic baseline is 0.5, matching ``SemanticNode.mastery``.
    ``problem_id`` is ``None`` for a topic-only suggestion.
    """
    strategy = str(strategy or "").strip()
    if strategy not in STRATEGIES:
        raise ValueError(f"unknown recommendation strategy: {strategy!r}")
    topic = str(topic or "").strip()
    if not topic:
        raise ValueError("recommendation topic must not be empty")
    if mastery_before is None:
        mastery_before = (await memory.get_mastery(topic))["mastery"]
    before = float(mastery_before)
    now = _normalise_now(now)
    slug = str(problem_id or "").strip() or None

    async with SessionLocal() as s:
        row = RecommendationLog(
            strategy=strategy,
            topic=topic,
            problem_id=slug,
            mastery_before=before,
            created_at=_iso(now),
            evaluation_due_at=_iso(evaluation_due_at(now)),
            evaluated_at=None,
            score=None,
            outcome=None,
        )
        s.add(row)
        await s.commit()
        await s.refresh(row)
        return _as_dict(row)


def _normalise_now(value: datetime | None) -> datetime:
    """Naive UTC clock, accepting an offset-aware value from a caller/test."""
    if value is None:
        return utcnow()
    if value.tzinfo is not None:
        return value.astimezone(timezone.utc).replace(tzinfo=None)
    return value


def evaluation_due_at(created_at: datetime) -> datetime:
    """The fixed backtest deadline for a recommendation made at ``created_at``."""
    return created_at + timedelta(days=EVALUATION_WINDOW_DAYS)


# ── Evaluation ────────────────────────────────────────────────


async def evaluate_recommendation(
    rec_log_id: int, now: datetime | None = None
) -> int | None:
    """Score one recommendation, exactly once.

    Returns the score (``-1``/``0``/``1``), ``None`` while the 7-day window is
    still open, and the previously stored score when the row was already
    evaluated (idempotent retry). A missing id raises ``LookupError``.
    """
    now = _normalise_now(now)
    async with SessionLocal() as s:
        rec = await s.get(RecommendationLog, int(rec_log_id))
    if rec is None:
        raise LookupError(f"recommendation_log {rec_log_id} not found")

    if rec.evaluated_at is not None and rec.score is not None:
        return int(rec.score)

    due = _due_time(rec)
    if now < due:
        # Never score ahead of the window; a later scheduler run will do it.
        return None

    before = float(rec.mastery_before)
    window_start = _created_time(rec)
    events = await _window_events(rec.topic, window_start, due)
    after = _replay_mastery(before, events)
    score, outcome = _score_values(before, after, has_events=bool(events))

    async with SessionLocal() as s:
        result = await s.execute(
            update(RecommendationLog)
            .where(
                RecommendationLog.id == int(rec_log_id),
                RecommendationLog.evaluated_at.is_(None),
            )
            .values(
                evaluated_at=_iso(now),
                score=score,
                outcome=outcome,
                mastery_after=after,
            )
        )
        await s.commit()
        if getattr(result, "rowcount", None) == 0:
            # Another worker won the conditional update. Its score is the one
            # that counts; do not overwrite it.
            async with SessionLocal() as read_session:
                current = await read_session.get(RecommendationLog, int(rec_log_id))
            if current is not None and current.score is not None:
                return int(current.score)
            return None

    logger.info(
        "Recommendation %s evaluated: strategy=%s topic=%s window_events=%s "
        "mastery_before=%s mastery_after=%s score=%s outcome=%s",
        rec_log_id, rec.strategy, rec.topic, len(events),
        before, after, score, outcome,
    )
    return score


async def evaluate_due_recommendations(now: datetime | None = None) -> dict:
    """Evaluate every unevaluated recommendation whose window has elapsed.

    Rows that are not due are left untouched. Re-running the job is safe:
    already-evaluated rows are skipped, and a concurrent evaluation is
    resolved by the conditional update in ``evaluate_recommendation``. A
    single broken row is logged and does not abort the batch.
    """
    now = _normalise_now(now)
    async with SessionLocal() as s:
        ids = list(
            (
                await s.execute(
                    select(RecommendationLog.id)
                    .where(RecommendationLog.evaluated_at.is_(None))
                    .order_by(RecommendationLog.id)
                )
            ).scalars()
        )

    evaluated: list[dict] = []
    not_due: list[int] = []
    failed: list[dict] = []
    for rec_id in ids:
        try:
            score = await evaluate_recommendation(rec_id, now=now)
        except Exception as exc:  # noqa: BLE001 - one bad row must not stop the batch
            logger.warning("Recommendation %s evaluation failed: %s", rec_id, exc)
            failed.append({"id": rec_id, "error": str(exc)})
            continue
        if score is None:
            not_due.append(rec_id)
        else:
            evaluated.append({"id": rec_id, "score": score})

    return {
        "checked": len(ids),
        "evaluated_count": len(evaluated),
        "not_due_count": len(not_due),
        "failed_count": len(failed),
        "evaluated": evaluated,
        "not_due": not_due,
        "failed": failed,
    }


def _score_values(
    before: float, after: float, *, has_events: bool
) -> tuple[int, str]:
    """Apply the documented scoring rules to the reconstructed window state.

    ``after`` is the mastery rebuilt from ``before`` by replaying only the
    episodes inside ``[created_at, evaluation_due_at]``. No live semantic
    mastery is consulted, so practice after the due time cannot change the
    score.

    Abandonment is judged first: a whole window without any event for the topic
    means there is no practice to attribute, regardless of what happened later.
    Otherwise the reconstructed delta decides improved (at least +0.10),
    declined (at least -0.05) or neutral.
    """
    if not has_events:
        return -1, OUTCOME_ABANDONED
    if after - before >= IMPROVED_THRESHOLD - _THRESHOLD_EPSILON:
        return 1, OUTCOME_IMPROVED
    if before - after >= DECLINED_THRESHOLD - _THRESHOLD_EPSILON:
        return -1, OUTCOME_DECLINED
    return 0, OUTCOME_NEUTRAL


def _replay_mastery(before: float, events: list[tuple]) -> float:
    """Replay the project's ELO rule from the recommendation baseline.

    ``events`` are ``(created_at, id, source, status)`` tuples already filtered
    to the topic and sorted by episode time/id. Each accepted attempt adds 0.05
    and every other status subtracts 0.08, clamped to ``[0, 1]`` after each step
    — the same rule ``MemoryService._update_mastery`` applies live.
    """
    mastery = max(0.0, min(1.0, float(before)))
    for _when, _episode_id, _source, status in events:
        delta = 0.05 if str(status or "").upper() == "ACCEPTED" else -0.08
        mastery = max(0.0, min(1.0, mastery + delta))
    return mastery


async def _window_events(
    topic: str, window_start: datetime, window_end: datetime
) -> list[tuple]:
    """Episodes for ``topic`` whose timestamp falls inside the fixed window.

    The hot table and the 90-day archive are both consulted, so a delayed
    evaluation still replays evidence that was consolidated while the service
    was down. Timestamps are parsed rather than string-compared, and the result
    is ordered by ``(created_at, id)`` with the source table as a stable final
    tie-breaker. Episodes after ``window_end`` are excluded: they are what the
    old "read live mastery" implementation accidentally counted.
    """
    if not topic:
        return []
    async with SessionLocal() as s:
        hot = list(
            (
                await s.execute(
                    select(
                        EpisodicRecord.id,
                        EpisodicRecord.created_at,
                        EpisodicRecord.status,
                        EpisodicRecord.topics,
                    )
                )
            ).all()
        )
        cold = list(
            (
                await s.execute(
                    select(
                        EpisodicArchive.id,
                        EpisodicArchive.created_at,
                        EpisodicArchive.status,
                        EpisodicArchive.topics,
                    )
                )
            ).all()
        )

    events: list[tuple] = []
    for source, rows in enumerate((hot, cold)):
        for episode_id, created_at, status, topics_json in rows:
            when = _parse_iso(created_at)
            if when is None or when < window_start or when > window_end:
                continue
            if topic not in _json_list(topics_json):
                continue
            events.append((when, int(episode_id or 0), source, status or ""))
    events.sort(key=lambda item: (item[0], item[1], item[2]))
    return events


def _created_time(rec: RecommendationLog) -> datetime:
    return _parse_iso(rec.created_at) or utcnow()


def _due_time(rec: RecommendationLog) -> datetime:
    """Return the stored evaluation deadline."""
    due = _parse_iso(rec.evaluation_due_at)
    if due is None:
        raise ValueError(f"recommendation {rec.id} has no valid evaluation deadline")
    return due


def _as_dict(row: RecommendationLog) -> dict:
    return {
        "id": row.id,
        "strategy": row.strategy,
        "topic": row.topic,
        "problem_id": row.problem_id,
        "mastery_before": float(row.mastery_before),
        "created_at": row.created_at,
        "evaluation_due_at": row.evaluation_due_at,
        "evaluated_at": row.evaluated_at,
        "score": row.score,
        "outcome": row.outcome,
        "mastery_after": row.mastery_after,
    }


# ── Recommendation (suggest_next_problem tool) ────────────────


async def suggest_next_problem(
    now: datetime | None = None,
    limit: int = MAX_RECOMMENDATIONS,
    topic: str | None = None,
    exclude_problem_id: str | None = None,
) -> dict:
    """Recommend up to ``limit`` problems for weak topics and log each one.

    Candidate sources, in priority order:

    1. a due spaced-repetition problem whose topics include the target topic;
    2. a locally indexed problem returned by vector similarity for that topic;
    3. a topic-only recommendation with ``problem_id=None``.

    No problem is invented: source 2 only uses slugs already stored in local
    vector memory (which are populated from real gateway metadata). The current
    problem is excluded so the agent does not recommend what the user is
    already working on. Every returned item is persisted in
    ``recommendation_log`` before it is returned.
    """
    now = _normalise_now(now)
    limit = _clamp_limit(limit)
    excluded = str(exclude_problem_id or "").strip() or None

    requested = str(topic or "").strip()
    if requested:
        target_topics = [requested]
    else:
        weak = await memory.weak_topics(
            threshold=WEAK_TOPIC_THRESHOLD, top_n=MAX_RECOMMENDATIONS
        )
        target_topics = [
            item["topic"] for item in weak if str(item.get("topic") or "").strip()
        ]
    if not target_topics:
        return {
            "ok": True,
            "count": 0,
            "recommendations": [],
            "note": (
                "没有低于阈值的薄弱 topic；先用 get_weakness_topics 或积累做题记录。"
            ),
        }

    due_by_topic = await _due_problems_by_topic(now, limit)
    similar_by_topic = await _similar_problems_by_topic(target_topics)

    used_problems: set[str] = set()
    recommendations: list[dict] = []
    for topic_name in target_topics:
        if len(recommendations) >= limit:
            break
        choice = _pick_candidate(
            topic_name, due_by_topic, similar_by_topic, used_problems, excluded
        )
        if choice is None:
            strategy, problem_id, reason = (
                STRATEGY_TOPIC_ONLY,
                None,
                "本地没有可确认的题号，仅按该薄弱 topic 推荐，不虚构题目。",
            )
        else:
            strategy, problem_id, reason = choice
            used_problems.add(problem_id)

        mastery_before = (await memory.get_mastery(topic_name))["mastery"]
        row = await log_recommendation(
            strategy=strategy,
            topic=topic_name,
            problem_id=problem_id,
            mastery_before=mastery_before,
            now=now,
        )
        recommendations.append(
            {
                "id": row["id"],
                "strategy": strategy,
                "topic": topic_name,
                "problem_id": problem_id,
                "mastery_before": mastery_before,
                "evaluated_in_days": EVALUATION_WINDOW_DAYS,
                "reason": reason,
            }
        )

    return {
        "ok": True,
        "count": len(recommendations),
        "recommendations": recommendations,
    }


def _pick_candidate(
    topic: str,
    due_by_topic: dict[str, list[str]],
    similar_by_topic: dict[str, list[str]],
    used_problems: set[str],
    excluded: str | None,
) -> tuple[str, str, str] | None:
    for due_problem in due_by_topic.get(topic, []):
        if due_problem in used_problems or due_problem == excluded:
            continue
        return STRATEGY_DUE_REVIEW, due_problem, "该题已到间隔复习时间。"
    for candidate in similar_by_topic.get(topic, []):
        if candidate in used_problems or candidate == excluded:
            continue
        return STRATEGY_SIMILAR_PROBLEM, candidate, "本地向量记忆中的相似题。"
    return None


async def _due_problems_by_topic(
    now: datetime, limit: int
) -> dict[str, list[str]]:
    """Map a topic to its due problems, weakest first.

    ``memory.due_reviews`` is the same durable selection the 20:00 push uses,
    so recommendations reuse the spaced-repetition queue instead of inventing
    a second definition of "due". It only reads/refreshes local state. A list
    is kept per topic so excluding the active problem can fall through to the
    next due problem instead of degrading to topic-only.
    """
    probe_limit = max(limit * 3, 6)
    due = await memory.due_reviews(now=now, limit=probe_limit)
    mapping: dict[str, list[str]] = {}
    for item in due:
        problem_id = str(item.get("problem_id") or "").strip()
        if not problem_id:
            continue
        for topic_name in item.get("topics") or []:
            name = str(topic_name or "").strip()
            if not name:
                continue
            bucket = mapping.setdefault(name, [])
            if problem_id not in bucket:
                bucket.append(problem_id)
    return mapping


async def _similar_problems_by_topic(
    topics: list[str],
) -> dict[str, list[str]]:
    """Best-effort local vector lookups; a broken index degrades to topic-only."""
    mapping: dict[str, list[str]] = {}
    for topic_name in topics:
        try:
            results = await vector_store.find_similar_problems(
                topic_name, top_k=SIMILAR_PROBLEMS_PER_TOPIC
            )
        except VectorStoreUnavailable as exc:
            logger.warning("Similar-problem recommendation skipped: %s", exc)
            return mapping
        except VectorStoreError as exc:
            logger.warning("Similar-problem query rejected: %s", exc)
            continue
        except Exception:  # noqa: BLE001 - local index must not break the tool
            logger.warning("Similar-problem query failed", exc_info=True)
            continue
        slugs: list[str] = []
        for item in results or []:
            slug = _result_slug(item)
            if slug and slug not in slugs:
                slugs.append(slug)
        if slugs:
            mapping[topic_name] = slugs
    return mapping


def _result_slug(item: object) -> str | None:
    """Extract a confirmed problem slug from one vector result."""
    if not isinstance(item, dict):
        return None
    metadata = item.get("metadata")
    if isinstance(metadata, dict):
        for key in ("problem_id", "id"):
            value = str(metadata.get(key) or "").strip()
            if value:
                return value
    value = str(item.get("problem_id") or "").strip()
    return value or None


def _clamp_limit(value: object) -> int:
    if isinstance(value, bool) or not isinstance(value, (int, str, float)):
        return MAX_RECOMMENDATIONS
    try:
        parsed = int(value)
    except (OverflowError, TypeError, ValueError):
        return MAX_RECOMMENDATIONS
    return max(1, min(parsed, MAX_RECOMMENDATIONS))


# ── Monthly strategy review ───────────────────────────────────


async def monthly_strategy_review(now: datetime | None = None) -> dict:
    """Aggregate evaluated recommendations from the last 30 days.

    Only rows with a score are counted, and each strategy's rate is reported
    with its sample denominator. This is deliberately analysis-only: it logs
    and returns a Chinese, human-readable suggestion list but does not change
    the Soul, prompts, recommendation weights or any configuration, and it
    creates no user notification.
    """
    now = _normalise_now(now)
    start = now - timedelta(days=MONTHLY_REVIEW_WINDOW_DAYS)

    async with SessionLocal() as s:
        rows = list(
            (
                await s.execute(
                    select(RecommendationLog).where(
                        RecommendationLog.evaluated_at.is_not(None)
                    )
                )
            ).scalars()
        )

    evaluated: list[RecommendationLog] = []
    for row in rows:
        evaluated_at = _parse_iso(row.evaluated_at)
        if evaluated_at is None or row.score is None:
            continue
        if evaluated_at < start or evaluated_at > now:
            continue
        evaluated.append(row)

    by_strategy: dict[str, dict] = {}
    for row in evaluated:
        bucket = by_strategy.setdefault(
            row.strategy or "unknown",
            {
                "strategy": row.strategy or "unknown",
                "samples": 0,
                "improved": 0,
                "neutral": 0,
                "declined": 0,
                "abandoned": 0,
            },
        )
        bucket["samples"] += 1
        bucket[_outcome_key(row)] += 1

    strategies = []
    for bucket in sorted(
        by_strategy.values(), key=lambda item: (-item["samples"], item["strategy"])
    ):
        samples = bucket["samples"]
        bucket["success_rate"] = (
            round(bucket["improved"] / samples, 4) if samples else None
        )
        strategies.append(bucket)

    overall = {
        "samples": len(evaluated),
        "improved": sum(bucket["improved"] for bucket in strategies),
        "neutral": sum(bucket["neutral"] for bucket in strategies),
        "declined": sum(bucket["declined"] for bucket in strategies),
        "abandoned": sum(bucket["abandoned"] for bucket in strategies),
        "success_rate": (
            round(sum(bucket["improved"] for bucket in strategies) / len(evaluated), 4)
            if evaluated
            else None
        ),
    }
    suggestions = _build_suggestions(strategies)

    review = {
        "window_start": _iso(start),
        "window_end": _iso(now),
        "window_days": MONTHLY_REVIEW_WINDOW_DAYS,
        "overall": overall,
        "strategies": strategies,
        "suggestions": suggestions,
        "auto_tuning_applied": False,
    }
    logger.info(
        "Monthly strategy review window=%s..%s samples=%s success_rate=%s",
        review["window_start"], review["window_end"],
        overall["samples"], overall["success_rate"],
    )
    return review


def _outcome_key(row: RecommendationLog) -> str:
    """Return the normalized outcome bucket for a completed recommendation."""
    outcome = (row.outcome or "").strip()
    return outcome if outcome in {
        OUTCOME_IMPROVED,
        OUTCOME_NEUTRAL,
        OUTCOME_DECLINED,
        OUTCOME_ABANDONED,
    } else OUTCOME_NEUTRAL


def _build_suggestions(strategies: list[dict]) -> list[str]:
    """Deterministic, human-readable suggestions with explicit denominators."""
    if not strategies:
        return [
            "统计窗口内没有已评估的推荐记录（样本数 0），不做策略判断。",
            "本报告只做人工分析；未自动修改 Soul、prompt、推荐权重或配置。",
        ]

    suggestions: list[str] = []
    for bucket in strategies:
        samples = bucket["samples"]
        improved = bucket["improved"]
        if samples < MIN_STRATEGY_SAMPLES:
            suggestions.append(
                f"{bucket['strategy']}：仅有 {samples} 条已评样本"
                f"（低于 {MIN_STRATEGY_SAMPLES} 条阈值），暂不做判断。"
            )
            continue
        rate = bucket["success_rate"] or 0.0
        percent = round(rate * 100)
        if rate >= 0.6:
            judgement = "该来源目前有效，可维持"
        elif rate <= 0.3:
            judgement = "成功率偏低，建议人工复核并考虑降低该来源权重"
        else:
            judgement = "效果中性，暂不建议调整"
        suggestions.append(
            f"{bucket['strategy']}：成功率 {percent}%"
            f"（{improved}/{samples}），{judgement}。"
        )
    suggestions.append(
        "本报告只做人工分析；未自动修改 Soul、prompt、推荐权重或配置。"
    )
    return suggestions
