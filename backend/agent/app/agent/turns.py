"""Durable turn state and replayable SSE events.

The store is intentionally small and local-first. A turn is created before the
model is called, each emitted event receives a monotonic sequence, and the
terminal state is persisted with the final event. A later client can replay a
completed turn without invoking the model again.
"""
import asyncio
import json
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import func, select

from app.memory.db import AgentTurn, AgentTurnEvent, SessionLocal


def _now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0, tzinfo=None).isoformat()


@dataclass(frozen=True)
class TurnSnapshot:
    turn_id: str
    workspace_id: str
    conversation_id: str
    capability: str
    state: str
    created: bool = False


class TurnConflict(ValueError):
    """The same turn id was reused from another workspace or conversation."""


class TurnStore:
    def __init__(self) -> None:
        self._locks: dict[str, asyncio.Lock] = {}
        self._locks_guard = asyncio.Lock()

    async def _lock_for(self, turn_id: str) -> asyncio.Lock:
        async with self._locks_guard:
            return self._locks.setdefault(turn_id, asyncio.Lock())

    async def begin(
        self,
        turn_id: str,
        *,
        workspace_id: str,
        conversation_id: str,
        capability: str,
    ) -> TurnSnapshot:
        lock = await self._lock_for(turn_id)
        async with lock:
            async with SessionLocal() as session:
                turn = await session.get(AgentTurn, turn_id)
                if turn is None:
                    turn = AgentTurn(
                        turn_id=turn_id,
                        workspace_id=workspace_id,
                        conversation_id=conversation_id,
                        capability=capability,
                        state="running",
                        terminal_content="",
                        created_at=_now(),
                        updated_at=_now(),
                    )
                    session.add(turn)
                    await session.commit()
                    created = True
                elif (
                    turn.workspace_id != workspace_id
                    or turn.conversation_id != conversation_id
                ):
                    raise TurnConflict("turn 与当前 workspace 或 conversation 不匹配")
                else:
                    created = False
                return TurnSnapshot(
                    turn_id=turn.turn_id,
                    workspace_id=turn.workspace_id,
                    conversation_id=turn.conversation_id,
                    capability=turn.capability,
                    state=turn.state,
                    created=created,
                )

    async def append(self, turn_id: str, event: dict) -> dict:
        lock = await self._lock_for(turn_id)
        async with lock:
            async with SessionLocal() as session:
                turn = await session.get(AgentTurn, turn_id)
                if turn is None:
                    raise KeyError(f"未知 turn：{turn_id}")
                latest = await session.scalar(
                    select(func.max(AgentTurnEvent.sequence)).where(
                        AgentTurnEvent.turn_id == turn_id
                    )
                )
                sequence = int(latest or 0) + 1
                payload = {
                    **event,
                    "turn_id": turn_id,
                    "event_id": sequence,
                }
                session.add(AgentTurnEvent(
                    turn_id=turn_id,
                    sequence=sequence,
                    event_type=str(event.get("type", "event")),
                    payload=json.dumps(payload, ensure_ascii=False),
                    created_at=_now(),
                ))
                turn.updated_at = _now()
                if event.get("type") == "done":
                    turn.state = "completed"
                    turn.terminal_content = str(event.get("content") or "")
                elif event.get("type") == "error":
                    turn.state = "failed"
                await session.commit()
                return payload

    async def finish(self, turn_id: str, state: str) -> None:
        if state not in {"completed", "failed"}:
            raise ValueError("非法 turn 终态")
        lock = await self._lock_for(turn_id)
        async with lock:
            async with SessionLocal() as session:
                turn = await session.get(AgentTurn, turn_id)
                if turn is not None and turn.state == "running":
                    turn.state = state
                    turn.updated_at = _now()
                    await session.commit()

    async def replay(self, turn_id: str, after_sequence: int = 0) -> tuple[TurnSnapshot, list[dict]] | None:
        async with SessionLocal() as session:
            turn = await session.get(AgentTurn, turn_id)
            if turn is None:
                return None
            result = await session.execute(
                select(AgentTurnEvent)
                .where(
                    AgentTurnEvent.turn_id == turn_id,
                    AgentTurnEvent.sequence > after_sequence,
                )
                .order_by(AgentTurnEvent.sequence.asc())
            )
            events = [json.loads(row.payload) for row in result.scalars()]
            return (
                TurnSnapshot(
                    turn_id=turn.turn_id,
                    workspace_id=turn.workspace_id,
                    conversation_id=turn.conversation_id,
                    capability=turn.capability,
                    state=turn.state,
                ),
                events,
            )


turn_store = TurnStore()
