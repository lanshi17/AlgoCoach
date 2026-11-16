import asyncio

import pytest

from app.remotion import animation_service as service
from app.remotion.animation_service import (
    AnimationDisabled,
    AnimationJob,
    AnimationService,
    PREBUILT,
    animation_service,
)


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


def test_browser_args_prefer_explicit_executable(monkeypatch, tmp_path):
    browser = tmp_path / "chromium"
    browser.write_text("#!/bin/sh\n")
    browser.chmod(0o755)
    monkeypatch.setenv("REMOTION_BROWSER_EXECUTABLE", str(browser))

    assert service._browser_args() == ["--browser-executable", str(browser)]


def test_browser_args_fall_back_to_puppeteer_path(monkeypatch, tmp_path):
    browser = tmp_path / "chromium"
    browser.write_text("#!/bin/sh\n")
    browser.chmod(0o755)
    monkeypatch.delenv("REMOTION_BROWSER_EXECUTABLE", raising=False)
    monkeypatch.setenv("PUPPETEER_EXECUTABLE_PATH", str(browser))

    assert service._browser_args() == ["--browser-executable", str(browser)]


def test_browser_args_skip_missing_browser(monkeypatch, tmp_path):
    monkeypatch.setenv("REMOTION_BROWSER_EXECUTABLE", str(tmp_path / "absent"))
    monkeypatch.delenv("PUPPETEER_EXECUTABLE_PATH", raising=False)
    monkeypatch.setattr(service.shutil, "which", lambda _name: None)

    assert service._browser_args() == []


def test_prebuilt_render_passes_the_bundled_browser_to_remotion(monkeypatch, tmp_path):
    browser = tmp_path / "chromium"
    browser.write_text("#!/bin/sh\n")
    browser.chmod(0o755)
    output = tmp_path / "animations"
    output.mkdir()
    monkeypatch.setenv("REMOTION_BROWSER_EXECUTABLE", str(browser))
    monkeypatch.setattr(service, "OUTPUT_DIR", str(output))
    calls = []

    class FinishedProcess:
        returncode = 0

        async def wait(self):
            return 0

    async def fake_create_subprocess_exec(*args, **kwargs):
        calls.append((args, kwargs))
        return FinishedProcess()

    monkeypatch.setattr(service.asyncio, "create_subprocess_exec", fake_create_subprocess_exec)
    worker = AnimationService()
    worker._jobs["render-check"] = AnimationJob(
        id="render-check",
        kind="PRE_EXPLAIN",
        title="BFS",
        topic="BFS",
        problem_id="two-sum",
        component="BfsGraph",
        props={},
    )

    asyncio.run(worker._render("render-check"))

    args, _kwargs = calls[0]
    assert args[0:3] == (service.RENDER_BIN, "remotion", "render")
    assert args[args.index("--browser-executable") + 1] == str(browser)
    assert worker._jobs["render-check"].status == "READY"
