#!/usr/bin/env python3
"""Check relative Markdown links and BTAE ID references.

Usage:
    python3 scripts/check-docs-links.py [FILE_OR_DIR ...]

With no arguments it checks AGENTS.md (if present) and every docs/**/*.md
under the repository root (the parent of this script's directory). Directories
are expanded to *.md recursively. Fenced code blocks and inline code spans are
ignored for link extraction; EVIDENCE-<n> definitions may live inside an
evidence code block, so definitions are read from the raw text.

Checks:
  - every relative link target exists on disk (URL-encoded paths decoded;
    anchors and query strings stripped);
  - every EVIDENCE-<n> reference is defined as a line starting with
    EVIDENCE-<n> in one of the checked files;
  - every TASK-YYYY-MM-DD-<slug> reference has docs/intent/tasks/<slug>.md.

Exit codes: 0 pass, 1 issues found, 2 usage/IO error.
"""

from __future__ import annotations

import re
import sys
import urllib.parse
from pathlib import Path

LINK = re.compile(r"!?\[[^\]\n]*\]\(\s*<?([^)\s>]+)>?(?:\s+[\"'][^\"']*[\"'])?\s*\)")
LINK_DEF = re.compile(r"(?m)^[ \t]*\[[^\]]+\]:[ \t]*(\S+)")
SCHEME = re.compile(r"^[A-Za-z][A-Za-z0-9+.-]*:")
FENCE = re.compile(r"(?ms)^[ \t]*(```+|~~~+)[^\n]*\n.*?^[ \t]*\1[ \t]*$")
INLINE_CODE = re.compile(r"`[^`\n]*`")
EVIDENCE_REF = re.compile(r"\bEVIDENCE-(\d+)\b")
EVIDENCE_DEF = re.compile(r"(?m)^(EVIDENCE-\d+)\b")
TASK_REF = re.compile(r"\bTASK-\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*\b")


def mask_code(text: str) -> str:
    """Blank out fenced blocks and inline code, preserving offsets and newlines."""

    def blank(match: re.Match[str]) -> str:
        return "".join("\n" if ch == "\n" else " " for ch in match.group(0))

    return INLINE_CODE.sub(blank, FENCE.sub(blank, text))


def expand(paths: list[str], root: Path) -> list[Path]:
    files: list[Path] = []
    for raw in paths:
        path = Path(raw)
        if path.is_dir():
            files.extend(sorted(path.rglob("*.md")))
        else:
            files.append(path)
    if not paths:
        charter = root / "AGENTS.md"
        if charter.is_file():
            files.append(charter)
        docs = root / "docs"
        if docs.is_dir():
            files.extend(sorted(docs.rglob("*.md")))
    return files


def check(files: list[Path], root: Path) -> list[str]:
    issues: list[str] = []
    texts: dict[Path, str] = {}
    masked: dict[Path, str] = {}
    for path in files:
        try:
            text = path.read_text(encoding="utf-8")
        except OSError as exc:
            issues.append(f"{path}: cannot read ({exc})")
            continue
        texts[path] = text
        masked[path] = mask_code(text)

    definitions = {
        ident
        for text in texts.values()
        for ident in EVIDENCE_DEF.findall(text)
    }
    task_dir = root / "docs" / "intent" / "tasks"
    links = refs = 0
    for path, text in masked.items():
        for match in list(LINK.finditer(text)) + list(LINK_DEF.finditer(text)):
            target = match.group(1)
            if target.startswith("#") or SCHEME.match(target) or target.startswith("//"):
                continue
            clean = urllib.parse.unquote(
                target.split("#", 1)[0].split("?", 1)[0]
            )
            if not clean:
                continue
            links += 1
            base = root if clean.startswith("/") else path.parent
            resolved = (base / clean.lstrip("/")).resolve()
            if not resolved.exists():
                line = text.count("\n", 0, match.start()) + 1
                issues.append(f"{path}:{line}: missing link target {target}")

        line_offsets = [i for i, ch in enumerate(text) if ch == "\n"]

        def line_of(pos: int) -> int:
            return 1 + sum(1 for offset in line_offsets if offset < pos)

        for match in EVIDENCE_REF.finditer(text):
            refs += 1
            ident = f"EVIDENCE-{match.group(1)}"
            if ident not in definitions:
                issues.append(f"{path}:{line_of(match.start())}: {ident} is not defined")
        for match in TASK_REF.finditer(text):
            refs += 1
            record = task_dir / f"{match.group(0)[5:]}.md"
            if not record.is_file():
                issues.append(
                    f"{path}:{line_of(match.start())}: {match.group(0)} has no record at "
                    f"{record.relative_to(root)}"
                )
    print(f"checked {links} links and {refs} id references in {len(files)} files")
    return issues


def main(argv: list[str]) -> int:
    args = argv[1:]
    if args and args[0] in {"-h", "--help"}:
        print(__doc__.strip())
        return 0
    root = Path(__file__).resolve().parent.parent
    files = expand(args, root)
    if not files:
        print("no Markdown files found", file=sys.stderr)
        return 2
    issues = check(files, root)
    for issue in issues:
        print(issue)
    print(f"{len(issues)} issue(s)" if issues else "ok")
    return 1 if issues else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
