"""Sandboxed rendering of agent-generated Remotion compositions.

The generated TSX is treated as **untrusted input**. The static checks in this
module are intentionally conservative, but they are only defence in depth:
they are *not* the security boundary. The boundary is a Bubblewrap (``bwrap``)
sandbox that must pass a real preflight before any generated code is rendered.

Fail-closed contract:

* rendering is disabled unless ``REMOTION_CODEGEN_ENABLED=true``;
* even when enabled, the first generated-code render runs a real bwrap smoke
  test and refuses with :class:`SandboxUnavailable` unless user/PID/network
  namespaces, a read-only runtime, writable-only scratch directories,
  resource limits, output limits and process-group teardown are all proven;
* the fallback is always "refuse"; there is deliberately no host ``npx`` or
  ``node`` path for generated code.

The prebuilt composition path in ``animation_service.py`` is untouched. Only
``POST /animate/generated`` (and :func:`render_generated_code`) use this
module.
"""
from __future__ import annotations

import asyncio
import contextlib
import hmac
import json
import logging
import math
import os
import re
import resource
import shutil
import signal
import stat
import tempfile
import time
import uuid
from collections.abc import Iterable, Mapping
from dataclasses import dataclass, replace
from pathlib import Path
from typing import Any

from app.config import (
    remotion_codegen_bwrap_bin,
    remotion_codegen_chrome_bin,
    remotion_codegen_enabled,
    remotion_codegen_node_bin,
    remotion_codegen_timeout_seconds,
    remotion_codegen_tmp_root,
    remotion_codegen_token,
)

logger = logging.getLogger(__name__)

# ── Limits ─────────────────────────────────────────────────────
# These are hard ceilings, not suggestions. The generated composition is
# registered by a trusted wrapper with these dimensions, so a generated file
# cannot enlarge the render.
MAX_CODE_BYTES = 48 * 1024
MAX_CODE_LINES = 600
MAX_PROPS_BYTES = 64 * 1024
MAX_PROPS_DEPTH = 8
MAX_PROPS_NODES = 5000
MAX_PROPS_LIST_ITEMS = 256
MAX_PROPS_KEYS = 128
MAX_PROPS_STRING = 4000
MAX_OUTPUT_BYTES = 64 * 1024 * 1024
MAX_OUTPUT_DURATION_SECONDS = 10.0

WIDTH = 1280
HEIGHT = 720
FPS = 30
DURATION_IN_FRAMES = 240

# Resource limits applied to the sandbox root before bwrap is exec'd. They are
# inherited by every sandbox process. Memory, task count and CPU are enforced
# by a transient systemd user scope (cgroup v2) because Chrome reserves a huge
# virtual address space and cannot run under RLIMIT_AS.
CPU_LIMIT_SECONDS = 240
FILE_SIZE_BYTES = MAX_OUTPUT_BYTES
OPEN_FILES_LIMIT = 256
PROCESS_LIMIT = 512
MEMORY_LIMIT_BYTES = 3 * 1024 * 1024 * 1024
MEMORY_SWAP_BYTES = 0
CPU_QUOTA_PERCENT = 200
DEV_SHM_BYTES = 128 * 1024 * 1024

PREFLIGHT_TIMEOUT_SECONDS = 45.0
SYSTEMD_RUN = "systemd-run"
RENDER_SEMAPHORE = asyncio.Semaphore(1)

# Directories mounted read-only inside the sandbox. ``/opt`` and the Node
# prefix are added conditionally by :meth:`SandboxManager._mount_args`.
_RO_SYSTEM_PATHS = ("/usr", "/bin", "/lib", "/lib64", "/sbin")

# Environment variables the sandbox is allowed to see. Everything else is
# dropped by both the host process env (``env={}``) and bwrap ``--clearenv``.
_SANDBOX_ENV = {
    "PATH": "/opt/node/bin:/usr/bin:/bin",
    "HOME": "/work/home",
    "TMPDIR": "/work/tmp",
    "XDG_CACHE_HOME": "/work/cache",
    "NODE_ENV": "production",
}

_ALLOWED_IMPORTS: dict[str, frozenset[str]] = {
    "react": frozenset({"useMemo", "useCallback"}),
    "remotion": frozenset(
        {
            "AbsoluteFill",
            "Sequence",
            "Series",
            "useCurrentFrame",
            "useVideoConfig",
            "interpolate",
            "spring",
            "Easing",
        }
    ),
}

_ALLOWED_JSX_TAGS = frozenset(
    {
        "AbsoluteFill",
        "Sequence",
        "Series",
        "div",
        "span",
        "svg",
        "g",
        "rect",
        "circle",
        "ellipse",
        "line",
        "polyline",
        "polygon",
        "path",
        "text",
        "tspan",
        "defs",
        "linearGradient",
        "radialGradient",
        "stop",
        "clipPath",
        "mask",
        "pattern",
    }
)

# Identifiers that would open a path out of the JSX/CSS sandbox. The list is
# deliberately broad: false positives are acceptable, false negatives are not.
_FORBIDDEN_IDENTIFIERS = frozenset(
    {
        "eval",
        "Function",
        "AsyncFunction",
        "GeneratorFunction",
        "WebAssembly",
        "require",
        "module",
        "exports",
        "process",
        "global",
        "globalThis",
        "window",
        "self",
        "top",
        "parent",
        "frames",
        "opener",
        "document",
        "navigator",
        "location",
        "history",
        "localStorage",
        "sessionStorage",
        "indexedDB",
        "caches",
        "crypto",
        "fetch",
        "XMLHttpRequest",
        "WebSocket",
        "EventSource",
        "Worker",
        "SharedWorker",
        "ServiceWorker",
        "importScripts",
        "postMessage",
        "addEventListener",
        "setTimeout",
        "setInterval",
        "requestAnimationFrame",
        "queueMicrotask",
        "Reflect",
        "Proxy",
        "Symbol",
        "Buffer",
        "Deno",
        "Bun",
        "constructor",
        "prototype",
        "__proto__",
        "__defineGetter__",
        "__defineSetter__",
        "__lookupGetter__",
        "__lookupSetter__",
        "with",
        "delete",
        "debugger",
        "new",
        "class",
        "extends",
        "async",
        "await",
        "yield",
    }
)

_FORBIDDEN_ATTRIBUTES = re.compile(
    r"\b(?:dangerouslySetInnerHTML|href|src|srcSet|xlinkHref|formAction|action|"
    r"poster|on[A-Z][A-Za-z0-9]*)\s*="
)
_URL_SCHEME = re.compile(
    r"(?i)\b(?:https?|wss?|ftp|file|data|javascript|blob):"
)
_JSX_TAG = re.compile(r"</?([A-Za-z][A-Za-z0-9]*)")
_PROPS_KEY = re.compile(r"^[A-Za-z_][A-Za-z0-9_]{0,63}$")
_NUMBER = re.compile(r"[0-9][0-9A-Za-z_.]*")
_IDENT = re.compile(r"[A-Za-z_$][A-Za-z0-9_$]*")

_REMOTION_ROOT_OVERRIDE = os.getenv("REMOTION_PROJECT_ROOT", "").strip()


def _default_remotion_root() -> Path:
    """Locate the bundled Remotion project without assuming source depth.

    Development checkouts place this module several directories below the
    repository root, while the production image copies the project to
    ``/remotion-compositions``.  Iterating over parents keeps imports safe in
    both layouts and avoids indexing past the root directory.
    """
    module_path = Path(__file__).resolve()
    candidates = [parent / "remotion-compositions" for parent in module_path.parents]
    candidates.append(Path("/remotion-compositions"))
    for candidate in candidates:
        if candidate.is_dir():
            return candidate
    # Preserve a useful deterministic path for callers that report a missing
    # project later, even when neither layout exists yet.
    return candidates[0]


_REMOTION_ROOT = (
    Path(_REMOTION_ROOT_OVERRIDE).resolve()
    if _REMOTION_ROOT_OVERRIDE
    else _default_remotion_root()
)

# ── Errors ─────────────────────────────────────────────────────


class CodegenError(Exception):
    """Base class for generated-code rendering failures."""

    code = "CodegenError"

    def __init__(self, reason: str, detail: str | None = None):
        self.reason = reason
        self.detail = detail
        super().__init__(reason)


class SandboxUnavailable(CodegenError):
    """The sandbox could not be proven safe, so nothing may be executed."""

    code = "SandboxUnavailable"


class InvalidGeneratedCode(CodegenError):
    """The generated code or its props failed static validation."""

    code = "InvalidGeneratedCode"


class RenderFailed(CodegenError):
    """The sandbox ran but did not produce a usable MP4."""

    code = "RenderFailed"


class RenderTimeout(RenderFailed):
    """The hard wall-clock timeout fired and the process group was killed."""

    code = "RenderTimeout"


# ── Static validation (defence in depth) ───────────────────────


@dataclass(frozen=True)
class _Token:
    kind: str
    value: str
    position: int


def _tokenize(source: str) -> list[_Token]:
    """Tokenize just enough to check imports/JSX and spot dangerous names.

    Template literals are rejected outright (they can hide expressions), and
    comments are discarded so they can never influence the scan. String values
    are retained for URL-scheme checks.
    """
    tokens: list[_Token] = []
    i = 0
    n = len(source)
    while i < n:
        char = source[i]
        if char in " \t\r\n":
            i += 1
            continue
        if source.startswith("//", i):
            newline = source.find("\n", i + 2)
            i = n if newline < 0 else newline + 1
            continue
        if source.startswith("/*", i):
            end = source.find("*/", i + 2)
            if end < 0:
                raise InvalidGeneratedCode("unterminated_block_comment")
            i = end + 2
            continue
        if char in "'\"":
            quote = char
            start = i
            i += 1
            chars: list[str] = []
            while i < n:
                current = source[i]
                if current == "\\":
                    if i + 1 >= n:
                        raise InvalidGeneratedCode("unterminated_string")
                    chars.append(source[i : i + 2])
                    i += 2
                    continue
                if current == quote:
                    i += 1
                    break
                if current == "\n":
                    raise InvalidGeneratedCode("unterminated_string")
                chars.append(current)
                i += 1
            else:
                raise InvalidGeneratedCode("unterminated_string")
            tokens.append(_Token("string", "".join(chars), start))
            continue
        if char == "`":
            raise InvalidGeneratedCode("template_literal_not_allowed")
        match = _IDENT.match(source, i)
        if match:
            tokens.append(_Token("ident", match.group(0), i))
            i = match.end()
            continue
        match = _NUMBER.match(source, i)
        if match:
            tokens.append(_Token("number", match.group(0), i))
            i = match.end()
            continue
        tokens.append(_Token("punct", char, i))
        i += 1
    return tokens


def _parse_import(tokens: list[_Token], start: int) -> int:
    """Validate one ``import { ... } from 'module'`` and return the next index."""
    if start + 1 >= len(tokens) or tokens[start + 1].value != "{":
        raise InvalidGeneratedCode("only_named_imports_allowed")

    index = start + 2
    names: list[str] = []
    while index < len(tokens) and tokens[index].value != "}":
        token = tokens[index]
        if token.kind != "ident":
            raise InvalidGeneratedCode("invalid_import_specifier")
        names.append(token.value)
        index += 1
        if index < len(tokens) and tokens[index].value == "as":
            if index + 1 >= len(tokens) or tokens[index + 1].kind != "ident":
                raise InvalidGeneratedCode("invalid_import_alias")
            index += 2
        if index < len(tokens) and tokens[index].value == ",":
            index += 1
        elif index < len(tokens) and tokens[index].value != "}":
            raise InvalidGeneratedCode("invalid_import_specifier")

    if index >= len(tokens) or tokens[index].value != "}":
        raise InvalidGeneratedCode("unterminated_import")
    index += 1
    if index >= len(tokens) or tokens[index].value != "from":
        raise InvalidGeneratedCode("import_missing_from")
    index += 1
    if index >= len(tokens) or tokens[index].kind != "string":
        raise InvalidGeneratedCode("import_missing_module")
    module = tokens[index].value
    allowed = _ALLOWED_IMPORTS.get(module)
    if allowed is None:
        raise InvalidGeneratedCode("import_module_not_allowed")
    for name in names:
        if name not in allowed:
            raise InvalidGeneratedCode("import_symbol_not_allowed")
    return index + 1


def _check_exports(tokens: list[_Token]) -> None:
    exports = 0
    index = 0
    while index < len(tokens):
        if tokens[index].kind == "ident" and tokens[index].value == "export":
            exports += 1
            if index + 2 >= len(tokens):
                raise InvalidGeneratedCode("invalid_export")
            if (
                tokens[index + 1].value != "const"
                or tokens[index + 2].value != "GeneratedComposition"
            ):
                raise InvalidGeneratedCode("only_GeneratedComposition_export_allowed")
        index += 1
    if exports != 1:
        raise InvalidGeneratedCode("exactly_one_export_required")


def _check_balanced(tokens: list[_Token]) -> None:
    pairs = {")": "(", "]": "[", "}": "{"}
    stack: list[str] = []
    for token in tokens:
        if token.kind != "punct":
            continue
        if token.value in "([{":
            stack.append(token.value)
        elif token.value in pairs and (
            not stack or stack.pop() != pairs[token.value]
        ):
            raise InvalidGeneratedCode("unbalanced_delimiters")
    if stack:
        raise InvalidGeneratedCode("unbalanced_delimiters")


def validate_generated_code(code: str) -> None:
    """Reject obviously unsafe generated TSX before touching the filesystem.

    This is a lexical, allow-list check for the restricted composition
    template. It is deliberately conservative and is **not** a security
    boundary; the bwrap sandbox is. Invalid input is rejected here so that no
    temporary files or subprocesses are created for it.
    """
    if not isinstance(code, str):
        raise InvalidGeneratedCode("code_must_be_a_string")
    encoded = code.encode("utf-8", errors="strict")
    if not encoded:
        raise InvalidGeneratedCode("code_is_empty")
    if len(encoded) > MAX_CODE_BYTES:
        raise InvalidGeneratedCode("code_too_large")
    if "\x00" in code:
        raise InvalidGeneratedCode("nul_byte_in_code")
    if code.count("\n") + 1 > MAX_CODE_LINES:
        raise InvalidGeneratedCode("too_many_lines")

    tokens = _tokenize(code)
    if not tokens:
        raise InvalidGeneratedCode("code_is_empty")

    for token in tokens:
        if token.kind == "ident" and token.value in _FORBIDDEN_IDENTIFIERS:
            # ``export``/``import`` are handled by their own grammar checks;
            # seeing them here still means an unsupported construct.
            raise InvalidGeneratedCode(f"forbidden_identifier:{token.value}")
        if token.kind == "string" and _URL_SCHEME.search(token.value):
            raise InvalidGeneratedCode("url_literal_not_allowed")

    index = 0
    while index < len(tokens):
        token = tokens[index]
        if token.kind == "ident" and token.value == "import":
            index = _parse_import(tokens, index)
            continue
        index += 1

    _check_exports(tokens)
    _check_balanced(tokens)

    if _FORBIDDEN_ATTRIBUTES.search(code):
        raise InvalidGeneratedCode("forbidden_jsx_attribute")

    for match in _JSX_TAG.finditer(code):
        tag = match.group(1)
        if tag not in _ALLOWED_JSX_TAGS:
            raise InvalidGeneratedCode(f"jsx_tag_not_allowed:{tag}")


def validate_props(props: Mapping[str, Any] | None) -> dict[str, Any]:
    """Validate JSON props: types, depth, node count and serialized size.

    Props are the only data the generated composition receives. They must be
    plain JSON so they can be passed through the Remotion CLI without any
    evaluation.
    """
    if props is None:
        props = {}
    if not isinstance(props, Mapping):
        raise InvalidGeneratedCode("props_must_be_an_object")

    budget = [MAX_PROPS_NODES]

    def walk(value: Any, depth: int) -> None:
        budget[0] -= 1
        if budget[0] < 0:
            raise InvalidGeneratedCode("props_too_many_nodes")
        if depth > MAX_PROPS_DEPTH:
            raise InvalidGeneratedCode("props_too_deep")
        if value is None or isinstance(value, bool):
            return
        if isinstance(value, str):
            if len(value) > MAX_PROPS_STRING:
                raise InvalidGeneratedCode("props_string_too_large")
            return
        if isinstance(value, int) and not isinstance(value, bool):
            if abs(value) > 10**12:
                raise InvalidGeneratedCode("props_number_out_of_range")
            return
        if isinstance(value, float):
            if not math.isfinite(value) or abs(value) > 10**12:
                raise InvalidGeneratedCode("props_number_out_of_range")
            return
        if isinstance(value, (list, tuple)):
            if len(value) > MAX_PROPS_LIST_ITEMS:
                raise InvalidGeneratedCode("props_list_too_large")
            for item in value:
                walk(item, depth + 1)
            return
        if isinstance(value, Mapping):
            if len(value) > MAX_PROPS_KEYS:
                raise InvalidGeneratedCode("props_object_too_large")
            for key, item in value.items():
                if not isinstance(key, str):
                    raise InvalidGeneratedCode("props_key_must_be_string")
                if key in {"__proto__", "constructor", "prototype"}:
                    raise InvalidGeneratedCode("props_key_not_allowed")
                if not _PROPS_KEY.match(key):
                    raise InvalidGeneratedCode("props_key_invalid")
                walk(item, depth + 1)
            return
        raise InvalidGeneratedCode("props_type_not_allowed")

    for key, value in props.items():
        if not isinstance(key, str) or not _PROPS_KEY.match(key):
            raise InvalidGeneratedCode("props_key_invalid")
        if key in {"__proto__", "constructor", "prototype"}:
            raise InvalidGeneratedCode("props_key_not_allowed")
        walk(value, 1)

    try:
        serialized = json.dumps(props, ensure_ascii=False, allow_nan=False)
    except (TypeError, ValueError) as exc:
        raise InvalidGeneratedCode("props_not_json_serializable") from exc
    if len(serialized.encode("utf-8")) > MAX_PROPS_BYTES:
        raise InvalidGeneratedCode("props_too_large")
    return dict(props)


# ── Resource limits / process handling ─────────────────────────


@dataclass(frozen=True)
class ResourceLimits:
    """Per-process rlimits (secondary defence behind the cgroup)."""

    cpu_seconds: int = CPU_LIMIT_SECONDS
    file_size_bytes: int = FILE_SIZE_BYTES
    open_files: int = OPEN_FILES_LIMIT
    processes: int = 4096

    def __post_init__(self) -> None:
        if min(
            self.cpu_seconds,
            self.file_size_bytes,
            self.open_files,
            self.processes,
        ) <= 0:
            raise ValueError("resource limits must be positive")


@dataclass(frozen=True)
class CgroupLimits:
    """Limits for the transient systemd user scope around one sandbox run."""

    memory_bytes: int = MEMORY_LIMIT_BYTES
    swap_bytes: int = MEMORY_SWAP_BYTES
    pids: int = PROCESS_LIMIT
    cpu_quota_percent: int = CPU_QUOTA_PERCENT

    def __post_init__(self) -> None:
        if min(self.memory_bytes, self.pids, self.cpu_quota_percent) <= 0:
            raise ValueError("cgroup limits must be positive")
        if self.swap_bytes < 0:
            raise ValueError("swap limit must be non-negative")


def _apply_limits(limits: ResourceLimits):
    """Return a ``preexec_fn`` that installs the limits in the child."""

    def _install() -> None:  # pragma: no cover - runs in the forked child
        os.umask(0o077)
        pairs = (
            (resource.RLIMIT_CPU, limits.cpu_seconds),
            (resource.RLIMIT_FSIZE, limits.file_size_bytes),
            (resource.RLIMIT_NOFILE, limits.open_files),
            (resource.RLIMIT_NPROC, limits.processes),
            (resource.RLIMIT_CORE, 0),
        )
        for which, value in pairs:
            resource.setrlimit(which, (value, value))

    return _install


@dataclass
class _Layout:
    root: Path
    input_dir: Path
    work_dir: Path
    output_dir: Path
    project_dir: Path
    generated_file: Path
    log_file: Path | None = None

    def cleanup(self) -> None:
        _remove_tree(self.root)


def _remove_tree(root: Path) -> None:
    """Remove a scratch tree even when the sandbox left restrictive modes."""

    def _onerror(function, path, excinfo):  # type: ignore[no-untyped-def]
        with contextlib.suppress(OSError):
            os.chmod(path, 0o700)
        with contextlib.suppress(OSError):
            function(path)

    shutil.rmtree(root, onerror=_onerror)


def _make_layout(
    *,
    code: str | None = None,
    work: bool = True,
    timeout_seconds: float,
) -> _Layout:
    base = remotion_codegen_tmp_root()
    try:
        root = Path(tempfile.mkdtemp(prefix="remotion-codegen-", dir=base))
    except OSError as exc:
        raise SandboxUnavailable("scratch_root_unavailable") from exc
    try:
        os.chmod(root, 0o700)
        input_dir = root / "input"
        work_dir = root / "work"
        output_dir = root / "output"
        project_dir = work_dir / "project"
        generated_file = input_dir / "Generated.tsx"
        input_dir.mkdir()
        output_dir.mkdir()
        project_dir.mkdir(parents=True)
        for name in ("home", "tmp", "cache"):
            (work_dir / name).mkdir()
        os.chmod(work_dir, 0o700)
        os.chmod(output_dir, 0o700)

        if code is not None:
            generated_file.write_text(code, encoding="utf-8")
            os.chmod(generated_file, 0o444)
        return _Layout(
            root=root,
            input_dir=input_dir,
            work_dir=work_dir,
            output_dir=output_dir,
            project_dir=project_dir,
            generated_file=generated_file,
        )
    except Exception:
        _remove_tree(root)
        raise


def _build_project(layout: _Layout, remotion_root: Path, limits: ResourceLimits) -> None:
    """Write the trusted wrapper project around the read-only generated file."""
    project = layout.project_dir
    src = project / "src"
    src.mkdir(parents=True)
    module_dir = project / "node_modules"
    module_dir.mkdir()

    remotion_modules = remotion_root / "node_modules"
    for entry in os.scandir(remotion_modules):
        # Never link the webpack cache: the sandbox needs to write its own.
        if entry.name in {".cache", ".remotion"}:
            continue
        os.symlink(f"/remotion/node_modules/{entry.name}", module_dir / entry.name)

    # The generated file is bind-mounted read-only over this placeholder.
    (src / "Generated.tsx").write_text("", encoding="utf-8")
    (src / "entry.tsx").write_text(
        "import { Composition, registerRoot } from 'remotion';\n"
        "import { GeneratedComposition } from './Generated';\n"
        "\n"
        "const GeneratedRoot = () => (\n"
        "  <Composition\n"
        "    id=\"Generated\"\n"
        "    component={GeneratedComposition}\n"
        f"    durationInFrames={{{DURATION_IN_FRAMES}}}\n"
        f"    fps={{{FPS}}}\n"
        f"    width={{{WIDTH}}}\n"
        f"    height={{{HEIGHT}}}\n"
        "    defaultProps={{}}\n"
        "  />\n"
        ");\n"
        "\n"
        "registerRoot(GeneratedRoot);\n",
        encoding="utf-8",
    )
    (project / "package.json").write_text(
        json.dumps(
            {
                "name": "algocoach-generated-animation",
                "private": True,
                "version": "0.0.0",
                "remotion": {"entryPoint": "./src/entry.tsx"},
            }
        ),
        encoding="utf-8",
    )
    # `limits` is accepted to keep the trusted project deterministic if future
    # versions need to size a generated package.json; currently unused.
    _ = limits


def _resolve_executable(override: str | None, *names: str) -> Path | None:
    if override:
        candidate = Path(override).expanduser()
        return candidate.resolve() if candidate.exists() else None
    for name in names:
        found = shutil.which(name)
        if found:
            return Path(found).resolve()
    return None


def _is_under(path: Path, parent: str) -> bool:
    try:
        path.relative_to(parent)
        return True
    except ValueError:
        return False


def _resolve_ffprobe() -> Path | None:
    """Resolve a host ffprobe that can be executed inside the sandbox.

    ``/usr`` is bind-mounted read-only, so only a binary under ``/usr`` can be
    invoked without widening the sandbox's mount set. When it is absent (or
    elsewhere) the production metadata probe is skipped entirely; the fixed
    Composition wrapper plus MP4 type/size checks still bound the output.
    """
    found = shutil.which("ffprobe")
    if not found:
        return None
    path = Path(found).resolve()
    if not _is_under(path, "/usr") or not os.access(path, os.X_OK):
        logger.warning(
            "ffprobe is outside /usr; sandboxed MP4 metadata probe disabled"
        )
        return None
    return path


def _systemd_env() -> dict[str, str]:
    """Minimal environment so ``systemd-run --user`` can reach the user manager.

    The sandbox itself starts with ``--clearenv`` and only the explicit
    ``_SANDBOX_ENV`` keys, so these transport variables never reach generated
    code.
    """
    env: dict[str, str] = {}
    for key in ("XDG_RUNTIME_DIR", "DBUS_SESSION_BUS_ADDRESS", "HOME"):
        value = os.environ.get(key)
        if value:
            env[key] = value
    return env


# ── Sandbox capabilities / manager ─────────────────────────────


@dataclass(frozen=True)
class SandboxCapabilities:
    """Proof record produced by a successful real preflight."""

    bwrap_path: str
    bwrap_version: str
    systemd_run_path: str
    node_path: str
    chrome_path: str
    ffprobe_path: str | None
    remotion_root: str
    uid: int
    checks: tuple[str, ...]
    limits: Mapping[str, Any]


def _preflight_limits() -> ResourceLimits:
    return ResourceLimits(
        cpu_seconds=30,
        file_size_bytes=2 * 1024 * 1024,
        open_files=128,
        processes=4096,
    )


_PREFLIGHT_PROBE = r"""
import json, os, resource, socket

def writable(path):
    try:
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        os.write(fd, b"probe")
        os.close(fd)
        return True
    except OSError:
        return False

def limit(which):
    return resource.getrlimit(which)[0]

mounts = {}
with open("/proc/self/mountinfo", "r", encoding="utf-8") as handle:
    for line in handle:
        parts = line.split()
        if len(parts) < 6:
            continue
        options = parts[5].split(",")
        mounts[parts[4]] = "ro" if "ro" in options else "rw"

data = {
    "uid": os.getuid(),
    "gid": os.getgid(),
    "pidns": os.readlink("/proc/self/ns/pid"),
    "netns": os.readlink("/proc/self/ns/net"),
    "userns": os.readlink("/proc/self/ns/user"),
    "utsns": os.readlink("/proc/self/ns/uts"),
    "hostname": socket.gethostname(),
    "ifaces": sorted(name for _, name in socket.if_nameindex()),
    "env_keys": sorted(os.environ),
    "limits": {
        "cpu": limit(resource.RLIMIT_CPU),
        "fsize": limit(resource.RLIMIT_FSIZE),
        "nofile": limit(resource.RLIMIT_NOFILE),
        "nproc": limit(resource.RLIMIT_NPROC),
        "core": limit(resource.RLIMIT_CORE),
    },
    "mounts": mounts,
    "writable": {
        "/work": writable("/work/probe"),
        "/out": writable("/out/probe"),
        "/input": writable("/input/probe"),
        "/remotion": writable("/remotion/probe"),
        "/usr": writable("/usr/probe"),
        "/etc": writable("/etc/probe"),
        "/": writable("/probe"),
    },
}
print("PROBE_JSON=" + json.dumps(data, sort_keys=True))
"""


class SandboxManager:
    """Owns the fail-closed preflight and the bwrap render invocation."""

    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._capabilities: SandboxCapabilities | None = None
        self._failure: str | None = None

    def reset(self) -> None:
        """Forget a cached preflight result (tests and explicit reloads)."""
        self._capabilities = None
        self._failure = None

    async def ensure_available(self) -> SandboxCapabilities:
        if not remotion_codegen_enabled():
            raise SandboxUnavailable("codegen_disabled")
        # A missing bearer token is a feature-level fail-closed condition: never
        # expose generated-code execution when the operator did not set one.
        if remotion_codegen_token() is None:
            raise SandboxUnavailable("codegen_token_missing")
        if self._capabilities is not None:
            return self._capabilities
        if self._failure is not None:
            raise SandboxUnavailable(self._failure)
        async with self._lock:
            if self._capabilities is not None:
                return self._capabilities
            if self._failure is not None:
                raise SandboxUnavailable(self._failure)
            try:
                self._capabilities = await self._preflight()
            except SandboxUnavailable as exc:
                self._failure = exc.reason
                logger.warning("Remotion codegen sandbox unavailable: %s", exc.reason)
                raise
            logger.info(
                "Remotion codegen sandbox ready: bwrap=%s checks=%s",
                self._capabilities.bwrap_version,
                ",".join(self._capabilities.checks),
            )
            return self._capabilities

    # ── preflight ─────────────────────────────────────────────

    async def _preflight(self) -> SandboxCapabilities:
        if not _REMOTION_ROOT.is_dir():
            raise SandboxUnavailable("remotion_project_missing")
        cli = _REMOTION_ROOT / "node_modules" / "@remotion" / "cli" / "remotion-cli.js"
        if not cli.is_file():
            raise SandboxUnavailable("remotion_cli_missing")

        bwrap = _resolve_executable(remotion_codegen_bwrap_bin(), "bwrap")
        if bwrap is None or not os.access(bwrap, os.X_OK):
            raise SandboxUnavailable("bwrap_missing")
        node = _resolve_executable(remotion_codegen_node_bin(), "node")
        if node is None or not os.access(node, os.X_OK):
            raise SandboxUnavailable("node_missing")
        chrome = _resolve_executable(
            remotion_codegen_chrome_bin(),
            "google-chrome",
            "google-chrome-stable",
            "chromium",
            "chromium-browser",
        )
        if chrome is None or not os.access(chrome, os.X_OK):
            raise SandboxUnavailable("chrome_missing")
        systemd_run = _resolve_executable(None, SYSTEMD_RUN)
        if systemd_run is None or not os.access(systemd_run, os.X_OK):
            raise SandboxUnavailable("cgroup_unavailable")
        ffprobe = _resolve_ffprobe()

        try:
            version_proc = await asyncio.create_subprocess_exec(
                str(bwrap),
                "--version",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env={},
            )
            version_out, _ = await asyncio.wait_for(version_proc.communicate(), 5)
        except (TimeoutError, OSError) as exc:
            raise SandboxUnavailable("bwrap_probe_failed") from exc
        if version_proc.returncode != 0:
            raise SandboxUnavailable("bwrap_probe_failed")
        version = version_out.decode("utf-8", "replace").strip().splitlines()[0]
        if not version:
            raise SandboxUnavailable("bwrap_probe_failed")

        checks: list[str] = []
        probe_limits = _preflight_limits()
        cgroup_limits = CgroupLimits()
        layout = _make_layout(timeout_seconds=PREFLIGHT_TIMEOUT_SECONDS)
        try:
            # 1. Namespaces, root/view mounts, env scrub and rlimits.
            try:
                returncode, stdout, _ = await self._capture_bwrap(
                    self._bwrap_args(layout, bwrap=bwrap, node=node, chrome=chrome),
                    ["/usr/bin/python3", "-I", "-c", _PREFLIGHT_PROBE],
                    limits=probe_limits,
                    cgroup_limits=cgroup_limits,
                    timeout=PREFLIGHT_TIMEOUT_SECONDS,
                )
            except RenderTimeout as exc:
                raise SandboxUnavailable("preflight_probe_timeout") from exc
            if returncode != 0:
                raise SandboxUnavailable("preflight_probe_failed")
            data = self._parse_probe(stdout)
            self._assert_probe(data, probe_limits)
            checks.append("namespaces")
            checks.append("readonly_runtime")
            checks.append("writable_scratch_only")
            checks.append("env_scrubbed")
            checks.append("rlimits")

            # 2. The transient systemd scope really carries the memory,
            #    task-count and CPU limits of the sandbox.
            await self._probe_cgroup_properties(
                layout, bwrap, node, chrome, cgroup_limits
            )
            checks.append("cgroup_limits")
            await self._probe_memory_limit(layout, bwrap, node, chrome)
            checks.append("memory_limit")

            # 3. The sandbox root is its own session/process group.
            await self._probe_process_group(
                layout, bwrap, node, chrome, probe_limits, cgroup_limits
            )
            checks.append("process_group")

            # 4. Hard timeout really kills the whole group.
            await self._probe_timeout_kill(
                layout, bwrap, node, chrome, cgroup_limits
            )
            checks.append("timeout_kill")

            # 5. Output file-size limit is enforced by the kernel.
            await self._probe_file_size(layout, bwrap, node, chrome, cgroup_limits)
            checks.append("output_size_limit")

            # 6. Node, the Remotion CLI and headless Chrome start inside the
            #    same sandbox. This is what catches a missing shared library or
            #    an environment where bwrap works but rendering cannot.
            await self._probe_runtime(layout, bwrap, node, chrome, cgroup_limits)
            checks.append("node")
            checks.append("remotion_render_smoke")

            # 7. If ffprobe exists, it must also run and parse an image inside
            #    the same sandbox. The production MP4 probe then reuses this
            #    validated executable; no host-side parser touches the output.
            if ffprobe is not None:
                await self._probe_ffprobe(
                    layout, bwrap, node, chrome, cgroup_limits, ffprobe
                )
                checks.append("ffprobe_sandboxed")
        finally:
            layout.cleanup()

        return SandboxCapabilities(
            bwrap_path=str(bwrap),
            bwrap_version=version,
            systemd_run_path=str(systemd_run),
            node_path=str(node),
            chrome_path=str(chrome),
            ffprobe_path=str(ffprobe) if ffprobe is not None else None,
            remotion_root=str(_REMOTION_ROOT),
            uid=os.getuid(),
            checks=tuple(checks),
            limits={
                "width": WIDTH,
                "height": HEIGHT,
                "fps": FPS,
                "duration_frames": DURATION_IN_FRAMES,
                "max_output_bytes": MAX_OUTPUT_BYTES,
                "timeout_seconds": remotion_codegen_timeout_seconds(),
                "cpu_seconds": CPU_LIMIT_SECONDS,
                "file_size_bytes": FILE_SIZE_BYTES,
                "open_files": OPEN_FILES_LIMIT,
                "processes": PROCESS_LIMIT,
                "memory_bytes": MEMORY_LIMIT_BYTES,
                "swap_bytes": MEMORY_SWAP_BYTES,
                "cpu_quota_percent": CPU_QUOTA_PERCENT,
            },
        )

    async def _probe_process_group(
        self,
        layout: _Layout,
        bwrap: Path,
        node: Path,
        chrome: Path,
        limits: ResourceLimits,
        cgroup_limits: CgroupLimits,
    ) -> None:
        script = (
            "import os, time\n"
            "while not os.path.exists('/out/go'):\n"
            "    time.sleep(0.02)\n"
        )
        proc = await self._spawn(
            self._bwrap_args(layout, bwrap=bwrap, node=node, chrome=chrome)
            + ["/usr/bin/python3", "-I", "-c", script],
            limits=limits,
            cgroup_limits=cgroup_limits,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL,
        )
        try:
            await asyncio.sleep(0.15)
            try:
                pgid = os.getpgid(proc.pid)
                sid = os.getsid(proc.pid)
            except ProcessLookupError as exc:
                raise SandboxUnavailable("preflight_process_group_failed") from exc
            if pgid != proc.pid or sid != proc.pid:
                raise SandboxUnavailable("preflight_process_group_failed")
        finally:
            with contextlib.suppress(OSError):
                (layout.output_dir / "go").write_text("go", encoding="utf-8")
            with contextlib.suppress(ProcessLookupError):
                os.killpg(proc.pid, signal.SIGKILL)
            with contextlib.suppress(Exception):
                await asyncio.wait_for(proc.wait(), 5)

    async def _probe_timeout_kill(
        self,
        layout: _Layout,
        bwrap: Path,
        node: Path,
        chrome: Path,
        cgroup_limits: CgroupLimits,
    ) -> None:
        marker = f"ALGOCOACH_TIMEOUT_PROBE_{uuid.uuid4().hex}"
        command = [
            "/usr/bin/python3",
            "-I",
            "-c",
            "import time; time.sleep(60)",
            marker,
        ]
        started = time.monotonic()
        try:
            await self._capture_bwrap(
                self._bwrap_args(layout, bwrap=bwrap, node=node, chrome=chrome),
                command,
                limits=_preflight_limits(),
                cgroup_limits=cgroup_limits,
                timeout=1.0,
            )
            raise SandboxUnavailable("preflight_timeout_not_enforced")
        except RenderTimeout:
            pass
        elapsed = time.monotonic() - started
        if elapsed > 6.0:
            raise SandboxUnavailable("preflight_timeout_kill_too_slow")
        if self._find_marker_processes(marker):
            raise SandboxUnavailable("preflight_timeout_left_processes")

    def _find_marker_processes(self, marker: str) -> list[int]:
        found: list[int] = []
        for name in os.listdir("/proc"):
            if not name.isdigit() or int(name) == os.getpid():
                continue
            try:
                raw = Path(f"/proc/{name}/cmdline").read_bytes()
            except OSError:
                continue
            if marker.encode() in raw:
                found.append(int(name))
        return found

    async def _probe_file_size(
        self,
        layout: _Layout,
        bwrap: Path,
        node: Path,
        chrome: Path,
        cgroup_limits: CgroupLimits,
    ) -> None:
        limits = replace(_preflight_limits(), file_size_bytes=1024 * 1024)
        command = [
            "/bin/sh",
            "-c",
            (
                "dd if=/dev/zero of=/out/oversize.bin bs=1024 count=2048 "
                "2>/dev/null; echo DONE=$?"
            ),
        ]
        try:
            _, stdout, _ = await self._capture_bwrap(
                self._bwrap_args(layout, bwrap=bwrap, node=node, chrome=chrome),
                command,
                limits=limits,
                cgroup_limits=cgroup_limits,
                timeout=PREFLIGHT_TIMEOUT_SECONDS,
            )
        except RenderTimeout as exc:
            raise SandboxUnavailable("preflight_file_size_timeout") from exc
        path = layout.output_dir / "oversize.bin"
        try:
            size = path.stat().st_size
        except OSError as exc:
            raise SandboxUnavailable("preflight_file_size_not_enforced") from exc
        if size > limits.file_size_bytes:
            raise SandboxUnavailable("preflight_file_size_not_enforced")
        if b"DONE=0" in stdout:
            raise SandboxUnavailable("preflight_file_size_not_enforced")

    async def _probe_cgroup_properties(
        self,
        layout: _Layout,
        bwrap: Path,
        node: Path,
        chrome: Path,
        cgroup_limits: CgroupLimits,
    ) -> None:
        """Read the transient scope's cgroup files while the probe is alive."""
        proc = await self._spawn(
            self._bwrap_args(layout, bwrap=bwrap, node=node, chrome=chrome)
            + [
                "/usr/bin/python3",
                "-I",
                "-c",
                "import time; time.sleep(3)",
            ],
            limits=_preflight_limits(),
            cgroup_limits=cgroup_limits,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL,
        )
        try:
            await asyncio.sleep(0.3)
            try:
                cgroup_line = Path(f"/proc/{proc.pid}/cgroup").read_text(
                    encoding="utf-8"
                )
                relative = cgroup_line.strip().split(":", 2)[2]
                cgroup_dir = Path("/sys/fs/cgroup") / relative.lstrip("/")
                memory_max = int((cgroup_dir / "memory.max").read_text().strip())
                swap_max = int((cgroup_dir / "memory.swap.max").read_text().strip())
                pids_max = int((cgroup_dir / "pids.max").read_text().strip())
                cpu_max = (cgroup_dir / "cpu.max").read_text().strip()
            except (OSError, ValueError, IndexError) as exc:
                raise SandboxUnavailable("preflight_cgroup_unavailable") from exc
        finally:
            with contextlib.suppress(ProcessLookupError):
                os.killpg(proc.pid, signal.SIGKILL)
            with contextlib.suppress(Exception):
                await asyncio.wait_for(proc.wait(), 5)

        if memory_max != cgroup_limits.memory_bytes:
            raise SandboxUnavailable("preflight_memory_limit_not_applied")
        if swap_max != cgroup_limits.swap_bytes:
            raise SandboxUnavailable("preflight_swap_limit_not_applied")
        if pids_max != cgroup_limits.pids:
            raise SandboxUnavailable("preflight_pids_limit_not_applied")
        quota_parts = cpu_max.split()
        if len(quota_parts) != 2 or quota_parts[0] == "max":
            raise SandboxUnavailable("preflight_cpu_limit_not_applied")
        expected_quota = cgroup_limits.cpu_quota_percent * 1000
        if int(quota_parts[0]) != expected_quota:
            raise SandboxUnavailable("preflight_cpu_limit_not_applied")

    async def _probe_memory_limit(
        self,
        layout: _Layout,
        bwrap: Path,
        node: Path,
        chrome: Path,
    ) -> None:
        """Prove the cgroup memory cap actually kills an over-allocating run."""
        small = CgroupLimits(
            memory_bytes=64 * 1024 * 1024,
            swap_bytes=0,
            pids=PROCESS_LIMIT,
            cpu_quota_percent=CPU_QUOTA_PERCENT,
        )
        command = [
            "/usr/bin/python3",
            "-I",
            "-c",
            "x = bytearray(256 * 1024 * 1024); print('MEMORY_ALLOCATED')",
        ]
        try:
            returncode, stdout, stderr = await self._capture_bwrap(
                self._bwrap_args(layout, bwrap=bwrap, node=node, chrome=chrome),
                command,
                limits=_preflight_limits(),
                cgroup_limits=small,
                timeout=PREFLIGHT_TIMEOUT_SECONDS,
            )
        except RenderTimeout as exc:
            raise SandboxUnavailable("preflight_memory_limit_timeout") from exc
        if returncode == 0 or b"MEMORY_ALLOCATED" in stdout:
            raise SandboxUnavailable("preflight_memory_limit_not_enforced")
        # The OOM killer (or systemd-oomd) may use SIGKILL or SIGTERM; Python
        # may also raise MemoryError before the signal arrives.
        if (
            returncode >= 0
            and returncode != 137
            and b"MemoryError" not in stderr
            and b"out of memory" not in stderr.lower()
        ):
            raise SandboxUnavailable("preflight_memory_limit_not_enforced")

    _PREFLIGHT_COMPONENT = (
        "import { AbsoluteFill } from 'remotion';\n"
        "\n"
        "export const GeneratedComposition = () => (\n"
        "  <AbsoluteFill style={{ backgroundColor: '#0d1117' }} />\n"
        ");\n"
    )

    async def _probe_runtime(
        self,
        layout: _Layout,
        bwrap: Path,
        node: Path,
        chrome: Path,
        cgroup_limits: CgroupLimits,
    ) -> None:
        """Prove Node, the Remotion CLI and headless Chrome start and render.

        This uses a *trusted* one-frame composition, never the user's code, but
        it exercises the same bundle/Chrome path that a generated render uses.
        A Chrome process that starts but cannot produce a frame is therefore
        not reported as a usable sandbox.
        """
        limits = ResourceLimits(
            cpu_seconds=CPU_LIMIT_SECONDS,
            file_size_bytes=FILE_SIZE_BYTES,
            open_files=OPEN_FILES_LIMIT,
            processes=4096,
        )
        _build_project(layout, _REMOTION_ROOT, limits)
        layout.generated_file.touch()
        os.chmod(layout.generated_file, 0o600)
        layout.generated_file.write_text(self._PREFLIGHT_COMPONENT, encoding="utf-8")
        os.chmod(layout.generated_file, 0o444)
        args = self._bwrap_args(
            layout,
            bwrap=bwrap,
            node=node,
            chrome=chrome,
            generated_file=True,
        )
        command = [
            str(self._sandbox_node_path(node)),
            "/remotion/node_modules/@remotion/cli/remotion-cli.js",
            "still",
            "src/entry.tsx",
            "Generated",
            "/out/preflight.png",
            "--frame",
            "0",
            "--browser-executable",
            str(self._sandbox_chrome_path(chrome)),
            "--log",
            "error",
            "--bundle-cache=false",
        ]
        try:
            returncode, _, _ = await self._capture_bwrap(
                args,
                command,
                limits=limits,
                cgroup_limits=cgroup_limits,
                timeout=PREFLIGHT_TIMEOUT_SECONDS,
            )
        except RenderTimeout as exc:
            raise SandboxUnavailable("preflight_render_timeout") from exc
        if returncode != 0:
            raise SandboxUnavailable("preflight_render_failed")
        output = layout.output_dir / "preflight.png"
        try:
            raw = output.read_bytes()
        except OSError as exc:
            raise SandboxUnavailable("preflight_render_no_output") from exc
        if not raw.startswith(b"\x89PNG\r\n\x1a\n"):
            raise SandboxUnavailable("preflight_render_invalid_output")

    async def _probe_ffprobe(
        self,
        layout: _Layout,
        bwrap: Path,
        node: Path,
        chrome: Path,
        cgroup_limits: CgroupLimits,
        ffprobe: Path,
    ) -> None:
        """Prove ffprobe executes and parses inside the sandbox before use."""
        limits = ResourceLimits(
            cpu_seconds=CPU_LIMIT_SECONDS,
            file_size_bytes=FILE_SIZE_BYTES,
            open_files=OPEN_FILES_LIMIT,
            processes=4096,
        )
        args = self._bwrap_args(layout, bwrap=bwrap, node=node, chrome=chrome)
        command = [
            str(ffprobe),
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height",
            "-of",
            "json",
            "/out/preflight.png",
        ]
        try:
            returncode, stdout, _ = await self._capture_bwrap(
                args,
                command,
                limits=limits,
                cgroup_limits=cgroup_limits,
                timeout=PREFLIGHT_TIMEOUT_SECONDS,
            )
        except RenderTimeout as exc:
            raise SandboxUnavailable("preflight_ffprobe_timeout") from exc
        if returncode != 0:
            raise SandboxUnavailable("preflight_ffprobe_failed")
        try:
            width, height = _parse_ffprobe_dimensions(stdout)
        except RenderFailed as exc:
            raise SandboxUnavailable("preflight_ffprobe_failed") from exc
        if (width, height) != (WIDTH, HEIGHT):
            raise SandboxUnavailable("preflight_ffprobe_failed")

    def _parse_probe(self, raw: bytes) -> dict[str, Any]:
        prefix = b"PROBE_JSON="
        for line in raw.splitlines():
            if line.startswith(prefix):
                try:
                    return json.loads(line[len(prefix) :].decode("utf-8"))
                except (ValueError, UnicodeDecodeError) as exc:
                    raise SandboxUnavailable("preflight_probe_unreadable") from exc
        raise SandboxUnavailable("preflight_probe_unreadable")

    def _assert_probe(self, data: Mapping[str, Any], limits: ResourceLimits) -> None:
        try:
            uid = int(data["uid"])
            gid = int(data["gid"])
            pidns = str(data["pidns"])
            netns = str(data["netns"])
            userns = str(data["userns"])
            utsns = str(data["utsns"])
            ifaces = set(data["ifaces"])
            env_keys = set(data["env_keys"])
            mounts = data["mounts"]
            writable = data["writable"]
            reported = data["limits"]
        except (KeyError, TypeError, ValueError) as exc:
            raise SandboxUnavailable("preflight_probe_malformed") from exc

        if uid == 0 or gid == 0:
            raise SandboxUnavailable("preflight_runs_as_root")
        for namespace, host_path in (
            (pidns, "/proc/self/ns/pid"),
            (netns, "/proc/self/ns/net"),
            (userns, "/proc/self/ns/user"),
            (utsns, "/proc/self/ns/uts"),
        ):
            try:
                host_value = os.readlink(host_path)
            except OSError as exc:
                raise SandboxUnavailable("preflight_namespace_probe_failed") from exc
            if namespace == host_value:
                raise SandboxUnavailable("preflight_namespace_not_isolated")
        if ifaces != {"lo"}:
            raise SandboxUnavailable("preflight_network_not_isolated")

        # Python itself adds LC_CTYPE (locale coercion) and PWD; both are
        # safe and are the only keys beyond the explicit environment.
        allowed_env = set(_SANDBOX_ENV) | {"LC_CTYPE", "PWD"}
        if env_keys - allowed_env:
            raise SandboxUnavailable("preflight_env_leaked")
        if {"ANTHROPIC_API_KEY", "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY"} & env_keys:
            raise SandboxUnavailable("preflight_env_leaked")

        for path in ("/input", "/remotion", "/usr", "/etc", "/"):
            if writable.get(path) is not False:
                raise SandboxUnavailable("preflight_readonly_runtime_failed")
        for path in ("/work", "/out"):
            if writable.get(path) is not True:
                raise SandboxUnavailable("preflight_scratch_not_writable")
        if mounts.get("/") != "ro":
            raise SandboxUnavailable("preflight_root_not_readonly")
        if mounts.get("/remotion") != "ro" or mounts.get("/input") != "ro":
            raise SandboxUnavailable("preflight_runtime_not_readonly")
        if mounts.get("/work") != "rw" or mounts.get("/out") != "rw":
            raise SandboxUnavailable("preflight_scratch_not_writable")

        expected = {
            "cpu": limits.cpu_seconds,
            "fsize": limits.file_size_bytes,
            "nofile": limits.open_files,
            "nproc": limits.processes,
            "core": 0,
        }
        for name, value in expected.items():
            if int(reported.get(name, -1)) != value:
                raise SandboxUnavailable("preflight_rlimit_not_applied")

    # ── command construction ──────────────────────────────────

    def _sandbox_node_path(self, node: Path) -> Path:
        if _is_under(node, "/usr"):
            return node
        return Path("/opt/node/bin/node")

    def _sandbox_chrome_path(self, chrome: Path) -> Path:
        if _is_under(chrome, "/usr") or _is_under(chrome, "/opt"):
            return chrome
        raise SandboxUnavailable("chrome_path_unsupported")

    def _bwrap_args(
        self,
        layout: _Layout,
        *,
        bwrap: Path,
        node: Path,
        chrome: Path,
        generated_file: bool = False,
    ) -> list[str]:
        args = [
            str(bwrap),
            "--unshare-user",
            "--unshare-pid",
            "--unshare-net",
            "--unshare-ipc",
            "--unshare-uts",
            "--unshare-cgroup-try",
            "--die-with-parent",
            "--cap-drop",
            "ALL",
            "--clearenv",
            "--hostname",
            "remotion-sandbox",
        ]
        for key, value in _SANDBOX_ENV.items():
            args += ["--setenv", key, value]

        for path in _RO_SYSTEM_PATHS:
            if Path(path).exists():
                args += ["--ro-bind", path, path]

        if not _is_under(node, "/usr"):
            args += ["--ro-bind", str(node.parent.parent), "/opt/node"]
        if not _is_under(chrome, "/usr"):
            chrome_root = chrome.parent.parent
            args += ["--ro-bind", str(chrome_root), str(chrome_root)]

        args += [
            "--ro-bind",
            str(_REMOTION_ROOT),
            "/remotion",
            "--ro-bind",
            str(layout.input_dir),
            "/input",
        ]

        for path in (
            "/etc/fonts",
            "/etc/passwd",
            "/etc/group",
            "/etc/nsswitch.conf",
            "/etc/ld.so.cache",
            "/etc/localtime",
        ):
            if Path(path).exists():
                args += ["--ro-bind", path, path]

        args += [
            "--proc",
            "/proc",
            "--dev",
            "/dev",
            "--size",
            str(DEV_SHM_BYTES),
            "--tmpfs",
            "/dev/shm",
            "--bind",
            str(layout.work_dir),
            "/work",
            "--bind",
            str(layout.output_dir),
            "/out",
        ]
        if generated_file:
            args += [
                "--ro-bind",
                str(layout.generated_file),
                "/work/project/src/Generated.tsx",
            ]
        args += [
            "--chdir",
            "/work/project",
            "--remount-ro",
            "/",
        ]
        return args

    # ── process helpers ───────────────────────────────────────

    async def _spawn(
        self,
        args: Iterable[str],
        *,
        limits: ResourceLimits,
        cgroup_limits: CgroupLimits,
        stdout: Any,
        stderr: Any,
    ) -> asyncio.subprocess.Process:
        command = list(args)
        env = _systemd_env()
        command = self._systemd_run_args(cgroup_limits) + command
        return await asyncio.create_subprocess_exec(
            *command,
            stdin=asyncio.subprocess.DEVNULL,
            stdout=stdout,
            stderr=stderr,
            env=env,
            start_new_session=True,
            preexec_fn=_apply_limits(limits),
        )

    def _systemd_run_args(self, limits: CgroupLimits) -> list[str]:
        systemd_run = _resolve_executable(None, SYSTEMD_RUN)
        if systemd_run is None:
            raise SandboxUnavailable("cgroup_unavailable")
        return [
            str(systemd_run),
            "--user",
            "--scope",
            "--quiet",
            "--collect",
            "-p",
            f"MemoryMax={limits.memory_bytes}",
            "-p",
            f"MemorySwapMax={limits.swap_bytes}",
            "-p",
            f"TasksMax={limits.pids}",
            "-p",
            f"CPUQuota={limits.cpu_quota_percent}%",
            "--",
        ]

    async def _capture_bwrap(
        self,
        bwrap_args: list[str],
        command: list[str],
        *,
        limits: ResourceLimits,
        cgroup_limits: CgroupLimits,
        timeout: float,
    ) -> tuple[int, bytes, bytes]:
        proc = await self._spawn(
            bwrap_args + command,
            limits=limits,
            cgroup_limits=cgroup_limits,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout)
        except TimeoutError as exc:
            await self._kill(proc)
            raise RenderTimeout("sandbox_timeout") from exc
        except asyncio.CancelledError:
            await self._kill(proc)
            raise
        return proc.returncode or 0, stdout[:64_000], stderr[:64_000]

    async def _kill(self, proc: asyncio.subprocess.Process) -> None:
        with contextlib.suppress(ProcessLookupError, PermissionError):
            os.killpg(proc.pid, signal.SIGKILL)
        with contextlib.suppress(ProcessLookupError):
            proc.kill()
        try:
            await asyncio.wait_for(proc.wait(), 5)
        except (TimeoutError, ProcessLookupError):
            logger.warning("Sandbox process %s did not reap after SIGKILL", proc.pid)


sandbox_manager = SandboxManager()


# ── Rendering ──────────────────────────────────────────────────


@dataclass(frozen=True)
class RenderResult:
    output_path: Path
    size_bytes: int
    checks: tuple[str, ...]


async def render_generated_code(
    *,
    code: str,
    props: Mapping[str, Any] | None,
    destination: str | os.PathLike[str],
) -> RenderResult:
    """Render one validated generated composition inside the bwrap sandbox.

    Raises :class:`SandboxUnavailable` *before* any temporary file or process
    exists when the feature is disabled or the sandbox did not pass its
    preflight. Raises :class:`InvalidGeneratedCode` for rejected input before
    touching the filesystem. The scratch tree is removed on every path,
    including success, failure, timeout and cancellation.
    """
    if not remotion_codegen_enabled():
        raise SandboxUnavailable("codegen_disabled")

    # Static validation comes first: invalid input must not create files or
    # processes, including the preflight.
    validate_generated_code(code)
    clean_props = validate_props(props)

    capabilities = await sandbox_manager.ensure_available()
    bwrap = Path(capabilities.bwrap_path)
    node = Path(capabilities.node_path)
    chrome = Path(capabilities.chrome_path)

    layout = _make_layout(code=code, timeout_seconds=capabilities.limits["timeout_seconds"])
    try:
        limits = ResourceLimits(
            cpu_seconds=int(capabilities.limits["cpu_seconds"]),
            file_size_bytes=int(capabilities.limits["file_size_bytes"]),
            open_files=int(capabilities.limits["open_files"]),
            processes=4096,
        )
        cgroup_limits = CgroupLimits(
            memory_bytes=int(capabilities.limits["memory_bytes"]),
            swap_bytes=int(capabilities.limits["swap_bytes"]),
            pids=int(capabilities.limits["processes"]),
            cpu_quota_percent=int(capabilities.limits["cpu_quota_percent"]),
        )
        _build_project(layout, _REMOTION_ROOT, limits)
        output_path = layout.output_dir / "render.mp4"
        log_path = layout.work_dir / "render.log"
        command = [
            str(sandbox_manager._sandbox_node_path(node)),
            "/remotion/node_modules/@remotion/cli/remotion-cli.js",
            "render",
            "src/entry.tsx",
            "Generated",
            "/out/render.mp4",
            "--frames",
            f"0-{DURATION_IN_FRAMES - 1}",
            "--concurrency",
            "1",
            "--browser-executable",
            str(sandbox_manager._sandbox_chrome_path(chrome)),
            "--codec",
            "h264",
            "--image-format",
            "jpeg",
            "--jpeg-quality",
            "80",
            "--props",
            json.dumps(clean_props, ensure_ascii=False, separators=(",", ":")),
            "--log",
            "error",
            "--bundle-cache=false",
        ]
        bwrap_args = sandbox_manager._bwrap_args(
            layout,
            bwrap=bwrap,
            node=node,
            chrome=chrome,
            generated_file=True,
        )

        async with RENDER_SEMAPHORE:
            with open(log_path, "xb") as log:  # noqa: ASYNC230 - local log fd
                proc = await sandbox_manager._spawn(
                    bwrap_args + command,
                    limits=limits,
                    cgroup_limits=cgroup_limits,
                    stdout=log,
                    stderr=log,
                )
                try:
                    await asyncio.wait_for(
                        proc.wait(), remotion_codegen_timeout_seconds()
                    )
                except TimeoutError as exc:
                    await sandbox_manager._kill(proc)
                    raise RenderTimeout("render_timeout") from exc
                except asyncio.CancelledError:
                    await sandbox_manager._kill(proc)
                    raise

            if proc.returncode != 0:
                raise RenderFailed(f"render_exit_{proc.returncode}")

            _verify_output(output_path, layout.output_dir, capabilities)
            await _verify_mp4_metadata(
                layout=layout,
                bwrap=bwrap,
                node=node,
                chrome=chrome,
                limits=limits,
                cgroup_limits=cgroup_limits,
                ffprobe_path=capabilities.ffprobe_path,
            )

        size = output_path.stat().st_size
        _copy_output(output_path, Path(destination), capabilities)
        return RenderResult(
            output_path=Path(destination),
            size_bytes=size,
            checks=capabilities.checks,
        )
    finally:
        layout.cleanup()


def _verify_output(
    path: Path, output_dir: Path, capabilities: SandboxCapabilities
) -> None:
    try:
        info = path.lstat()
    except OSError as exc:
        raise RenderFailed("output_missing") from exc
    if stat.S_ISLNK(info.st_mode):
        raise RenderFailed("output_is_symlink")
    if not stat.S_ISREG(info.st_mode):
        raise RenderFailed("output_is_not_a_regular_file")
    limit = int(capabilities.limits["max_output_bytes"])
    if info.st_size <= 0 or info.st_size > limit:
        raise RenderFailed("output_size_out_of_bounds")
    try:
        resolved = path.resolve(strict=True)
        resolved.relative_to(output_dir.resolve())
    except (OSError, ValueError) as exc:
        raise RenderFailed("output_path_escape") from exc
    if path.suffix.lower() != ".mp4":
        raise RenderFailed("output_not_mp4")
    with open(path, "rb") as handle:
        header = handle.read(16)
    if len(header) < 12 or header[4:8] != b"ftyp":
        raise RenderFailed("output_not_mp4")

    extras = [entry.name for entry in output_dir.iterdir() if entry.name != path.name]
    if extras:
        raise RenderFailed("unexpected_output_files")


async def _verify_mp4_metadata(
    *,
    layout: _Layout,
    bwrap: Path,
    node: Path,
    chrome: Path,
    limits: ResourceLimits,
    cgroup_limits: CgroupLimits,
    ffprobe_path: str | None,
) -> None:
    """Verify MP4 dimensions/duration with ffprobe *inside* the sandbox.

    The generated MP4 is untrusted. ffprobe must never run on the host: this
    function starts it through the same bwrap mounts, systemd cgroup, rlimits
    and hard timeout as the render. Only when no sandboxable ffprobe exists
    does it skip the probe; the trusted Composition wrapper then supplies the
    fixed 1280x720/30fps/8s bounds, backed by host-side MP4 type/size checks.
    """
    if ffprobe_path is None:
        logger.warning(
            "No sandboxable ffprobe; relying on fixed composition metadata "
            "and MP4 type/size checks for output bounds"
        )
        return
    args = sandbox_manager._bwrap_args(layout, bwrap=bwrap, node=node, chrome=chrome)
    command = [
        ffprobe_path,
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=width,height:format=duration",
        "-of",
        "json",
        "/out/render.mp4",
    ]
    try:
        returncode, stdout, _ = await sandbox_manager._capture_bwrap(
            args,
            command,
            limits=limits,
            cgroup_limits=cgroup_limits,
            timeout=remotion_codegen_timeout_seconds(),
        )
    except RenderTimeout as exc:
        raise RenderFailed("output_probe_timeout") from exc
    if returncode != 0:
        raise RenderFailed("output_unreadable")
    try:
        data = json.loads(stdout.decode("utf-8", "replace"))
        stream = (data.get("streams") or [{}])[0]
        width = int(stream["width"])
        height = int(stream["height"])
        duration = float((data.get("format") or {}).get("duration") or 0.0)
    except (ValueError, TypeError, KeyError, IndexError) as exc:
        raise RenderFailed("output_unreadable") from exc
    if (width, height) != (WIDTH, HEIGHT):
        raise RenderFailed("output_resolution_out_of_bounds")
    if not (0 < duration <= MAX_OUTPUT_DURATION_SECONDS + 0.5):
        raise RenderFailed("output_duration_out_of_bounds")


def _copy_output(source: Path, destination: Path, capabilities: SandboxCapabilities) -> None:
    limit = int(capabilities.limits["max_output_bytes"])
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_name(
        f".{destination.name}.{uuid.uuid4().hex}.part"
    )
    written = 0
    try:
        with open(source, "rb") as read_handle, open(temporary, "xb") as write_handle:
            while True:
                chunk = read_handle.read(1024 * 1024)
                if not chunk:
                    break
                written += len(chunk)
                if written > limit:
                    raise RenderFailed("output_size_out_of_bounds")
                write_handle.write(chunk)
            write_handle.flush()
            os.fsync(write_handle.fileno())
        os.chmod(temporary, 0o644)
        os.replace(temporary, destination)
    except Exception:
        with contextlib.suppress(OSError):
            temporary.unlink()
        raise


def _parse_ffprobe_dimensions(raw: bytes) -> tuple[int, int]:
    try:
        data = json.loads(raw.decode("utf-8", "replace"))
        stream = (data.get("streams") or [{}])[0]
        return int(stream["width"]), int(stream["height"])
    except (ValueError, TypeError, KeyError, IndexError) as exc:
        raise RenderFailed("ffprobe_output_unreadable") from exc


def authorize_bearer(header: str | None, expected: str | None) -> bool:
    """Constant-time Bearer-token check; never logs or echoes the token."""
    if not expected or not header:
        return False
    scheme, separator, value = header.partition(" ")
    if not separator or scheme.lower() != "bearer":
        return False
    token = value.strip()
    if not token or any(character.isspace() for character in token):
        return False
    return hmac.compare_digest(token.encode("utf-8"), expected.encode("utf-8"))


# Public convenience wrappers used by the route/tests.
def validate_request(code: str, props: Mapping[str, Any] | None) -> dict[str, Any]:
    validate_generated_code(code)
    return validate_props(props)


async def sandbox_status() -> dict[str, Any]:
    """Return a secret-free status snapshot for diagnostics/tests."""
    if not remotion_codegen_enabled():
        return {"enabled": False, "available": False, "reason": "codegen_disabled"}
    try:
        capabilities = await sandbox_manager.ensure_available()
    except SandboxUnavailable as exc:
        return {"enabled": True, "available": False, "reason": exc.reason}
    return {
        "enabled": True,
        "available": True,
        "bwrap_version": capabilities.bwrap_version,
        "ffprobe_sandboxed": capabilities.ffprobe_path is not None,
        "checks": list(capabilities.checks),
    }
