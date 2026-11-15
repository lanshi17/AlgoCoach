"""Security and integration tests for the P2 generated-Remotion sandbox.

The generated TSX is untrusted input. These tests pin two separate layers:

* static validation rejects unsafe code/props before any scratch file or
  subprocess exists (defence in depth);
* a real Bubblewrap + systemd-scope preflight proves namespaces, read-only
  mounts, env scrubbing, rlimits, cgroup limits, timeout teardown and a real
  Remotion/Chrome render. When the host cannot provide those properties the
  feature must stay unavailable instead of falling back to host execution.

No test contacts an LLM, the gateway, or the internet. The real sandbox tests
run offline inside ``bwrap --unshare-net``.
"""
from __future__ import annotations

import asyncio
import json
import os
import shutil
import subprocess
import time
from pathlib import Path
from types import SimpleNamespace

import pytest

from app.config import remotion_codegen_max_active_jobs
from app.remotion import animation_service as animation_module
from app.remotion import codegen
from app.remotion.animation_service import (
    GeneratedJobLimitExceeded,
    animation_service,
)
from app.remotion.codegen import (
    CgroupLimits,
    InvalidGeneratedCode,
    RenderFailed,
    RenderTimeout,
    SandboxUnavailable,
    _make_layout,
    _verify_mp4_metadata,
    _verify_output,
    render_generated_code,
    sandbox_manager,
    validate_generated_code,
    validate_props,
)

VALID_CODE = """
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';

export const GeneratedComposition = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ backgroundColor: '#0d1117', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ color: '#58a6ff', fontSize: 72, opacity }}>Generated OK</div>
    </AbsoluteFill>
  );
};
"""


def _enable(monkeypatch, tmp_path: Path) -> Path:
    scratch = tmp_path / "scratch"
    scratch.mkdir(exist_ok=True)
    monkeypatch.setenv("REMOTION_CODEGEN_ENABLED", "true")
    monkeypatch.setenv("REMOTION_CODEGEN_TOKEN", "test-token")
    monkeypatch.setenv("REMOTION_CODEGEN_TMP_ROOT", str(scratch))
    return scratch


def _run_host_probe(command: list[str], *, env: dict[str, str] | None = None) -> str | None:
    """Return a useful reason when a host capability probe cannot run."""
    try:
        completed = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
            env=env,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        return str(exc)
    if completed.returncode == 0:
        return None
    detail = (completed.stderr or completed.stdout).strip().splitlines()
    return detail[-1] if detail else f"exited with status {completed.returncode}"


def _real_sandbox_skip_reason() -> str | None:
    missing = [
        name
        for name in ("bwrap", "node", "systemd-run")
        if shutil.which(name) is None
    ]
    if not (shutil.which("google-chrome") or shutil.which("chromium")):
        missing.append("chrome")
    if not (codegen._REMOTION_ROOT / "node_modules" / "@remotion" / "cli").is_dir():
        missing.append("remotion-compositions")
    if missing:
        return f"real sandbox prerequisites missing: {', '.join(missing)}"

    unshare = shutil.which("unshare")
    if unshare is None:
        return "real sandbox unavailable: the host has no unshare utility to probe namespaces"
    namespace_error = _run_host_probe(
        [
            unshare,
            "--mount",
            "--user",
            "--map-root-user",
            "--pid",
            "--net",
            "--ipc",
            "--uts",
            "--fork",
            "/usr/bin/true",
        ]
    )
    if namespace_error:
        return f"real sandbox unavailable: required Linux namespaces are blocked ({namespace_error})"

    systemd_run = shutil.which("systemd-run")
    assert systemd_run is not None
    cgroup_error = _run_host_probe(
        [
            systemd_run,
            "--user",
            "--scope",
            "--quiet",
            "--collect",
            "-p",
            "MemoryMax=134217728",
            "-p",
            "MemorySwapMax=0",
            "-p",
            "TasksMax=64",
            "-p",
            "CPUQuota=100%",
            "--",
            "/usr/bin/true",
        ],
        env=codegen._systemd_env(),
    )
    if cgroup_error:
        return f"real sandbox unavailable: systemd user scope/cgroup limits are unavailable ({cgroup_error})"
    return None


_REAL_SANDBOX_SKIP_REASON = _real_sandbox_skip_reason()
requires_real_sandbox = pytest.mark.skipif(
    _REAL_SANDBOX_SKIP_REASON is not None,
    reason=_REAL_SANDBOX_SKIP_REASON or "real sandbox host capabilities are available",
)


@pytest.fixture(autouse=True)
def _reset_sandbox(monkeypatch):
    monkeypatch.delenv("REMOTION_CODEGEN_ENABLED", raising=False)
    monkeypatch.delenv("REMOTION_CODEGEN_TMP_ROOT", raising=False)
    monkeypatch.delenv("REMOTION_CODEGEN_TOKEN", raising=False)
    monkeypatch.delenv("REMOTION_CODEGEN_MAX_ACTIVE_JOBS", raising=False)
    monkeypatch.delenv("REMOTION_CODEGEN_BWRAP_BIN", raising=False)
    monkeypatch.delenv("REMOTION_CODEGEN_NODE_BIN", raising=False)
    monkeypatch.delenv("REMOTION_CODEGEN_CHROME_BIN", raising=False)
    sandbox_manager.reset()
    yield
    sandbox_manager.reset()


def _fake_capabilities(max_output_bytes: int = codegen.MAX_OUTPUT_BYTES):
    return SimpleNamespace(
        bwrap_path="/usr/bin/bwrap",
        node_path="/usr/bin/node",
        chrome_path="/usr/bin/google-chrome",
        ffprobe_path=None,
        checks=("namespaces", "remotion_render_smoke"),
        limits={
            "width": codegen.WIDTH,
            "height": codegen.HEIGHT,
            "fps": codegen.FPS,
            "duration_frames": codegen.DURATION_IN_FRAMES,
            "max_output_bytes": max_output_bytes,
            "cpu_seconds": 30,
            "file_size_bytes": codegen.FILE_SIZE_BYTES,
            "open_files": 128,
            "processes": 64,
            "memory_bytes": 128 * 1024 * 1024,
            "swap_bytes": 0,
            "cpu_quota_percent": 100,
            "timeout_seconds": 5,
        },
    )


def _auth_headers(token: str = "test-token") -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


# ── Static validation ─────────────────────────────────────────


def test_valid_composition_passes_static_validation():
    validate_generated_code(VALID_CODE)
    assert validate_props({"label": "hi", "nested": {"items": [1, 2, 3]}}) == {
        "label": "hi",
        "nested": {"items": [1, 2, 3]},
    }


@pytest.mark.parametrize(
    ("code", "reason"),
    [
        ("import React from 'react'; export const GeneratedComposition = () => null;", "only_named_imports_allowed"),
        ("import { useState } from 'react'; export const GeneratedComposition = () => null;", "import_symbol_not_allowed"),
        ("import { readFileSync } from 'fs'; export const GeneratedComposition = () => null;", "import_module_not_allowed"),
        ("const x = import('react'); export const GeneratedComposition = () => null;", "only_named_imports_allowed"),
        ("const x = require('fs'); export const GeneratedComposition = () => null;", "forbidden_identifier:require"),
        ("const x = eval('1'); export const GeneratedComposition = () => null;", "forbidden_identifier:eval"),
        ("const x = Function('return 1'); export const GeneratedComposition = () => null;", "forbidden_identifier:Function"),
        ("const x = process.env; export const GeneratedComposition = () => null;", "forbidden_identifier:process"),
        ("const x = globalThis; export const GeneratedComposition = () => null;", "forbidden_identifier:globalThis"),
        ("const x = fetch('https://evil.example'); export const GeneratedComposition = () => null;", "forbidden_identifier:fetch"),
        ("const x = [].constructor; export const GeneratedComposition = () => null;", "forbidden_identifier:constructor"),
        ("export default function GeneratedComposition() { return null; }", "only_GeneratedComposition_export_allowed"),
        ("export const Other = () => null;", "only_GeneratedComposition_export_allowed"),
        ("export const GeneratedComposition = () => null; export const Second = () => null;", "only_GeneratedComposition_export_allowed"),
        ("export const GeneratedComposition = () => <iframe />;", "jsx_tag_not_allowed:iframe"),
        ("export const GeneratedComposition = () => <script />;", "jsx_tag_not_allowed:script"),
        ("export const GeneratedComposition = () => <div dangerouslySetInnerHTML={{ __html: 'x' }} />;", "forbidden_jsx_attribute"),
        ("export const GeneratedComposition = () => <div onClick={() => 1} />;", "forbidden_jsx_attribute"),
        ("export const GeneratedComposition = () => { const s = `x`; return null; };", "template_literal_not_allowed"),
        ("export const GeneratedComposition = () => <div>{'https://evil.example'}</div>;", "url_literal_not_allowed"),
        ("export const GeneratedComposition = () => { return <div />;", "unbalanced_delimiters"),
        ("export const GeneratedComposition = () => null;\x00", "nul_byte_in_code"),
    ],
)
def test_unsafe_code_is_rejected(code: str, reason: str):
    with pytest.raises(InvalidGeneratedCode) as excinfo:
        validate_generated_code(code)
    assert excinfo.value.reason == reason


def test_oversized_code_is_rejected_before_anything_runs():
    with pytest.raises(InvalidGeneratedCode, match="code_too_large"):
        validate_generated_code("x" * (codegen.MAX_CODE_BYTES + 1))


@pytest.mark.asyncio
async def test_invalid_input_is_rejected_before_scratch_or_subprocess(monkeypatch, tmp_path):
    scratch = tmp_path / "scratch-never-created"
    monkeypatch.setenv("REMOTION_CODEGEN_ENABLED", "true")
    monkeypatch.setenv("REMOTION_CODEGEN_TMP_ROOT", str(scratch))

    async def fail_preflight():
        raise AssertionError("preflight must not run for invalid input")

    monkeypatch.setattr(sandbox_manager, "ensure_available", fail_preflight)

    with pytest.raises(InvalidGeneratedCode):
        await render_generated_code(
            code="export const GeneratedComposition = () => eval('x');",
            props={},
            destination=tmp_path / "out.mp4",
        )
    assert not scratch.exists()


# ── Props validation ─────────────────────────────────────────


def test_props_depth_size_and_keys_are_bounded():
    deep: dict = {}
    cursor = deep
    for _ in range(codegen.MAX_PROPS_DEPTH + 2):
        cursor["a"] = {}
        cursor = cursor["a"]
    with pytest.raises(InvalidGeneratedCode, match="props_too_deep"):
        validate_props(deep)

    with pytest.raises(InvalidGeneratedCode, match="props_string_too_large"):
        validate_props({"text": "x" * (codegen.MAX_PROPS_STRING + 1)})

    with pytest.raises(InvalidGeneratedCode, match="props_key_invalid"):
        validate_props({"bad-key": 1})

    with pytest.raises(InvalidGeneratedCode, match="props_number_out_of_range"):
        validate_props({"value": float("nan")})

    with pytest.raises(InvalidGeneratedCode, match="props_list_too_large"):
        validate_props({"items": list(range(codegen.MAX_PROPS_LIST_ITEMS + 1))})


# ── Feature flag / fail-closed ────────────────────────────────


@pytest.mark.asyncio
async def test_generated_route_is_disabled_by_default(client, monkeypatch, tmp_path):
    scratch = tmp_path / "scratch"
    monkeypatch.setenv("REMOTION_CODEGEN_TMP_ROOT", str(scratch))

    response = await client.post(
        "/animate/generated",
        json={"title": "generated", "code": VALID_CODE, "props": {}},
    )

    assert response.status_code == 503
    assert response.json()["detail"] == {
        "code": "SandboxUnavailable",
        "reason": "codegen_disabled",
    }
    assert not scratch.exists()


@pytest.mark.asyncio
async def test_enabled_without_configured_token_fails_closed(client, monkeypatch, tmp_path):
    scratch = tmp_path / "scratch"
    monkeypatch.setenv("REMOTION_CODEGEN_ENABLED", "true")
    monkeypatch.setenv("REMOTION_CODEGEN_TMP_ROOT", str(scratch))

    async def fail_preflight():
        raise AssertionError("preflight must not run without a configured token")

    monkeypatch.setattr(sandbox_manager, "ensure_available", fail_preflight)

    response = await client.post(
        "/animate/generated",
        content=b"{not-json",
        headers={"content-type": "application/json"},
    )

    assert response.status_code == 503
    assert response.json()["detail"] == {
        "code": "SandboxUnavailable",
        "reason": "codegen_token_missing",
    }
    assert not scratch.exists()


@pytest.mark.asyncio
async def test_direct_render_without_token_fails_closed(monkeypatch, tmp_path):
    monkeypatch.setenv("REMOTION_CODEGEN_ENABLED", "true")
    monkeypatch.setenv("REMOTION_CODEGEN_TMP_ROOT", str(tmp_path / "scratch"))

    async def fail_preflight():
        raise AssertionError("token check must run before preflight")

    monkeypatch.setattr(sandbox_manager, "_preflight", fail_preflight)

    with pytest.raises(SandboxUnavailable) as excinfo:
        await render_generated_code(
            code=VALID_CODE,
            props={},
            destination=tmp_path / "out.mp4",
        )
    assert excinfo.value.reason == "codegen_token_missing"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "headers",
    [
        {},
        {"Authorization": "Bearer wrong-token"},
        {"Authorization": "test-token"},
        {"Authorization": "Basic test-token"},
        {"Authorization": "Bearer "},
    ],
)
async def test_generated_route_rejects_missing_or_bad_token_before_json(
    client, monkeypatch, headers
):
    monkeypatch.setenv("REMOTION_CODEGEN_ENABLED", "true")
    monkeypatch.setenv("REMOTION_CODEGEN_TOKEN", "test-token")

    async def fail_preflight():
        raise AssertionError("preflight must not run for unauthenticated calls")

    monkeypatch.setattr(sandbox_manager, "ensure_available", fail_preflight)

    response = await client.post(
        "/animate/generated",
        content=b"{not-json",
        headers={"content-type": "application/json", **headers},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == {
        "code": "Unauthorized",
        "reason": "invalid_token",
    }
    assert response.headers.get("www-authenticate") == "Bearer"
    assert "test-token" not in response.text


@pytest.mark.asyncio
async def test_generated_route_accepts_correct_bearer_token(client, monkeypatch):
    monkeypatch.setenv("REMOTION_CODEGEN_ENABLED", "true")
    monkeypatch.setenv("REMOTION_CODEGEN_TOKEN", "test-token")

    async def fake_preflight():
        return _fake_capabilities()

    async def fake_enqueue(**kwargs):
        return SimpleNamespace(id="gen-auth", status="QUEUED")

    monkeypatch.setattr(sandbox_manager, "ensure_available", fake_preflight)
    monkeypatch.setattr(animation_service, "enqueue_generated", fake_enqueue)

    response = await client.post(
        "/animate/generated",
        json={"title": "Custom", "code": VALID_CODE, "props": {}},
        headers={"Authorization": "Bearer test-token"},
    )

    assert response.status_code == 200
    assert response.json() == {"job_id": "gen-auth", "status": "QUEUED"}


@pytest.mark.asyncio
async def test_missing_bwrap_fails_closed_before_spawning_anything(monkeypatch, tmp_path):
    _enable(monkeypatch, tmp_path)
    monkeypatch.setenv("REMOTION_CODEGEN_BWRAP_BIN", str(tmp_path / "no-such-bwrap"))

    async def fail_spawn(*args, **kwargs):
        raise AssertionError("no process may start when bwrap is missing")

    monkeypatch.setattr(asyncio, "create_subprocess_exec", fail_spawn)

    with pytest.raises(SandboxUnavailable) as excinfo:
        await sandbox_manager.ensure_available()
    assert excinfo.value.reason == "bwrap_missing"


@pytest.mark.asyncio
async def test_missing_systemd_scope_fails_closed(monkeypatch, tmp_path):
    _enable(monkeypatch, tmp_path)
    real_which = shutil.which

    def fake_which(name, *args, **kwargs):
        if name == "systemd-run":
            return None
        return real_which(name, *args, **kwargs)

    monkeypatch.setattr(codegen.shutil, "which", fake_which)

    with pytest.raises(SandboxUnavailable) as excinfo:
        await sandbox_manager.ensure_available()
    assert excinfo.value.reason == "cgroup_unavailable"


@pytest.mark.asyncio
async def test_generated_route_enqueues_only_after_preflight(client, monkeypatch):
    monkeypatch.setenv("REMOTION_CODEGEN_ENABLED", "true")
    monkeypatch.setenv("REMOTION_CODEGEN_TOKEN", "test-token")
    captured: dict[str, object] = {}

    async def fake_preflight():
        return _fake_capabilities()

    async def fake_enqueue(**kwargs):
        captured.update(kwargs)
        return SimpleNamespace(id="gen-1", status="QUEUED")

    monkeypatch.setattr(sandbox_manager, "ensure_available", fake_preflight)
    monkeypatch.setattr(animation_service, "enqueue_generated", fake_enqueue)

    response = await client.post(
        "/animate/generated",
        json={"title": "Custom", "code": VALID_CODE, "props": {"label": "ok"}},
        headers=_auth_headers(),
    )

    assert response.status_code == 200
    assert response.json() == {"job_id": "gen-1", "status": "QUEUED"}
    assert captured["title"] == "Custom"
    assert captured["props"] == {"label": "ok"}


@pytest.mark.asyncio
async def test_generated_route_reports_unavailable_preflight(client, monkeypatch):
    monkeypatch.setenv("REMOTION_CODEGEN_ENABLED", "true")
    monkeypatch.setenv("REMOTION_CODEGEN_TOKEN", "test-token")

    async def unavailable():
        raise SandboxUnavailable("preflight_render_failed")

    monkeypatch.setattr(sandbox_manager, "ensure_available", unavailable)

    response = await client.post(
        "/animate/generated",
        json={"title": "Custom", "code": VALID_CODE, "props": {}},
        headers=_auth_headers(),
    )

    assert response.status_code == 503
    assert response.json()["detail"]["reason"] == "preflight_render_failed"


@pytest.mark.asyncio
async def test_generated_route_rejects_invalid_code_without_preflight(client, monkeypatch):
    monkeypatch.setenv("REMOTION_CODEGEN_ENABLED", "true")
    monkeypatch.setenv("REMOTION_CODEGEN_TOKEN", "test-token")

    async def fail_preflight():
        raise AssertionError("preflight must not run for invalid input")

    monkeypatch.setattr(sandbox_manager, "ensure_available", fail_preflight)

    response = await client.post(
        "/animate/generated",
        json={"title": "Custom", "code": "export const GeneratedComposition = () => eval('x');"},
        headers=_auth_headers(),
    )

    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "InvalidGeneratedCode"


# ── Animation service integration ───────────────────────────


@pytest.mark.asyncio
async def test_enqueue_generated_job_becomes_ready(monkeypatch, tmp_path):
    monkeypatch.setattr(animation_module, "OUTPUT_DIR", str(tmp_path))

    async def fake_render(*, code, props, destination):
        Path(destination).write_bytes(b"\x00\x00\x00\x18ftypisom")
        return SimpleNamespace(output_path=Path(destination), size_bytes=12, checks=())

    monkeypatch.setattr(animation_module, "render_generated_code", fake_render)
    job = await animation_service.enqueue_generated(
        title="generated", code=VALID_CODE, props={"label": "ok"}
    )
    assert job.status == "QUEUED"
    for _ in range(100):
        if job.status in {"READY", "FAILED"}:
            break
        await asyncio.sleep(0.01)
    assert job.status == "READY"
    assert job.video_url == f"/animations/{job.id}.mp4"
    assert (tmp_path / f"{job.id}.mp4").is_file()


@pytest.mark.asyncio
async def test_enqueue_generated_job_fails_without_host_fallback(monkeypatch, tmp_path):
    monkeypatch.setattr(animation_module, "OUTPUT_DIR", str(tmp_path))

    async def unavailable(**kwargs):
        raise SandboxUnavailable("preflight_render_failed")

    monkeypatch.setattr(animation_module, "render_generated_code", unavailable)
    job = await animation_service.enqueue_generated(
        title="generated", code=VALID_CODE, props={}
    )
    for _ in range(100):
        if job.status in {"READY", "FAILED"}:
            break
        await asyncio.sleep(0.01)
    assert job.status == "FAILED"
    assert job.error == "SandboxUnavailable: preflight_render_failed"
    assert "Traceback" not in (job.error or "")
    assert not (tmp_path / f"{job.id}.mp4").exists()


# ── Generated job admission cap ─────────────────────────────


@pytest.mark.asyncio
async def test_generated_job_capacity_default_one_and_release(monkeypatch, tmp_path):
    monkeypatch.setattr(animation_module, "OUTPUT_DIR", str(tmp_path))
    monkeypatch.delenv("REMOTION_CODEGEN_MAX_ACTIVE_JOBS", raising=False)
    release = asyncio.Event()

    async def slow_render(*, code, props, destination):
        await release.wait()

    monkeypatch.setattr(animation_module, "render_generated_code", slow_render)

    first = await animation_service.enqueue_generated(
        title="one", code=VALID_CODE, props={}
    )
    assert animation_service.active_generated_jobs() == 1
    assert not animation_service.generated_capacity_available()

    with pytest.raises(GeneratedJobLimitExceeded):
        await animation_service.enqueue_generated(
            title="two", code=VALID_CODE, props={}
        )

    release.set()
    for _ in range(100):
        if first.status == "READY":
            break
        await asyncio.sleep(0.01)
    assert first.status == "READY"
    assert animation_service.active_generated_jobs() == 0
    assert animation_service.generated_capacity_available()


@pytest.mark.asyncio
async def test_generated_capacity_released_after_failure_timeout_and_cancel(
    monkeypatch, tmp_path
):
    monkeypatch.setattr(animation_module, "OUTPUT_DIR", str(tmp_path))
    monkeypatch.setenv("REMOTION_CODEGEN_MAX_ACTIVE_JOBS", "1")

    async def fail_render(**kwargs):
        raise RenderTimeout("render_timeout")

    monkeypatch.setattr(animation_module, "render_generated_code", fail_render)
    job = await animation_service.enqueue_generated(
        title="timeout", code=VALID_CODE, props={}
    )
    for _ in range(100):
        if job.status == "FAILED":
            break
        await asyncio.sleep(0.01)
    assert job.status == "FAILED"
    assert animation_service.active_generated_jobs() == 0

    started = asyncio.Event()

    async def slow_render(**kwargs):
        started.set()
        await asyncio.sleep(30)

    monkeypatch.setattr(animation_module, "render_generated_code", slow_render)
    cancelled = await animation_service.enqueue_generated(
        title="cancel", code=VALID_CODE, props={}
    )
    await asyncio.wait_for(started.wait(), 5)
    task = animation_service._generated_tasks[cancelled.id]
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    await asyncio.sleep(0)
    assert cancelled.status == "FAILED"
    assert animation_service.active_generated_jobs() == 0


@pytest.mark.asyncio
async def test_generated_capacity_released_after_generic_failure(monkeypatch, tmp_path):
    monkeypatch.setattr(animation_module, "OUTPUT_DIR", str(tmp_path))
    monkeypatch.setenv("REMOTION_CODEGEN_MAX_ACTIVE_JOBS", "1")

    async def broken_render(**kwargs):
        raise RuntimeError("unexpected render error")

    monkeypatch.setattr(animation_module, "render_generated_code", broken_render)
    job = await animation_service.enqueue_generated(
        title="broken", code=VALID_CODE, props={}
    )
    for _ in range(100):
        if job.status == "FAILED":
            break
        await asyncio.sleep(0.01)
    assert job.status == "FAILED"
    assert job.error == "generated render failed"
    assert animation_service.active_generated_jobs() == 0


@pytest.mark.asyncio
async def test_prebuilt_jobs_are_not_limited_by_generated_cap(monkeypatch, tmp_path):
    monkeypatch.setattr(animation_module, "OUTPUT_DIR", str(tmp_path))
    monkeypatch.setenv("REMOTION_CODEGEN_MAX_ACTIVE_JOBS", "1")
    release = asyncio.Event()

    async def slow_render(**kwargs):
        await release.wait()

    async def noop_prebuilt(job_id):
        return None

    monkeypatch.setattr(animation_module, "render_generated_code", slow_render)
    monkeypatch.setattr(animation_service, "_render", noop_prebuilt)

    generated = await animation_service.enqueue_generated(
        title="generated", code=VALID_CODE, props={}
    )
    assert animation_service.active_generated_jobs() == 1

    prebuilt = await animation_service.enqueue(
        kind="PRE_EXPLAIN", topic="BFS", title="prebuilt"
    )
    assert prebuilt.status == "QUEUED"
    release.set()
    for _ in range(100):
        if generated.status == "READY":
            break
        await asyncio.sleep(0.01)


@pytest.mark.asyncio
async def test_generated_route_returns_429_when_capacity_is_full(client, monkeypatch, tmp_path):
    monkeypatch.setenv("REMOTION_CODEGEN_ENABLED", "true")
    monkeypatch.setenv("REMOTION_CODEGEN_TOKEN", "test-token")
    scratch = tmp_path / "scratch"
    monkeypatch.setenv("REMOTION_CODEGEN_TMP_ROOT", str(scratch))
    monkeypatch.setattr(animation_service, "generated_capacity_available", lambda: False)

    async def fail_preflight():
        raise AssertionError("capacity rejection must happen before preflight")

    monkeypatch.setattr(sandbox_manager, "ensure_available", fail_preflight)

    response = await client.post(
        "/animate/generated",
        json={"title": "Custom", "code": VALID_CODE, "props": {}},
        headers=_auth_headers(),
    )

    assert response.status_code == 429
    assert response.json()["detail"]["reason"] == "generated_job_limit"
    assert not scratch.exists()


@pytest.mark.asyncio
async def test_mp4_metadata_probe_runs_inside_bwrap(monkeypatch, tmp_path):
    ffprobe = codegen._resolve_ffprobe()
    if ffprobe is None:
        pytest.skip("no sandboxable ffprobe")
    layout = _make_layout(code=VALID_CODE, timeout_seconds=5)
    captured: dict[str, object] = {}

    async def fake_capture(bwrap_args, command, *, limits, cgroup_limits, timeout):
        captured["bwrap_args"] = bwrap_args
        captured["command"] = command
        captured["limits"] = limits
        captured["cgroup_limits"] = cgroup_limits
        return (
            0,
            json.dumps(
                {"streams": [{"width": codegen.WIDTH, "height": codegen.HEIGHT}], "format": {"duration": "8.0"}}
            ).encode(),
            b"",
        )

    async def fail_host_parser(*args, **kwargs):
        raise AssertionError("host-side parser must not run")

    monkeypatch.setattr(sandbox_manager, "_capture_bwrap", fake_capture)
    monkeypatch.setattr(asyncio, "create_subprocess_exec", fail_host_parser)
    try:
        await _verify_mp4_metadata(
            layout=layout,
            bwrap=Path("/usr/bin/bwrap"),
            node=Path("/usr/bin/node"),
            chrome=Path("/usr/bin/google-chrome"),
            limits=codegen.ResourceLimits(),
            cgroup_limits=CgroupLimits(),
            ffprobe_path=str(ffprobe),
        )
    finally:
        layout.cleanup()

    assert captured["bwrap_args"][0] == "/usr/bin/bwrap"
    assert "--unshare-net" in captured["bwrap_args"]
    assert captured["command"][0] == str(ffprobe)
    assert "/out/render.mp4" in captured["command"]
    assert captured["limits"] == codegen.ResourceLimits()


@pytest.mark.asyncio
async def test_mp4_metadata_skips_without_sandboxable_ffprobe(monkeypatch):
    async def fail_capture(*args, **kwargs):
        raise AssertionError("ffprobe must not run when unavailable")

    monkeypatch.setattr(sandbox_manager, "_capture_bwrap", fail_capture)

    layout = _make_layout(code=VALID_CODE, timeout_seconds=5)
    try:
        await _verify_mp4_metadata(
            layout=layout,
            bwrap=Path("/usr/bin/bwrap"),
            node=Path("/usr/bin/node"),
            chrome=Path("/usr/bin/google-chrome"),
            limits=codegen.ResourceLimits(),
            cgroup_limits=CgroupLimits(),
            ffprobe_path=None,
        )
    finally:
        layout.cleanup()


def test_generated_job_capacity_config_is_clamped(monkeypatch):
    for raw, expected in (("0", 1), ("1", 1), ("2", 2), ("99", 2), ("nope", 1)):
        monkeypatch.setenv("REMOTION_CODEGEN_MAX_ACTIVE_JOBS", raw)
        assert remotion_codegen_max_active_jobs() == expected


@pytest.mark.asyncio
async def test_generated_route_429_if_slot_taken_during_preflight(client, monkeypatch):
    monkeypatch.setenv("REMOTION_CODEGEN_ENABLED", "true")
    monkeypatch.setenv("REMOTION_CODEGEN_TOKEN", "test-token")

    async def fake_preflight():
        return _fake_capabilities()

    async def race_enqueue(**kwargs):
        raise GeneratedJobLimitExceeded("generated_job_limit")

    monkeypatch.setattr(sandbox_manager, "ensure_available", fake_preflight)
    monkeypatch.setattr(animation_service, "enqueue_generated", race_enqueue)

    response = await client.post(
        "/animate/generated",
        json={"title": "Custom", "code": VALID_CODE, "props": {}},
        headers=_auth_headers(),
    )

    assert response.status_code == 429
    assert response.json()["detail"]["reason"] == "generated_job_limit"


# ── Cleanup, output validation, cancellation ─────────────────


@pytest.mark.asyncio
async def test_scratch_is_removed_when_render_spawn_fails(monkeypatch, tmp_path):
    scratch = _enable(monkeypatch, tmp_path)

    async def fake_preflight():
        return _fake_capabilities()

    async def fail_spawn(*args, **kwargs):
        raise RuntimeError("boom")

    monkeypatch.setattr(sandbox_manager, "ensure_available", fake_preflight)
    monkeypatch.setattr(sandbox_manager, "_spawn", fail_spawn)

    with pytest.raises(RuntimeError):
        await render_generated_code(
            code=VALID_CODE, props={}, destination=tmp_path / "out.mp4"
        )
    assert list(scratch.iterdir()) == []


@pytest.mark.asyncio
async def test_scratch_is_removed_on_cancellation(monkeypatch, tmp_path):
    scratch = _enable(monkeypatch, tmp_path)
    started = asyncio.Event()

    async def fake_preflight():
        return _fake_capabilities()

    async def slow_spawn(*args, **kwargs):
        started.set()
        await asyncio.sleep(30)

    monkeypatch.setattr(sandbox_manager, "ensure_available", fake_preflight)
    monkeypatch.setattr(sandbox_manager, "_spawn", slow_spawn)

    task = asyncio.create_task(
        render_generated_code(code=VALID_CODE, props={}, destination=tmp_path / "out.mp4")
    )
    await asyncio.wait_for(started.wait(), 5)
    assert list(scratch.iterdir()), "scratch directory should exist while rendering"
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    assert list(scratch.iterdir()) == []


def test_output_validation_rejects_symlink_traversal_and_extra_files(tmp_path):
    caps = _fake_capabilities(max_output_bytes=1024)
    output_dir = tmp_path / "out"
    output_dir.mkdir()
    target = tmp_path / "target.mp4"
    target.write_bytes(b"\x00\x00\x00\x18ftypisom")
    link = output_dir / "render.mp4"
    link.symlink_to(target)

    with pytest.raises(RenderFailed, match="output_is_symlink"):
        _verify_output(link, output_dir, caps)

    link.unlink()
    link.write_bytes(b"\x00\x00\x00\x18ftypisom" + b"0" * 10)
    # A non-MP4 file with no ftyp box is rejected.
    link.write_bytes(b"not an mp4 at all")
    with pytest.raises(RenderFailed, match="output_not_mp4"):
        _verify_output(link, output_dir, caps)

    link.write_bytes(b"\x00\x00\x00\x18ftypisom" + b"0" * 2000)
    with pytest.raises(RenderFailed, match="output_size_out_of_bounds"):
        _verify_output(link, output_dir, caps)

    link.write_bytes(b"\x00\x00\x00\x18ftypisom")
    (output_dir / "extra.txt").write_text("x")
    with pytest.raises(RenderFailed, match="unexpected_output_files"):
        _verify_output(link, output_dir, caps)


# ── Real sandbox tests (offline) ─────────────────────────────


@requires_real_sandbox
@pytest.mark.asyncio
async def test_real_preflight_proves_all_isolation_properties(monkeypatch, tmp_path):
    scratch = _enable(monkeypatch, tmp_path)
    capabilities = await sandbox_manager.ensure_available()

    assert capabilities.uid != 0
    for check in (
        "namespaces",
        "readonly_runtime",
        "writable_scratch_only",
        "env_scrubbed",
        "rlimits",
        "cgroup_limits",
        "memory_limit",
        "process_group",
        "timeout_kill",
        "output_size_limit",
        "node",
        "remotion_render_smoke",
    ):
        assert check in capabilities.checks
    if codegen._resolve_ffprobe() is not None:
        assert "ffprobe_sandboxed" in capabilities.checks
    assert capabilities.limits["memory_bytes"] == codegen.MEMORY_LIMIT_BYTES
    # Preflight scratch is always cleaned up.
    assert list(scratch.iterdir()) == []


@requires_real_sandbox
@pytest.mark.asyncio
async def test_real_render_produces_valid_mp4_and_cleans_up(monkeypatch, tmp_path):
    scratch = _enable(monkeypatch, tmp_path)
    destination = tmp_path / "deliver" / "generated.mp4"

    result = await render_generated_code(
        code=VALID_CODE,
        props={"label": "hello", "value": 42},
        destination=destination,
    )

    assert destination.is_file()
    assert result.output_path == destination
    assert result.size_bytes == destination.stat().st_size > 1000
    assert destination.read_bytes()[4:8] == b"ftyp"
    assert list(scratch.iterdir()) == []

    ffprobe = shutil.which("ffprobe")
    if ffprobe:
        completed = subprocess.run(  # noqa: ASYNC221 - ffprobe on a tiny local file
            [
                ffprobe,
                "-v",
                "error",
                "-select_streams",
                "v:0",
                "-show_entries",
                "stream=width,height:format=duration",
                "-of",
                "json",
                str(destination),
            ],
            capture_output=True,
            text=True,
            timeout=20,
            check=True,
        )
        data = json.loads(completed.stdout)
        stream = data["streams"][0]
        assert (stream["width"], stream["height"]) == (codegen.WIDTH, codegen.HEIGHT)
        duration = float(data["format"]["duration"])
        assert 8.0 <= duration <= 9.0


@requires_real_sandbox
@pytest.mark.asyncio
async def test_real_timeout_kills_the_whole_process_group(monkeypatch, tmp_path):
    _enable(monkeypatch, tmp_path)
    await sandbox_manager.ensure_available()
    layout = _make_layout(timeout_seconds=5)
    marker = f"ALGOCOACH_TEST_TIMEOUT_{os.getpid()}_{time.time_ns()}"
    limits = codegen._preflight_limits()
    cgroup_limits = CgroupLimits()
    capabilities = await sandbox_manager.ensure_available()
    bwrap = Path(capabilities.bwrap_path)
    node = Path(capabilities.node_path)
    chrome = Path(capabilities.chrome_path)
    try:
        with pytest.raises(RenderTimeout):
            await sandbox_manager._capture_bwrap(
                sandbox_manager._bwrap_args(
                    layout, bwrap=bwrap, node=node, chrome=chrome
                ),
                [
                    "/usr/bin/python3",
                    "-I",
                    "-c",
                    (
                        "import subprocess, time; "
                        "subprocess.Popen(['/usr/bin/python3', '-I', '-c', "
                        "'import time; time.sleep(60)', "
                        f"{marker!r}]); "
                        "time.sleep(60)"
                    ),
                    marker,
                ],
                limits=limits,
                cgroup_limits=cgroup_limits,
                timeout=1.0,
            )
        assert sandbox_manager._find_marker_processes(marker) == []
    finally:
        layout.cleanup()


@pytest.mark.asyncio
async def test_timeout_kills_a_fake_group_and_reaps(monkeypatch, tmp_path):
    """Unit-level counterpart that does not need bwrap."""

    async def fake_spawn(*args, **kwargs):
        proc = await asyncio.create_subprocess_exec(
            "/usr/bin/python3",
            "-I",
            "-c",
            "import time; time.sleep(60)",
            f"ALGOCOACH_FAKE_{os.getpid()}",
            stdin=asyncio.subprocess.DEVNULL,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL,
            start_new_session=True,
        )
        return proc

    monkeypatch.setattr(codegen.sandbox_manager, "_spawn", fake_spawn)
    with pytest.raises(RenderTimeout):
        await codegen.sandbox_manager._capture_bwrap(
            [],
            [],
            limits=codegen._preflight_limits(),
            cgroup_limits=CgroupLimits(),
            timeout=0.5,
        )


@pytest.mark.asyncio
async def test_environment_scrub_is_verified(monkeypatch):
    data = {
        "uid": 1000,
        "gid": 1000,
        "pidns": "pid:[2]",
        "netns": "net:[2]",
        "userns": "user:[2]",
        "utsns": "uts:[2]",
        "ifaces": ["lo"],
        "env_keys": ["HOME", "PATH"],
        "limits": {"cpu": 1, "fsize": 1, "nofile": 1, "nproc": 1, "core": 0},
        "mounts": {"/": "ro", "/remotion": "ro", "/input": "ro", "/work": "rw", "/out": "rw"},
        "writable": {"/": False, "/etc": False, "/input": False, "/remotion": False, "/usr": False, "/work": True, "/out": True},
    }
    # Sanity: the leaked-secret check is strict.
    bad = dict(data)
    bad["env_keys"] = ["HOME", "ANTHROPIC_API_KEY"]
    with pytest.raises(SandboxUnavailable, match="env_leaked"):
        codegen.sandbox_manager._assert_probe(bad, codegen._preflight_limits())
