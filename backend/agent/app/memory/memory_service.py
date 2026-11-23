"""
MemoryService — CRUD for all four memory types.
Used by the agent to retrieve context before each Claude call,
and to persist learnings after each session.

P1 adds the persistence side of scheduled notifications: an idempotent
``notify_user`` writer, durable spaced-repetition state, weekly aggregates and
the 90-day episodic archive. All timestamps stored here are naive UTC strings,
matching the pre-existing ``episodic.created_at`` format; the scheduler's
timezone only affects *when* jobs fire, never the stored timestamps.
"""
import json
import hashlib
from datetime import datetime, timedelta, timezone
from io import BytesIO
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile
from collections import Counter
from collections import defaultdict
from typing import Any
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.memory.db import (
    DEFAULT_WORKSPACE_ID,
    EpisodicArchive,
    EpisodicRecord,
    AgentTurn,
    AgentTurnEvent,
    MemoryRecordReceipt,
    Notification,
    ProceduralPattern,
    RecommendationLog,
    ReviewSchedule,
    SemanticNode,
    SessionLocal,
)
from app.config import chroma_path, reme_workspace_dir
from app.memory.vector_store import vector_store, workspace_vector_store

# One notification per problem per day; the batch never exceeds three.
MAX_REVIEW_PUSHES_PER_DAY = 3
# A path is deliberately short enough to act on in one sitting. The API may
# request fewer steps, but never expands the response beyond this bound.
MAX_MASTERY_PATH_STEPS = 12
# A push reschedules the problem. The formula can return one day for very weak
# topics, but a notification is not evidence the user practised, so the push
# cadence floors at two days to avoid the same problem appearing every day.
MIN_REVIEW_PUSH_INTERVAL_DAYS = 2
# Episodes older than this are copied to episodic_archive and removed.
ARCHIVE_AFTER_DAYS = 90
_WORKSPACE_KEY_SEPARATOR = "\x1f"


def normalize_workspace_id(value: str | None) -> str:
    """Return the stable local workspace namespace used by memory queries."""
    workspace = str(value or DEFAULT_WORKSPACE_ID).strip()
    return workspace[:128] or DEFAULT_WORKSPACE_ID


def _storage_key(value: str, workspace_id: str) -> str:
    """Keep legacy natural-key constraints safe across workspaces.

    The first schema used ``topic``, ``problem_id`` and a few idempotency
    values as global primary/unique keys. SQLite cannot widen those existing
    constraints with ``create_all``. Prefixing only non-default workspaces
    preserves old rows and lets every workspace use the same natural name.
    """
    value = str(value or "").strip()
    workspace = normalize_workspace_id(workspace_id)
    if workspace == DEFAULT_WORKSPACE_ID:
        return value
    return f"{workspace}{_WORKSPACE_KEY_SEPARATOR}{value}"


def _logical_key(value: str, workspace_id: str) -> str:
    prefix = f"{normalize_workspace_id(workspace_id)}{_WORKSPACE_KEY_SEPARATOR}"
    return str(value or "").removeprefix(prefix)


def _reme_workspace_path(workspace_id: str) -> Path:
    """Resolve the same ReMe directory layout used by ``AlgoCoach``."""
    root = Path(reme_workspace_dir())
    workspace = normalize_workspace_id(workspace_id)
    if workspace == DEFAULT_WORKSPACE_ID:
        return root
    digest = hashlib.sha256(workspace.encode("utf-8")).hexdigest()[:24]
    return root / "workspaces" / digest


def utcnow() -> datetime:
    """Naive UTC, matching the format already persisted in ``created_at``."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _iso(value: datetime) -> str:
    return value.replace(microsecond=0).isoformat()


def _parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except (TypeError, ValueError):
        return None
    # Older rows are naive UTC. Normalise aware values so comparisons never
    # mix offset-aware and offset-naive datetimes.
    if parsed.tzinfo is not None:
        parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
    return parsed


def _json_list(value: str | None) -> list[str]:
    try:
        parsed = json.loads(value or "[]")
    except (TypeError, ValueError):
        return []
    if not isinstance(parsed, list):
        return []
    return [item for item in parsed if isinstance(item, str) and item.strip()]


def next_review_interval_days(mastery: float, attempts: int, last_interval: int) -> int:
    """SM-2 simplified interval from ``docs/memory-system.md`` §5.

    mastery < 0.4  → halve the interval (reinforce, at least one day)
    mastery > 0.7  → double the interval (maintain, capped at 30 days)
    otherwise      → SM-2 EF mapped linearly from mastery, capped at 30 days

    ``attempts`` is accepted for the documented signature; the current formula
    does not use it (the plan leaves attempt-weighted tuning to future work).
    """
    del attempts  # reserved by the documented signature, intentionally unused
    last_interval = max(1, int(last_interval or 1))
    if mastery < 0.4:
        return max(1, last_interval // 2)
    if mastery > 0.7:
        return min(30, last_interval * 2)
    ef = 1.3 + mastery * 1.3
    return min(30, max(1, round(last_interval * ef)))


def _episode_is_due_material(episode: EpisodicRecord) -> bool:
    """Wrong answers, timeouts and episodes with recorded sticking points.

    A plain ``ACCEPTED`` attempt or a ``REVIEWED`` row without sticking points
    is not a review candidate. This mirrors the "做错或卡过" scope in
    ``docs/backend-agent.md`` §3.4.
    """
    status = (episode.status or "").upper()
    sticking = _json_list(episode.sticking_points)
    if status in {"ACCEPTED", "LOCAL_ACCEPTED", "REVIEWED", "LOCAL_PRACTICE"}:
        return bool(sticking)
    return True


def _episode_sort_key(
    episode: EpisodicRecord | EpisodicArchive,
) -> tuple[datetime, int]:
    """Newest episode by created_at, with insertion id as the tie-breaker."""
    return (_parse_iso(episode.created_at) or datetime.min, episode.id or 0)


def _weakest_snapshot(
    topics: list[str], nodes: dict[str, SemanticNode]
) -> tuple[float, int]:
    """Weakest topic drives priority; unknown topics fall back to neutral."""
    known = [nodes[topic] for topic in topics if topic in nodes]
    if not known:
        return 0.5, 1
    weakest = min(known, key=lambda node: node.mastery)
    return float(weakest.mastery), max(1, int(weakest.attempts))


class MemoryService:
    async def export_archive(self, workspace_id: str | None = None) -> bytes:
        """Create a local-only export, optionally scoped to one workspace."""
        workspace = normalize_workspace_id(workspace_id) if workspace_id else None
        models = {
            "episodic": EpisodicRecord,
            "episodic_archive": EpisodicArchive,
            "memory_record_receipts": MemoryRecordReceipt,
            "semantic": SemanticNode,
            "procedural": ProceduralPattern,
            "notifications": Notification,
            "review_schedule": ReviewSchedule,
            "recommendation_log": RecommendationLog,
            "agent_turns": AgentTurn,
            "agent_turn_events": AgentTurnEvent,
        }
        tables: dict[str, list[dict]] = {}
        async with SessionLocal() as session:
            for name, model in models.items():
                statement = select(model)
                if workspace is not None and hasattr(model, "workspace_id"):
                    statement = statement.where(model.workspace_id == workspace)
                elif workspace is not None and model is AgentTurnEvent:
                    turn_ids = select(AgentTurn.turn_id).where(
                        AgentTurn.workspace_id == workspace
                    )
                    statement = statement.where(AgentTurnEvent.turn_id.in_(turn_ids))
                result = await session.execute(statement)
                exported_rows: list[dict] = []
                for row in result.scalars():
                    payload = {
                        column.key: getattr(row, column.key)
                        for column in model.__table__.columns
                    }
                    if workspace is not None:
                        key_field = {
                            "semantic": "topic",
                            "memory_record_receipts": "client_id",
                            "procedural": "pattern_key",
                            "notifications": "dedupe_key",
                            "review_schedule": "problem_id",
                        }.get(name)
                        if key_field and payload.get(key_field):
                            payload[key_field] = _logical_key(
                                payload[key_field], workspace
                            )
                    exported_rows.append(payload)
                tables[name] = exported_rows

        chroma_root = Path(chroma_path())
        scoped_store = (
            workspace_vector_store(workspace, vector_store)
            if workspace is not None and workspace != DEFAULT_WORKSPACE_ID
            else vector_store
        )
        scoped_chroma_root = (
            Path(scoped_store.path)
            if workspace not in (None, DEFAULT_WORKSPACE_ID)
            else chroma_root
        )
        vector_records = await scoped_store.export_all() if scoped_chroma_root.is_dir() else {}
        snapshot = {
            "format": "algocoach-memory-v1",
            "workspace_id": workspace,
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "tables": tables,
            "vectors": vector_records,
            "secrets_included": False,
        }
        stream = BytesIO()
        with ZipFile(stream, "w", compression=ZIP_DEFLATED) as archive:
            archive.writestr(
                "memory.json",
                json.dumps(snapshot, ensure_ascii=False, indent=2, default=str),
            )
            reme_root = (
                Path(reme_workspace_dir())
                if workspace is None
                else _reme_workspace_path(workspace)
            )
            file_roots = [("reme", str(reme_root))]
            if workspace in (None, DEFAULT_WORKSPACE_ID):
                file_roots.append(("chroma", str(chroma_root)))
            for label, configured_path in file_roots:
                root = Path(configured_path)
                if not root.exists() or not root.is_dir():
                    continue
                resolved_root = root.resolve()
                for item in root.rglob("*"):
                    if (
                        label == "reme"
                        and workspace == DEFAULT_WORKSPACE_ID
                        and item.relative_to(root).parts[0] == "workspaces"
                    ):
                        continue
                    if item.is_symlink() or not item.is_file():
                        continue
                    resolved = item.resolve()
                    if resolved.is_relative_to(resolved_root):
                        archive.write(item, f"{label}/{item.relative_to(root).as_posix()}")
        return stream.getvalue()

    # ── Episodic ──────────────────────────────────────────────

    async def record_attempt(
        self,
        problem_id: str,
        platform: str,
        status: str,
        lang: str,
        duration_sec: int,
        topics: list[str],
        sticking_points: list[str],
        client_id: str | None = None,
        workspace_id: str = DEFAULT_WORKSPACE_ID,
    ) -> bool:
        workspace = normalize_workspace_id(workspace_id)
        async with SessionLocal() as s:
            receipt_key = _storage_key(client_id, workspace) if client_id else None
            if receipt_key and await s.get(MemoryRecordReceipt, receipt_key) is not None:
                return False
            if receipt_key:
                s.add(MemoryRecordReceipt(
                    client_id=receipt_key,
                    workspace_id=workspace,
                ))
            rec = EpisodicRecord(
                workspace_id=workspace,
                problem_id=problem_id,
                platform=platform,
                status=status,
                lang=lang,
                duration_sec=duration_sec,
                topics=json.dumps(topics, ensure_ascii=False),
                sticking_points=json.dumps(sticking_points, ensure_ascii=False),
            )
            s.add(rec)
            try:
                await s.commit()
            except IntegrityError:
                await s.rollback()
                return False

        # Local desktop focus sessions are evidence of practice, but without a
        # run result they must not be interpreted as a pass or a failure.
        if platform.upper() == "LOCAL" and status.upper() == "LOCAL_PRACTICE":
            for topic in topics:
                await self._ensure_topic(topic, workspace)
        else:
            for topic in topics:
                accepted = status in {"ACCEPTED", "LOCAL_ACCEPTED"}
                await self._update_mastery(topic, accepted, workspace)

        # Keep the durable review queue in sync with fresh evidence.
        if _episode_is_due_material(rec):
            await self._refresh_review_schedule(problem_id, workspace)
        return True

    async def recent_problems(
        self, limit: int = 20, workspace_id: str = DEFAULT_WORKSPACE_ID
    ) -> list[dict]:
        workspace = normalize_workspace_id(workspace_id)
        async with SessionLocal() as s:
            rows = await s.execute(
                select(EpisodicRecord)
                .where(EpisodicRecord.workspace_id == workspace)
                .order_by(EpisodicRecord.id.desc())
                .limit(limit)
            )
            return [
                {
                    "problem_id": r.problem_id,
                    "status": r.status,
                    "topics": json.loads(r.topics),
                    "sticking_points": json.loads(r.sticking_points),
                    "duration_sec": r.duration_sec,
                    "created_at": r.created_at,
                }
                for r in rows.scalars()
            ]

    # ── Semantic ──────────────────────────────────────────────

    async def _ensure_topic(
        self, topic: str, workspace_id: str = DEFAULT_WORKSPACE_ID
    ) -> None:
        """Expose a locally practised topic without inventing mastery evidence."""
        workspace = normalize_workspace_id(workspace_id)
        key = _storage_key(topic, workspace)
        async with SessionLocal() as s:
            if await s.get(SemanticNode, key) is None:
                s.add(SemanticNode(
                    topic=key, workspace_id=workspace,
                    mastery=0.5, attempts=0, last_seen="",
                ))
                await s.commit()

    async def _update_mastery(
        self, topic: str, accepted: bool,
        workspace_id: str = DEFAULT_WORKSPACE_ID,
    ) -> None:
        """ELO-inspired mastery update: +0.05 on accept, -0.08 on fail, clamped 0–1."""
        delta = 0.05 if accepted else -0.08
        workspace = normalize_workspace_id(workspace_id)
        key = _storage_key(topic, workspace)
        async with SessionLocal() as s:
            existing = await s.get(SemanticNode, key)
            if existing:
                existing.mastery = max(0.0, min(1.0, existing.mastery + delta))
                existing.attempts += 1
                existing.last_seen = datetime.now(timezone.utc).replace(tzinfo=None).isoformat()
            else:
                s.add(SemanticNode(
                    topic=key,
                    workspace_id=workspace,
                    mastery=max(0.0, 0.5 + delta),
                    attempts=1,
                    last_seen=datetime.now(timezone.utc).replace(tzinfo=None).isoformat(),
                ))
            await s.commit()

    async def weak_topics(
        self, threshold: float = 0.6, top_n: int = 5,
        workspace_id: str = DEFAULT_WORKSPACE_ID,
    ) -> list[dict]:
        """Return topics below mastery threshold, sorted ascending (weakest first)."""
        workspace = normalize_workspace_id(workspace_id)
        async with SessionLocal() as s:
            rows = await s.execute(
                select(SemanticNode)
                .where(
                    SemanticNode.workspace_id == workspace,
                    SemanticNode.mastery < threshold,
                )
                .order_by(SemanticNode.mastery)
                .limit(top_n)
            )
            return [
                {"topic": _logical_key(r.topic, workspace), "mastery": round(r.mastery, 2), "attempts": r.attempts}
                for r in rows.scalars()
            ]

    async def all_topics(self, workspace_id: str = DEFAULT_WORKSPACE_ID) -> list[dict]:
        workspace = normalize_workspace_id(workspace_id)
        async with SessionLocal() as s:
            rows = await s.execute(
                select(SemanticNode)
                .where(SemanticNode.workspace_id == workspace)
                .order_by(SemanticNode.mastery)
            )
            return [
                {"topic": _logical_key(r.topic, workspace), "mastery": round(r.mastery, 2), "attempts": r.attempts}
                for r in rows.scalars()
            ]

    async def get_mastery(
        self, topic: str, workspace_id: str = DEFAULT_WORKSPACE_ID
    ) -> dict:
        """Return one topic's mastery snapshot, defaulting to the project baseline.

        A topic that has never been seen has no ``semantic`` row. Existing code
        treats that as mastery ``0.5`` with ``0`` attempts (the ORM default and
        ``_weakest_snapshot``'s neutral fallback), so this single-row lookup
        returns the same shape instead of ``None``. Callers that must
        distinguish "unknown" from "exactly 0.5" can inspect ``attempts``.
        """
        name = (topic or "").strip()
        if not name:
            return {"topic": "", "mastery": 0.5, "attempts": 0}
        workspace = normalize_workspace_id(workspace_id)
        async with SessionLocal() as s:
            node = await s.get(SemanticNode, _storage_key(name, workspace))
            if node is None:
                return {"topic": name, "mastery": 0.5, "attempts": 0}
            return {
                "topic": _logical_key(node.topic, workspace),
                "mastery": float(node.mastery),
                "attempts": int(node.attempts),
            }

    # ── Notifications ─────────────────────────────────────────

    async def notify_user(
        self,
        type: str,
        content: str,
        dedupe_key: str | None = None,
        now: datetime | None = None,
        workspace_id: str = DEFAULT_WORKSPACE_ID,
    ) -> Notification | None:
        """Persist a notification, returning ``None`` for a duplicate key.

        The unique ``dedupe_key`` is the retry/restart guard. A concurrent or
        repeated insert loses the unique race and is treated as already sent,
        so callers must treat ``None`` as "nothing new happened".
        """
        now = now or utcnow()
        workspace = normalize_workspace_id(workspace_id)
        async with SessionLocal() as s:
            notification = Notification(
                workspace_id=workspace,
                type=type,
                content=content,
                created_at=_iso(now),
                read=False,
                dedupe_key=_storage_key(dedupe_key, workspace) if dedupe_key else None,
            )
            s.add(notification)
            try:
                await s.commit()
            except IntegrityError:
                await s.rollback()
                return None
            return notification

    async def review_push_count(
        self, local_date: str, workspace_id: str = DEFAULT_WORKSPACE_ID
    ) -> int:
        """Count review pushes already sent for one scheduling-local date.

        The dedupe key starts with ``review:<YYYY-MM-DD>:``, so counting those
        keys enforces the daily three-problem budget even when the cron job is
        retried or triggered more than once in a day.
        """
        prefix = f"review:{local_date}:"
        workspace = normalize_workspace_id(workspace_id)
        stored_prefix = _storage_key(prefix, workspace)
        async with SessionLocal() as s:
            rows = await s.execute(
                select(Notification.id).where(
                    Notification.workspace_id == workspace,
                    Notification.type == "review",
                    Notification.dedupe_key.like(f"{stored_prefix}%"),
                )
            )
            return len(list(rows.scalars()))

    # ── Review schedule ───────────────────────────────────────

    async def seed_review_schedule(
        self, now: datetime | None = None,
        workspace_id: str = DEFAULT_WORKSPACE_ID,
    ) -> int:
        """Derive initial due state from pre-existing episodic rows.

        The schedule is keyed by problem and seeded from the newest eligible
        episode. The initial interval is the documented SM-2 formula starting
        from a one-day base: ``due_at = episode.created_at + interval``. Old
        episodes therefore land in the past and become immediately due, while
        recent ones wait for their interval to elapse. Existing rows are never
        overwritten, so this is safe to run on every query/startup.
        """
        now = now or utcnow()
        workspace = normalize_workspace_id(workspace_id)
        inserted = 0
        async with SessionLocal() as s:
            existing = set(
                (await s.execute(
                    select(ReviewSchedule.problem_id).where(
                        ReviewSchedule.workspace_id == workspace
                    )
                )).scalars()
            )
            episodes = list(
                (await s.execute(
                    select(EpisodicRecord)
                    .where(EpisodicRecord.workspace_id == workspace)
                    .order_by(EpisodicRecord.id)
                ))
                .scalars()
            )
            latest: dict[str, EpisodicRecord] = {}
            for episode in episodes:
                if not _episode_is_due_material(episode):
                    continue
                current = latest.get(episode.problem_id)
                # Newest by created_at (id breaks ties) rather than insertion
                # order, so a backfilled older attempt cannot mask recent work.
                if current is None or _episode_sort_key(episode) >= _episode_sort_key(current):
                    latest[episode.problem_id] = episode

            for problem_id, episode in latest.items():
                if _storage_key(problem_id, workspace) in existing:
                    continue
                topics = _json_list(episode.topics)
                nodes = await self._semantic_nodes(s, topics, workspace)
                mastery, attempts = _weakest_snapshot(topics, nodes)
                interval = next_review_interval_days(mastery, attempts, 1)
                created = _parse_iso(episode.created_at) or now
                s.add(ReviewSchedule(
                    problem_id=_storage_key(problem_id, workspace),
                    workspace_id=workspace,
                    due_at=_iso(created + timedelta(days=interval)),
                    interval_days=interval,
                    mastery=mastery,
                    attempts=attempts,
                    topics=json.dumps(topics, ensure_ascii=False),
                    source_episode_id=episode.id,
                    notified_on="",
                    last_notified_at="",
                    updated_at=_iso(now),
                ))
                inserted += 1
            await s.commit()
        return inserted

    async def _refresh_review_schedule(
        self, problem_id: str,
        workspace_id: str = DEFAULT_WORKSPACE_ID,
    ) -> ReviewSchedule | None:
        """Upsert the due state for one problem from its newest eligible episode."""
        workspace = normalize_workspace_id(workspace_id)
        async with SessionLocal() as s:
            episodes = list(
                (await s.execute(
                    select(EpisodicRecord)
                    .where(
                        EpisodicRecord.workspace_id == workspace,
                        EpisodicRecord.problem_id == problem_id,
                    )
                    .order_by(EpisodicRecord.id.desc())
                )).scalars()
            )
            latest = max(
                (e for e in episodes if _episode_is_due_material(e)),
                key=_episode_sort_key,
                default=None,
            )
            if latest is None:
                return None

            topics = _json_list(latest.topics)
            nodes = await self._semantic_nodes(s, topics, workspace)
            mastery, attempts = _weakest_snapshot(topics, nodes)

            schedule = await s.get(
                ReviewSchedule, _storage_key(problem_id, workspace)
            )
            base_interval = schedule.interval_days if schedule else 1
            interval = next_review_interval_days(mastery, attempts, base_interval)
            created = _parse_iso(latest.created_at) or utcnow()
            due = created + timedelta(days=interval)

            if schedule is None:
                schedule = ReviewSchedule(
                    problem_id=_storage_key(problem_id, workspace),
                    workspace_id=workspace,
                    due_at=_iso(due),
                    interval_days=interval,
                    mastery=mastery,
                    attempts=attempts,
                    topics=json.dumps(topics, ensure_ascii=False),
                    source_episode_id=latest.id,
                    notified_on="",
                    last_notified_at="",
                    updated_at=_iso(utcnow()),
                )
                s.add(schedule)
            else:
                schedule.due_at = _iso(due)
                schedule.interval_days = interval
                schedule.mastery = mastery
                schedule.attempts = attempts
                schedule.topics = json.dumps(topics, ensure_ascii=False)
                schedule.source_episode_id = latest.id
                schedule.updated_at = _iso(utcnow())
            await s.commit()
            return schedule

    async def due_reviews(
        self,
        now: datetime | None = None,
        limit: int = MAX_REVIEW_PUSHES_PER_DAY,
        local_date: str | None = None,
        workspace_id: str = DEFAULT_WORKSPACE_ID,
    ) -> list[dict]:
        """Return due problems, weakest mastery first, at most ``limit``.

        Rows already notified on ``local_date`` (defaults to the UTC date) are
        skipped. The cron job passes its scheduling-local date so the skip
        matches the notification dedupe key across timezones. Current mastery
        is recomputed from the semantic table so a topic improved elsewhere is
        not stuck at its old priority snapshot.
        """
        now = now or utcnow()
        workspace = normalize_workspace_id(workspace_id)
        limit = max(0, int(limit))
        if limit == 0:
            return []

        await self.seed_review_schedule(now=now, workspace_id=workspace)
        async with SessionLocal() as s:
            rows = list(
                (await s.execute(
                    select(ReviewSchedule)
                    .where(
                        ReviewSchedule.workspace_id == workspace,
                        ReviewSchedule.due_at <= _iso(now),
                    )
                    .order_by(ReviewSchedule.due_at, ReviewSchedule.problem_id)
                )).scalars()
            )
            if not rows:
                return []

            all_topics: set[str] = set()
            parsed_topics: dict[str, list[str]] = {}
            for row in rows:
                topics = _json_list(row.topics)
                parsed_topics[row.problem_id] = topics
                all_topics.update(topics)
            nodes = await self._semantic_nodes(s, sorted(all_topics), workspace)

            today = local_date or now.date().isoformat()
            candidates: list[dict] = []
            for row in rows:
                if row.notified_on == today:
                    continue
                mastery, attempts = _weakest_snapshot(
                    parsed_topics[row.problem_id], nodes
                )
                row.mastery = mastery
                row.attempts = attempts
                candidates.append({
                    "problem_id": _logical_key(row.problem_id, workspace),
                    "due_at": row.due_at,
                    "interval_days": row.interval_days,
                    "mastery": round(mastery, 4),
                    "attempts": attempts,
                    "topics": parsed_topics[row.problem_id],
                })

            candidates.sort(
                key=lambda item: (
                    item["mastery"],
                    item["due_at"],
                    item["problem_id"],
                )
            )
            result = candidates[:limit]
            await s.commit()
            return result

    async def mastery_path(
        self,
        now: datetime | None = None,
        limit: int = 6,
        workspace_id: str = DEFAULT_WORKSPACE_ID,
    ) -> dict:
        """Build a short, explainable learning path from local evidence.

        This is the deterministic counterpart to the ``mastery_path`` agent
        capability. It combines semantic mastery, observed topic relations and
        durable review schedules, while keeping every query scoped to one
        workspace. Due reviews lead the path; within the same urgency bucket,
        lower mastery is ordered first. Unknown topics found only in a review
        schedule are retained at the neutral 0.5 baseline so a due item never
        disappears from the learner's next steps.
        """
        now = now or utcnow()
        workspace = normalize_workspace_id(workspace_id)
        try:
            requested_limit = int(limit)
        except (TypeError, ValueError):
            requested_limit = 6
        limit = max(1, min(MAX_MASTERY_PATH_STEPS, requested_limit))

        async with SessionLocal() as s:
            nodes = list((await s.execute(
                select(SemanticNode)
                .where(SemanticNode.workspace_id == workspace)
                .order_by(SemanticNode.mastery, SemanticNode.topic)
            )).scalars())
            schedules = list((await s.execute(
                select(ReviewSchedule)
                .where(ReviewSchedule.workspace_id == workspace)
            )).scalars())
            hot_episodes = list((await s.execute(
                select(EpisodicRecord)
                .where(EpisodicRecord.workspace_id == workspace)
            )).scalars())
            archived_episodes = list((await s.execute(
                select(EpisodicArchive)
                .where(EpisodicArchive.workspace_id == workspace)
            )).scalars())

        node_by_topic = {
            _logical_key(node.topic, workspace): node for node in nodes
        }
        all_topics = set(node_by_topic)
        due_by_topic: dict[str, list[dict[str, Any]]] = defaultdict(list)
        due_problems: dict[str, dict[str, Any]] = {}
        for schedule in schedules:
            due_at = _parse_iso(schedule.due_at)
            if due_at is None or due_at > now:
                continue
            topics = [
                _logical_key(topic, workspace)
                for topic in _json_list(schedule.topics)
            ]
            if not topics:
                continue
            problem_id = _logical_key(schedule.problem_id, workspace)
            due_item: dict[str, Any] = {
                "problemId": problem_id,
                "dueAt": schedule.due_at,
                "intervalDays": int(schedule.interval_days or 1),
                "topics": topics,
            }
            due_problems[problem_id] = due_item
            all_topics.update(topics)
            for topic in topics:
                due_by_topic[topic].append(due_item)

        # ``related_topics`` is a lightweight semantic relation supplied by the
        # agent. Co-occurrence from real attempts fills the graph for topics
        # that have no explicit relation yet.
        related: dict[str, set[str]] = defaultdict(set)
        for topic, semantic_node in node_by_topic.items():
            for relation in _json_list(semantic_node.related_topics):
                relation = _logical_key(relation, workspace)
                if relation and relation != topic:
                    related[topic].add(relation)
                    related[relation].add(topic)

        observed_topics = set(node_by_topic)
        episodes: list[EpisodicRecord | EpisodicArchive] = [
            *hot_episodes, *archived_episodes
        ]
        for episode in episodes:
            episode_topics = sorted(
                set(_logical_key(topic, workspace) for topic in _json_list(episode.topics))
                & observed_topics
            )
            for index, left in enumerate(episode_topics):
                for right in episode_topics[index + 1:]:
                    related[left].add(right)
                    related[right].add(left)

        candidates: list[dict[str, Any]] = []
        for topic in all_topics:
            candidate_node = node_by_topic.get(topic)
            mastery = float(candidate_node.mastery) if candidate_node is not None else 0.5
            attempts = int(candidate_node.attempts) if candidate_node is not None else 0
            due = sorted(
                due_by_topic.get(topic, []),
                key=lambda item: (item["dueAt"], item["problemId"]),
            )
            weak_subtopics = _json_list(candidate_node.weak_subtopics) if candidate_node is not None else []
            related_topics = sorted(
                relation for relation in related.get(topic, set())
                if relation in all_topics and relation != topic
            )

            if due:
                action = "review"
                reason = f"有 {len(due)} 个复习题已到期，先回收间隔复习证据"
            elif attempts == 0:
                action = "practice"
                reason = "还没有练习证据，先完成一个基础练习"
            elif mastery < 0.4:
                action = "reinforce"
                reason = f"掌握度仅 {round(mastery * 100)}%，是当前最薄弱的知识点"
            elif mastery < 0.7:
                action = "practice"
                reason = f"掌握度为 {round(mastery * 100)}%，需要通过变式练习巩固"
            else:
                action = "apply"
                reason = f"掌握度为 {round(mastery * 100)}%，适合用综合题验证迁移"

            if weak_subtopics:
                reason += f"；待加强：{'、'.join(weak_subtopics[:3])}"

            candidates.append({
                "topic": topic,
                "mastery": round(max(0.0, min(1.0, mastery)), 4),
                "attempts": attempts,
                "lastSeen": candidate_node.last_seen if candidate_node is not None else "",
                "weakSubtopics": weak_subtopics,
                "relatedTopics": related_topics,
                "recommendedAction": action,
                "reason": reason,
                "dueReviews": due,
                # Due work is an explicit urgency signal. Mastery then breaks
                # ties, which keeps the weakest topic first when no reviews are
                # waiting and makes the ordering easy to explain to the user.
                "_sort": (0 if due else 1, mastery, topic),
            })

        candidates.sort(key=lambda item: item["_sort"])
        steps = []
        for position, candidate in enumerate(candidates[:limit], start=1):
            candidate.pop("_sort", None)
            candidate["position"] = position
            steps.append(candidate)

        return {
            "workspaceId": workspace,
            "generatedAt": _iso(now),
            "steps": steps,
            "emptyReason": (
                "当前还没有可用的知识点证据；完成一次练习后，系统会生成学习路径。"
                if not steps else None
            ),
            "sourceSummary": {
                "topics": len(all_topics),
                "dueReviews": len(due_problems),
            },
        }

    async def mark_review_pushed(
        self,
        problem_id: str,
        now: datetime | None = None,
        local_date: str | None = None,
        workspace_id: str = DEFAULT_WORKSPACE_ID,
    ) -> str | None:
        """Advance the schedule after a successful notification.

        The interval uses the documented formula but floors at two days: a push
        is only a reminder, not proof the user practised, and the assignment
        forbids re-pushing the same problem every day. ``local_date`` keeps the
        skip label aligned with the dedupe key's scheduling timezone.
        """
        now = now or utcnow()
        workspace = normalize_workspace_id(workspace_id)
        async with SessionLocal() as s:
            schedule = await s.get(
                ReviewSchedule, _storage_key(problem_id, workspace)
            )
            if schedule is None:
                return None
            interval = max(
                MIN_REVIEW_PUSH_INTERVAL_DAYS,
                next_review_interval_days(
                    schedule.mastery, schedule.attempts, schedule.interval_days
                ),
            )
            schedule.interval_days = interval
            schedule.due_at = _iso(now + timedelta(days=interval))
            schedule.notified_on = local_date or now.date().isoformat()
            schedule.last_notified_at = _iso(now)
            schedule.updated_at = _iso(now)
            await s.commit()
            return schedule.due_at

    @staticmethod
    async def _semantic_nodes(
        session, topics: list[str], workspace_id: str = DEFAULT_WORKSPACE_ID
    ) -> dict[str, SemanticNode]:
        if not topics:
            return {}
        workspace = normalize_workspace_id(workspace_id)
        keys = [_storage_key(topic, workspace) for topic in topics]
        rows = await session.execute(
            select(SemanticNode).where(
                SemanticNode.workspace_id == workspace,
                SemanticNode.topic.in_(keys),
            )
        )
        return {
            _logical_key(node.topic, workspace): node
            for node in rows.scalars()
        }

    # ── Weekly report ─────────────────────────────────────────

    async def weekly_stats(
        self, now: datetime | None = None, days: int = 7,
        workspace_id: str = DEFAULT_WORKSPACE_ID,
    ) -> dict:
        """Aggregate the rolling ``days``-day window for the weekly report."""
        now = now or utcnow()
        workspace = normalize_workspace_id(workspace_id)
        start = now - timedelta(days=days)
        async with SessionLocal() as s:
            rows = list((await s.execute(
                select(EpisodicRecord).where(
                    EpisodicRecord.workspace_id == workspace
                )
            )).scalars())

        episodes = [
            row for row in rows
            if (_parse_iso(row.created_at) or datetime.min) >= start
        ]
        episodes.sort(key=lambda row: row.id)

        topic_counts: Counter[str] = Counter()
        sticking_counts: Counter[str] = Counter()
        accepted = 0
        reviewed = 0
        for episode in episodes:
            topic_counts.update(_json_list(episode.topics))
            sticking_counts.update(_json_list(episode.sticking_points))
            if (episode.status or "").upper() == "ACCEPTED":
                accepted += 1
            if (episode.status or "").upper() == "REVIEWED":
                reviewed += 1

        return {
            "week_start": start.date().isoformat(),
            "week_end": now.date().isoformat(),
            "total_attempts": len(episodes),
            "accepted": accepted,
            "non_accepted": len(episodes) - accepted,
            "reviewed": reviewed,
            "topics": [
                {"name": name, "count": count}
                for name, count in topic_counts.most_common(8)
            ],
            "weak_topics": await self.weak_topics(
                threshold=0.6, top_n=5, workspace_id=workspace
            ),
            "sticking_points": [
                point for point, _ in sticking_counts.most_common(5)
            ],
            "problems": [episode.problem_id for episode in episodes[-20:]],
        }

    async def profile_snapshot(
        self, workspace_id: str = DEFAULT_WORKSPACE_ID
    ) -> dict:
        """Return bounded persisted facts needed by local progress and topic views."""
        workspace = normalize_workspace_id(workspace_id)
        async with SessionLocal() as session:
            nodes = list((await session.execute(
                select(SemanticNode)
                .where(SemanticNode.workspace_id == workspace)
                .order_by(SemanticNode.mastery, SemanticNode.topic)
            )).scalars())
            hot_rows: list[EpisodicRecord] = list((await session.execute(
                select(EpisodicRecord)
                .where(EpisodicRecord.workspace_id == workspace)
                .order_by(EpisodicRecord.id.desc())
            )).scalars())
            archive_rows: list[EpisodicArchive] = list((await session.execute(
                select(EpisodicArchive)
                .where(EpisodicArchive.workspace_id == workspace)
                .order_by(EpisodicArchive.id.desc())
            )).scalars())
        episodes: list[EpisodicRecord | EpisodicArchive] = [*hot_rows, *archive_rows]
        episodes.sort(key=_episode_sort_key, reverse=True)

        topic_names = {_logical_key(node.topic, workspace) for node in nodes}
        co_occurrence: Counter[tuple[str, str]] = Counter()
        for episode in episodes:
            topics = sorted(set(_json_list(episode.topics)) & topic_names)
            for left_index, left in enumerate(topics):
                for right in topics[left_index + 1:]:
                    co_occurrence[(left, right)] += 1

        topic_nodes = [
            {
                "topic": _logical_key(node.topic, workspace),
                "mastery": round(float(node.mastery), 2),
                "attempts": int(node.attempts),
                "lastSeen": node.last_seen,
                "weakSubtopics": _json_list(node.weak_subtopics),
                "relatedTopics": _json_list(node.related_topics),
            }
            for node in nodes
        ]
        dates = {
            parsed.date()
            for episode in episodes
            if (parsed := _parse_iso(episode.created_at)) is not None
        }
        today = utcnow().date()
        streak = 0
        cursor = today if today in dates else today - timedelta(days=1)
        while cursor in dates:
            streak += 1
            cursor -= timedelta(days=1)

        accepted = sum((episode.status or "").upper() == "ACCEPTED" for episode in episodes)
        total_duration = sum(max(0, int(episode.duration_sec or 0)) for episode in episodes)
        daily_counts = Counter(
            parsed.date().isoformat()
            for episode in episodes
            if (parsed := _parse_iso(episode.created_at)) is not None
            and parsed.date() >= today - timedelta(days=34)
        )
        daily_attempts = [
            {
                "date": (today - timedelta(days=34 - index)).isoformat(),
                "count": daily_counts[(today - timedelta(days=34 - index)).isoformat()],
            }
            for index in range(35)
        ]
        recent = episodes[:10]
        return {
            "topics": topic_nodes,
            "edges": [
                {"from": left, "to": right, "weight": weight}
                for (left, right), weight in sorted(co_occurrence.items())
            ],
            "recentProblems": [
                {
                    "problemId": episode.problem_id,
                    "platform": episode.platform,
                    "status": episode.status,
                    "topics": _json_list(episode.topics),
                    "durationSec": int(episode.duration_sec or 0),
                    "createdAt": episode.created_at,
                }
                for episode in recent
            ],
            "dailyAttempts": daily_attempts,
            "stats": {
                "totalAttempts": len(episodes),
                "accepted": accepted,
                "averageDurationSec": round(total_duration / len(episodes)) if episodes else 0,
                "streakDays": streak,
            },
        }

    # ── Archive ───────────────────────────────────────────────

    async def archive_old_episodes(
        self,
        now: datetime | None = None,
        days: int = ARCHIVE_AFTER_DAYS,
        workspace_id: str = DEFAULT_WORKSPACE_ID,
    ) -> dict:
        """Move episodes older than ``days`` to ``episodic_archive`` atomically.

        Copy and delete happen in one SQLAlchemy session/transaction, so a
        failure leaves the hot table untouched. The archive keeps the original
        ``id``, which makes a rerun skip already-copied rows and still delete
        the hot row; no episode can be lost or duplicated.
        """
        now = now or utcnow()
        workspace = normalize_workspace_id(workspace_id)
        cutoff_dt = now - timedelta(days=days)
        cutoff = _iso(cutoff_dt)
        copied = 0
        already_archived = 0
        removed = 0

        async with SessionLocal() as s:
            all_rows = list((await s.execute(
                select(EpisodicRecord).where(
                    EpisodicRecord.workspace_id == workspace
                )
            )).scalars())
            # Parse instead of comparing ISO strings so sub-second timestamps
            # around the cutoff are handled consistently.
            old_rows = [
                row for row in all_rows
                if (_parse_iso(row.created_at) or datetime.max) < cutoff_dt
            ]
            archived_ids: set[int] = set()
            if old_rows:
                # Read the full archive key set instead of an IN (...) list:
                # SQLite parameter limits would otherwise bite on large
                # backlogs (the plan allows up to 10,000 hot episodes).
                archived_ids = set(
                    (await s.execute(
                        select(EpisodicArchive.id).where(
                            EpisodicArchive.workspace_id == workspace
                        )
                    )).scalars()
                )

            for row in old_rows:
                if row.id not in archived_ids:
                    s.add(EpisodicArchive(
                        id=row.id,
                        workspace_id=workspace,
                        problem_id=row.problem_id,
                        platform=row.platform,
                        status=row.status,
                        lang=row.lang,
                        duration_sec=row.duration_sec,
                        topics=row.topics,
                        sticking_points=row.sticking_points,
                        created_at=row.created_at,
                        archived_at=_iso(now),
                    ))
                    copied += 1
                else:
                    already_archived += 1

            for row in old_rows:
                await s.delete(row)
                removed += 1

            # One commit: both the archive inserts and the deletes land together.
            await s.commit()

        return {
            "archived": copied,
            "already_archived": already_archived,
            "removed": removed,
            "cutoff": cutoff,
        }

    # ── Procedural ────────────────────────────────────────────

    async def upsert_pattern(
        self, key: str, description: str,
        workspace_id: str = DEFAULT_WORKSPACE_ID,
    ) -> None:
        workspace = normalize_workspace_id(workspace_id)
        storage_key = _storage_key(key, workspace)
        async with SessionLocal() as s:
            result = await s.execute(
                select(ProceduralPattern).where(
                    ProceduralPattern.workspace_id == workspace,
                    ProceduralPattern.pattern_key == storage_key,
                )
            )
            existing = result.scalar_one_or_none()
            if existing:
                existing.frequency += 1
                existing.last_seen = datetime.now(timezone.utc).replace(tzinfo=None).isoformat()
            else:
                s.add(ProceduralPattern(
                    workspace_id=workspace,
                    pattern_key=storage_key,
                    description=description,
                    frequency=1,
                    last_seen=datetime.now(timezone.utc).replace(tzinfo=None).isoformat(),
                ))
            await s.commit()

    async def top_patterns(
        self, top_n: int = 5,
        workspace_id: str = DEFAULT_WORKSPACE_ID,
    ) -> list[dict]:
        workspace = normalize_workspace_id(workspace_id)
        async with SessionLocal() as s:
            rows = await s.execute(
                select(ProceduralPattern)
                .where(ProceduralPattern.workspace_id == workspace)
                .order_by(ProceduralPattern.frequency.desc())
                .limit(top_n)
            )
            return [
                {"key": _logical_key(r.pattern_key, workspace), "description": r.description, "frequency": r.frequency}
                for r in rows.scalars()
            ]

    async def list_patterns(self, workspace_id: str = DEFAULT_WORKSPACE_ID) -> list[dict]:
        workspace = normalize_workspace_id(workspace_id)
        async with SessionLocal() as session:
            rows = (await session.execute(
                select(ProceduralPattern).where(ProceduralPattern.workspace_id == workspace)
                .order_by(ProceduralPattern.last_seen.desc())
            )).scalars()
            return [{"id": row.id, "description": row.description, "frequency": row.frequency,
                     "lastSeen": row.last_seen} for row in rows]

    async def delete_pattern(self, pattern_id: int, workspace_id: str = DEFAULT_WORKSPACE_ID) -> bool:
        workspace = normalize_workspace_id(workspace_id)
        async with SessionLocal() as session:
            row = (await session.execute(select(ProceduralPattern).where(
                ProceduralPattern.id == pattern_id, ProceduralPattern.workspace_id == workspace,
            ))).scalar_one_or_none()
            if row is None:
                return False
            await session.delete(row)
            await session.commit()
            return True

    # ── Composite context for agent prompt ───────────────────

    async def build_context_snapshot(
        self, workspace_id: str = DEFAULT_WORKSPACE_ID
    ) -> dict:
        """
        Called before each agent Claude invocation.
        Returns a compact dict the agent inserts into its system prompt.
        """
        return {
            "weak_topics": await self.weak_topics(workspace_id=workspace_id),
            "recent_problems": await self.recent_problems(
                limit=5, workspace_id=workspace_id
            ),
            "common_mistakes": await self.top_patterns(
                top_n=3, workspace_id=workspace_id
            ),
        }


# Singleton
memory = MemoryService()


async def notify_user(
    type: str,
    content: str,
    dedupe_key: str | None = None,
    now: datetime | None = None,
    workspace_id: str = DEFAULT_WORKSPACE_ID,
) -> Notification | None:
    """Module-level ``notify_user`` matching the plan's cron skeleton.

    Delegates to the singleton so there is one persistence path and one set of
    dedupe semantics.
    """
    return await memory.notify_user(
        type, content, dedupe_key=dedupe_key, now=now,
        workspace_id=workspace_id,
    )
