"""
SQLite store for local algorithm-training memories:
  episodic  : per-problem session records
  semantic  : knowledge topic mastery graph
  procedural: user habit/error patterns
  working   : transient per-session state (in-process dict, not persisted)

Operational tables added for P1 scheduled notifications:
  notifications   : persisted user-facing cron messages
  review_schedule : durable spaced-repetition due state per problem
  episodic_archive: cold storage for episodes older than 90 days

P2 self-improve adds:
  recommendation_log: every problem/topic recommendation + its 7-day score

Schema changes are applied by ``init_db()`` through an additive, rerunnable
migration instead of relying on ``create_all`` alone. ``create_all`` creates
new tables; ``_add_missing_columns`` upgrades databases created by an earlier
revision (for example a ``notifications`` table without ``dedupe_key``).
"""
import os
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import String, Float, Integer, Text, Boolean, text
from datetime import datetime, timezone

def _utcnow() -> datetime:
    """Naive UTC, matching the existing ``created_at`` format."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


DB_PATH = os.getenv("DB_PATH", "../../data/agent.db")
engine = create_async_engine(f"sqlite+aiosqlite:///{DB_PATH}", echo=False)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class EpisodicRecord(Base):
    """One row per problem attempt."""
    __tablename__ = "episodic"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    problem_id: Mapped[str] = mapped_column(String(64), index=True)
    platform: Mapped[str] = mapped_column(String(16))
    status: Mapped[str] = mapped_column(String(32))          # ACCEPTED / WRONG_ANSWER …
    lang: Mapped[str] = mapped_column(String(16))
    duration_sec: Mapped[int] = mapped_column(Integer())
    topics: Mapped[str] = mapped_column(Text())              # JSON list
    sticking_points: Mapped[str] = mapped_column(Text())     # JSON list, filled by agent
    created_at: Mapped[str] = mapped_column(String(32), default=lambda: _utcnow().isoformat())


class SemanticNode(Base):
    """Knowledge topic mastery node."""
    __tablename__ = "semantic"

    topic: Mapped[str] = mapped_column(String(64), primary_key=True)
    mastery: Mapped[float] = mapped_column(Float(), default=0.5)   # 0–1
    attempts: Mapped[int] = mapped_column(Integer(), default=0)
    last_seen: Mapped[str] = mapped_column(String(32), default="")
    weak_subtopics: Mapped[str] = mapped_column(Text(), default="[]")   # JSON
    related_topics: Mapped[str] = mapped_column(Text(), default="[]")   # JSON


class ProceduralPattern(Base):
    """Persistent error / habit patterns extracted by agent."""
    __tablename__ = "procedural"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    pattern_key: Mapped[str] = mapped_column(String(128), unique=True)
    description: Mapped[str] = mapped_column(Text())
    frequency: Mapped[int] = mapped_column(Integer(), default=1)
    last_seen: Mapped[str] = mapped_column(String(32), default="")


class Notification(Base):
    """A user-facing message produced by a cron job.

    ``dedupe_key`` is the idempotency boundary: retries, overlapping scheduler
    runs and process restarts insert the same key at most once. A NULL key is
    allowed for ad-hoc/manual messages and is not deduplicated by SQLite.
    """

    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    type: Mapped[str] = mapped_column(String(32), index=True)
    content: Mapped[str] = mapped_column(Text())
    created_at: Mapped[str] = mapped_column(
        String(32), default=lambda: _utcnow().isoformat()
    )
    read: Mapped[bool] = mapped_column(Boolean(), default=False)
    dedupe_key: Mapped[str | None] = mapped_column(
        String(160), unique=True, index=True, nullable=True
    )


class ReviewSchedule(Base):
    """Durable spaced-repetition state, keyed by problem.

    Episodes are attempt rows, so keeping the due state on the episode would
    create one schedule per attempt. This table keeps one row per problem and
    stores the mastery snapshot and topics used to prioritise the daily batch.
    """

    __tablename__ = "review_schedule"

    problem_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    due_at: Mapped[str] = mapped_column(String(32), index=True)
    interval_days: Mapped[int] = mapped_column(Integer(), default=1)
    mastery: Mapped[float] = mapped_column(Float(), default=0.5)
    attempts: Mapped[int] = mapped_column(Integer(), default=1)
    topics: Mapped[str] = mapped_column(Text(), default="[]")          # JSON list
    source_episode_id: Mapped[int | None] = mapped_column(Integer(), nullable=True)
    notified_on: Mapped[str] = mapped_column(String(10), default="")   # local YYYY-MM-DD
    last_notified_at: Mapped[str] = mapped_column(String(32), default="")
    updated_at: Mapped[str] = mapped_column(
        String(32), default=lambda: _utcnow().isoformat()
    )


class EpisodicArchive(Base):
    """Cold storage for episodic rows, preserving the original primary key.

    Preserving ``id`` makes the copy idempotent: a rerun skips an episode that
    is already archived and still removes it from the hot table.
    """

    __tablename__ = "episodic_archive"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=False)
    problem_id: Mapped[str] = mapped_column(String(64), index=True)
    platform: Mapped[str] = mapped_column(String(16))
    status: Mapped[str] = mapped_column(String(32))
    lang: Mapped[str] = mapped_column(String(16))
    duration_sec: Mapped[int] = mapped_column(Integer())
    topics: Mapped[str] = mapped_column(Text())
    sticking_points: Mapped[str] = mapped_column(Text())
    created_at: Mapped[str] = mapped_column(String(32))
    archived_at: Mapped[str] = mapped_column(
        String(32), default=lambda: _utcnow().isoformat()
    )


class RecommendationLog(Base):
    """One recommendation and the outcome of its 7-day backtest.

    Rows are append-only history: evaluating a row updates ``evaluated_at``,
    ``score`` and ``outcome`` exactly once, and never deletes it. There is no
    foreign key to episodic, so archiving or deleting episodes cannot remove a
    historical recommendation. ``score`` stays NULL until the evaluation window
    has elapsed and the row is actually scored.

    ``problem_id`` is NULL for a topic-only recommendation: the agent may only
    recommend a problem whose slug is already confirmed in local memory.
    """

    __tablename__ = "recommendation_log"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    strategy: Mapped[str] = mapped_column(String(32), index=True)
    topic: Mapped[str] = mapped_column(String(64), index=True)
    problem_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    mastery_before: Mapped[float] = mapped_column(Float(), default=0.5)
    created_at: Mapped[str] = mapped_column(
        String(32), default=lambda: _utcnow().isoformat()
    )
    evaluation_due_at: Mapped[str] = mapped_column(String(32), index=True)
    evaluated_at: Mapped[str | None] = mapped_column(
        String(32), nullable=True, index=True
    )
    score: Mapped[int | None] = mapped_column(Integer(), nullable=True)  # -1 / 0 / 1
    outcome: Mapped[str | None] = mapped_column(String(32), nullable=True)
    # Reconstructed mastery at ``evaluation_due_at``. Saved so a score can be
    # audited after later practice has moved the live semantic mastery. NULL
    # for legacy rows evaluated by an older revision.
    mastery_after: Mapped[float | None] = mapped_column(Float(), nullable=True)


# Columns added after the first notifications schema draft. The migration
# below is additive and rerunnable, so it is safe to run on every startup.
_ADDITIVE_COLUMNS: tuple[tuple[str, str, str], ...] = (
    # (table, column, sqlite DDL)
    ("notifications", "read", "BOOLEAN NOT NULL DEFAULT 0"),
    ("notifications", "dedupe_key", "VARCHAR(160)"),
    # recommendation_log may have been drafted earlier with a smaller schema
    # (docs/backend-agent.md §3.5 had only id/topic/problem_id/mastery_before/
    # created_at/evaluated_at/score). Upgrade it in place without touching rows.
    ("recommendation_log", "strategy", "VARCHAR(32) NOT NULL DEFAULT ''"),
    ("recommendation_log", "evaluation_due_at", "VARCHAR(32) NOT NULL DEFAULT ''"),
    ("recommendation_log", "outcome", "VARCHAR(32)"),
    ("recommendation_log", "mastery_after", "REAL"),
)

_ADDITIVE_INDEXES: tuple[str, ...] = (
    "CREATE UNIQUE INDEX IF NOT EXISTS ix_notifications_dedupe_key "
    "ON notifications (dedupe_key)",
    # Due scans and monthly reports read these two columns together.
    "CREATE INDEX IF NOT EXISTS ix_recommendation_log_due "
    "ON recommendation_log (evaluated_at, evaluation_due_at)",
    "CREATE INDEX IF NOT EXISTS ix_recommendation_log_created_at "
    "ON recommendation_log (created_at)",
)


def _table_names(conn) -> set[str]:
    rows = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table'"))
    return {row[0] for row in rows}


def _column_names(conn, table: str) -> set[str]:
    rows = conn.execute(text(f"PRAGMA table_info({table})"))
    return {row[1] for row in rows}


def _migrate_sync(conn) -> None:
    """Create missing tables, then apply additive column/index migrations."""
    Base.metadata.create_all(conn)

    tables = _table_names(conn)
    for table, column, ddl in _ADDITIVE_COLUMNS:
        if table in tables and column not in _column_names(conn, table):
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}"))

    # Created separately so a database upgraded from an older notifications
    # table also gets the dedupe guarantee, not just brand-new databases.
    for statement in _ADDITIVE_INDEXES:
        conn.execute(text(statement))


async def init_db():
    """Idempotent startup migration.

    Safe to call on every process start and safe to re-run against an existing
    database: it never drops tables or columns and never rewrites row data.
    """
    async with engine.begin() as conn:
        await conn.run_sync(_migrate_sync)
