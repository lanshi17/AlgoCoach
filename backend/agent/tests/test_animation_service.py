import asyncio

import pytest

from app.remotion.animation_service import (
    AnimationDisabled,
    PREBUILT,
    animation_service,
)


def test_enqueue_is_the_single_gate_for_the_opt_in(monkeypatch):
    """The chat tool, POST /animate and the cron all call enqueue()."""
    async def fake_render(job_id):
        return None

    monkeypatch.setattr(animation_service, "_render", fake_render)

    monkeypatch.delenv("REMOTION_ENABLED", raising=False)
    with pytest.raises(AnimationDisabled):
        asyncio.run(animation_service.enqueue(kind="PRE_EXPLAIN", topic="BFS", title="BFS"))

    monkeypatch.setenv("REMOTION_ENABLED", "true")
    job = asyncio.run(animation_service.enqueue(kind="PRE_EXPLAIN", topic="BFS", title="BFS"))
    assert job.status == "QUEUED"


def test_prebuilt_mapping_only_targets_registered_compositions():
    registered = {
        "BacktrackingTree",
        "BinarySearch",
        "BfsGraph",
        "DfsTree",
        "Dijkstra",
        "DpTable",
        "GridBfs",
        "HeapSort",
        "LinkedListOps",
        "SolutionCompare",
        "SortVisualizer",
        "SlidingWindow",
        "TwoPointer",
        "UnionFind",
        "WeeklyReport",
    }

    assert set(PREBUILT.values()) <= registered
    assert animation_service._guess_component("DP_TABLE") == "DpTable"
    assert animation_service._guess_component("BINARY_SEARCH") == "BinarySearch"
    assert animation_service._guess_component("并查集") == "UnionFind"
    assert animation_service._guess_component("UNSUPPORTED_GRAPH_TOPIC") == "BfsGraph"
