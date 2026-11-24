"""Mastery-path turns ground the reply in a snapshot read before the model call."""

import pytest
from conftest import FakeChatModel, RecordingReMe

from app.agent.coach import AlgoCoach
from app.memory.memory_service import DEFAULT_WORKSPACE_ID, memory

pytestmark = pytest.mark.asyncio

SNAPSHOT_HEADER = "[本轮学习路径快照]"


def _coach(tmp_path) -> AlgoCoach:
    return AlgoCoach(
        chat_model=FakeChatModel(responses=None),
        reme_middleware=RecordingReMe(str(tmp_path / "reme")),
    )


async def _run_turn(coach: AlgoCoach, session_id: str, capability: str) -> str:
    async for _ in coach.chat_stream(
        session_id, "带我走下一步", "PREP", None, capability=capability
    ):
        pass
    return next(iter(coach._agents.values()))._system_prompt


def _snapshot(prompt: str) -> str:
    assert SNAPSHOT_HEADER in prompt
    return prompt.split(SNAPSHOT_HEADER, 1)[1]


async def test_mastery_path_turn_reads_the_path_before_the_model_call(tmp_path):
    await memory._ensure_topic("二分", DEFAULT_WORKSPACE_ID)
    coach = _coach(tmp_path)

    first = await _run_turn(coach, "path-session", "mastery_path")
    assert "二分" in _snapshot(first)

    # Each turn reads the path again: nothing from the previous turn is reused.
    await memory._ensure_topic("动态规划", DEFAULT_WORKSPACE_ID)
    second = await _run_turn(coach, "path-session", "mastery_path")
    assert "动态规划" in _snapshot(second)


async def test_plain_chat_turn_does_not_read_the_path(tmp_path):
    await memory._ensure_topic("二分", DEFAULT_WORKSPACE_ID)
    coach = _coach(tmp_path)

    prompt = await _run_turn(coach, "chat-session", "chat")
    assert SNAPSHOT_HEADER not in prompt
