"""
AnimationService — enqueues Remotion render jobs.

Pipeline:
  1. Agent (Claude) outputs Remotion JSX composition code
  2. We write it to a temp composition file
  3. Shell out to `npx remotion render` to produce MP4
  4. Serve the video URL

For MVP we use a library of prebuilt composition components — the agent
picks one by name and supplies data props, so it doesn't need to write
arbitrary JSX from scratch. This keeps generation fast and consistent.
"""
import asyncio
import json
import logging
import os
import subprocess
from dataclasses import dataclass

from nanoid import generate

from app.config import remotion_codegen_max_active_jobs, remotion_enabled
from app.remotion.codegen import (
    CodegenError,
    SandboxUnavailable,
    render_generated_code,
)

logger = logging.getLogger(__name__)

LIVE_GENERATED_STATUSES = frozenset({"QUEUED", "RENDERING"})


class AnimationDisabled(RuntimeError):
    """Prebuilt rendering is opt-in (``REMOTION_ENABLED``).

    Every trigger — the chat tool, ``POST /animate`` and the weekly cron — goes
    through :meth:`AnimationService.enqueue`, so the capability is decided here
    exactly once; callers only translate this error into their own surface.
    """


class GeneratedJobLimitExceeded(Exception):
    """Raised when the small generated-job admission cap is full."""

RENDER_BIN = os.getenv("REMOTION_BIN", "npx")  # or path to local remotion CLI
RENDER_TIMEOUT = 120
OUTPUT_DIR = os.getenv("OUTPUT_DIR", "../../data/animations")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Prebuilt components — agent picks by name; we map to composition IDs
PREBUILT = {
    "BFS": "BfsGraph",
    "BFS_GRAPH": "BfsGraph",
    "DFS": "DfsTree",
    "DFS_TREE": "DfsTree",
    "DIJKSTRA": "Dijkstra",
    "DP": "DpTable",
    "DP_TABLE": "DpTable",
    "DYNAMIC": "DpTable",
    "SLIDING_WINDOW": "SlidingWindow",
    "滑动窗口": "SlidingWindow",
    "TWO_POINTER": "TwoPointer",
    "双指针": "TwoPointer",
    "UNION_FIND": "UnionFind",
    "并查集": "UnionFind",
    "HEAP": "HeapSort",
    "HEAP_SORT": "HeapSort",
    "BACKTRACKING": "BacktrackingTree",
    "回溯": "BacktrackingTree",
    "BINARY_SEARCH": "BinarySearch",
    "二分": "BinarySearch",
    "LINKED_LIST": "LinkedListOps",
    "链表": "LinkedListOps",
    "COMPARE": "SolutionCompare",
    "SOLUTION_COMPARE": "SolutionCompare",
    "SORT": "SortVisualizer",
    "SORT_VISUALIZER": "SortVisualizer",
    "GRID_BFS": "GridBfs",
    "网格搜索": "GridBfs",
    # Weekly reports render through a dedicated 1920x1080 / 60fps composition
    # instead of the 1280x720 / 30fps chat composition.
    "WEEKLY_REPORT": "WeeklyReport",
}


@dataclass
class AnimationJob:
    id: str
    kind: str
    title: str
    topic: str
    problem_id: str | None
    component: str              # component ID in remotion project
    props: dict
    composition_id: str = "MainComp"   # Remotion <Composition id> to render
    status: str = "QUEUED"             # QUEUED | RENDERING | READY | FAILED
    video_url: str | None = None
    error: str | None = None


class AnimationService:
    def __init__(self):
        # In-memory job store. Swap for SQLite if persistence is needed.
        self._jobs: dict[str, AnimationJob] = {}
        # Generated jobs still queued/rendering; also drives admission.
        self._generated_tasks: dict[str, asyncio.Task] = {}

    async def enqueue(
        self,
        kind: str,
        topic: str,
        title: str,
        problem_id: str | None = None,
        component: str | None = None,
        props: dict | None = None,
        composition_id: str | None = None,
    ) -> AnimationJob:
        if not remotion_enabled():
            raise AnimationDisabled
        # Default: pick component by topic keyword
        if component is None:
            component = self._guess_component(topic)
        if props is None:
            props = {}
        if composition_id is None:
            # The weekly report is the only prebuilt component with its own
            # 1920x1080 / 60fps composition; everything else uses MainComp.
            composition_id = "WeeklyReport" if component == "WeeklyReport" else "MainComp"

        job = AnimationJob(
            id=generate(size=12),
            kind=kind,
            title=title,
            topic=topic,
            problem_id=problem_id,
            component=component,
            props=props,
            composition_id=composition_id,
        )
        self._jobs[job.id] = job

        # Fire-and-forget render task
        asyncio.create_task(self._render(job.id))
        return job

    def active_generated_jobs(self) -> int:
        """Count queued + rendering generated jobs (prebuilt jobs excluded)."""
        return sum(
            1
            for job in self._jobs.values()
            if job.kind == "GENERATED" and job.status in LIVE_GENERATED_STATUSES
        )

    def generated_capacity_available(self) -> bool:
        return self.active_generated_jobs() < remotion_codegen_max_active_jobs()

    async def enqueue_generated(
        self,
        *,
        title: str,
        code: str,
        props: dict,
    ) -> AnimationJob:
        """Queue a generated composition (P2, feature-flagged).

        Admission is checked synchronously before a job or task exists, so a
        full queue never creates scratch files or starts a render. The caller
        must also have validated the request and sandbox preflight; the render
        task re-validates and is fail-closed if the sandbox is unavailable.
        """
        if not self.generated_capacity_available():
            raise GeneratedJobLimitExceeded("generated_job_limit")
        job = AnimationJob(
            id=generate(size=12),
            kind="GENERATED",
            title=title,
            topic="GENERATED",
            problem_id=None,
            component="Generated",
            props=dict(props),
            composition_id="Generated",
        )
        self._jobs[job.id] = job
        task = asyncio.create_task(self._render_generated(job.id, code))
        self._generated_tasks[job.id] = task
        task.add_done_callback(lambda _task: self._finish_generated_task(job.id))
        return job

    def _finish_generated_task(self, job_id: str) -> None:
        """Release capacity even if the task was cancelled before it started."""
        self._generated_tasks.pop(job_id, None)
        job = self._jobs.get(job_id)
        if job is not None and job.status in LIVE_GENERATED_STATUSES:
            job.status = "FAILED"
            job.error = "cancelled"

    async def get(self, job_id: str) -> AnimationJob | None:
        return self._jobs.get(job_id)

    def _guess_component(self, topic: str) -> str:
        t = topic.upper()
        for kw, comp_id in PREBUILT.items():
            if kw in t:
                return comp_id
        return "BfsGraph"   # fallback

    async def _render_generated(self, job_id: str, code: str) -> None:
        """Render agent-generated TSX only through the bwrap sandbox."""
        job = self._jobs[job_id]
        job.status = "RENDERING"
        out_path = os.path.join(OUTPUT_DIR, f"{job.id}.mp4")
        try:
            await render_generated_code(
                code=code,
                props=job.props,
                destination=out_path,
            )
            job.status = "READY"
            job.video_url = f"/animations/{job.id}.mp4"
        except SandboxUnavailable as exc:
            # No host fallback exists: unavailable means the request fails.
            job.status = "FAILED"
            job.error = f"SandboxUnavailable: {exc.reason}"
            logger.warning("Generated animation refused: %s", exc.reason)
        except CodegenError as exc:
            job.status = "FAILED"
            job.error = f"{exc.code}: {exc.reason}"
            logger.warning("Generated animation failed: %s", exc.reason)
        except asyncio.CancelledError:
            job.status = "FAILED"
            job.error = "cancelled"
            raise
        except Exception as exc:  # noqa: BLE001 - never leak a traceback to callers
            job.status = "FAILED"
            job.error = "generated render failed"
            logger.warning("Generated animation failed: %s", type(exc).__name__)

    async def _render(self, job_id: str) -> None:
        job = self._jobs[job_id]
        job.status = "RENDERING"
        out_path = os.path.join(OUTPUT_DIR, f"{job.id}.mp4")

        # Compose the Remotion render command.
        # MainComp receives {component, data}; a dedicated composition such as
        # WeeklyReport receives its data props directly.
        if job.composition_id == "MainComp":
            render_props = {"component": job.component, "data": job.props}
        else:
            render_props = job.props
        project_root = os.getenv("REMOTION_PROJECT_ROOT") or os.path.abspath(
            os.path.join(os.path.dirname(__file__), "../../../remotion-compositions")
        )
        try:
            proc = await asyncio.create_subprocess_exec(
                RENDER_BIN, "remotion", "render",
                "--props", json.dumps(render_props, ensure_ascii=False),
                "--output", out_path,
                job.composition_id,
                cwd=project_root,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
            try:
                await asyncio.wait_for(proc.wait(), timeout=RENDER_TIMEOUT)
            except TimeoutError:
                proc.kill()
                raise RuntimeError("render timeout")

            if proc.returncode == 0:
                job.status = "READY"
                # Serve from a static path; the gateway exposes /animations/*
                job.video_url = f"/animations/{job.id}.mp4"
            else:
                job.status = "FAILED"
                stderr = await proc.stderr.read() if proc.stderr is not None else b""
                job.error = stderr.decode()
        except Exception as e:  # noqa: BLE001 - prebuilt path, existing behaviour
            job.status = "FAILED"
            job.error = str(e)


animation_service = AnimationService()
