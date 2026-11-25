# TASK-2026-11-25-btae-protocol-alignment — align authority docs with BTAE v2

Type: refactor (docs/governance + tooling)
Tier: T2
Tooling: repo-native (omp/commandcode, 2026-11-25)
Risk: low
Design status: draft (approval by: unassigned — no human review yet)
Implementation: implemented
Verification: passed
Evidence: valid (EVIDENCE-103/104 at 2026-11-25T09:15:47Z; EVIDENCE-101 stale)

## Objective

Bring the repository's BTAE authority documents in line with the updated protocol: explicit `mcp | repo-native` mode, change tiers, adoption workflow, template-shaped task records, and the evidence field/freshness vocabulary.

## Acceptance conditions

- AC-1: the recorded mode is `repo-native`, with the missing MCP/EPE capabilities named — verified by the header here and in [AGENTS.md](../../../AGENTS.md).
- AC-2: [AGENTS.md](../../../AGENTS.md) follows the charter template: scope, repository map, authoritative commands, boundaries, workflow/evidence, conventions — verified by review; link check below.
- AC-3: [SPEC-BTAE](../requirements/SPEC-BTAE.md) uses the spec template sections (Intent, Behavior, Contracts, Acceptance, Out of scope, Open questions) and the `valid/stale/invalid/unknown` evidence vocabulary — verified by review.
- AC-4: the [engineering protocol](../../architecture/engineering-protocol.md) defines tiers T1–T3, the adoption workflow, and docs-only checks, and defers evidence fields to the spec — verified by review.
- AC-5: the [guided-workspace record](2026-11-25-guided-workspace-layout.md) carries template header fields, ACs, a trace table, and evidence blocks with an input manifest — verified by review and the code manifest digest.
- AC-6: relative links in the authority docs resolve — verified by EVIDENCE-103.
- AC-7: every authority document is tracked despite the `*.md` ignore rule — verified by EVIDENCE-102.
- AC-8: the docs check is a repository command that reports a broken link, an undefined `EVIDENCE-` reference, and a missing `TASK-` record — verified by EVIDENCE-103 and EVIDENCE-104.

## Scope

- Target entities: `SPEC-BTAE`, `MOD-DOCS`, `MOD-DOCS-TOOL`, task records for the guided workspace and this alignment.
- Write scope: `AGENTS.md`, `docs/intent/requirements/SPEC-BTAE.md`, `docs/architecture/engineering-protocol.md`, `docs/intent/tasks/2026-11-25-guided-workspace-layout.md`, `docs/intent/tasks/2026-11-25-btae-protocol-alignment.md`, `scripts/check-docs-links.py`.
- Protected paths: none touched. `.github/workflows/**` is left unchanged; CI wiring is not part of this change.
- Dependencies: none at runtime; the guided-workspace record's code evidence references commit `2de217e`.

## Design notes (design → code)

- **One vocabulary.** The spec now uses `pending/passed/failed` for verification and `valid/stale/invalid/unknown` for evidence, replacing the earlier `current`/`not_run` wording.
- **Commit provenance.** Code evidence for the guided workspace now points at commit `2de217e` plus a SHA-256 manifest over the 20 changed `frontend/**` files (aggregate `c16d82fa…`), instead of worktree diff hashes that only existed before the commit.
- **Tiers and adoption.** The protocol gains T1–T3 and the uncommitted-worktree adoption path; future sessions no longer have to improvise.
- **Docs check as a command.** The docs-only row now names `scripts/check-docs-links.py`, which validates relative link targets, `TASK-` record existence, and `EVIDENCE-` definitions. CI wiring stays out because `.github/workflows/**` is protected.
- **No duplicated references.** The repository documents the field set and freshness rule directly; the skill's global references stay out of the repo.
- **Templates as contracts.** `AGENTS.md` now points at the spec/protocol with real links so a link check can catch drift.

## Trace table (code → design)

| Entity | Implementation | Verification |
|--------|----------------|--------------|
| `SPEC-BTAE` | `docs/intent/requirements/SPEC-BTAE.md` | EVIDENCE-103, review |
| `MOD-DOCS` | `AGENTS.md`, `docs/architecture/engineering-protocol.md`, `docs/intent/requirements/SPEC-BTAE.md` | EVIDENCE-102, EVIDENCE-103, review |
| `MOD-DOCS-TOOL` | `scripts/check-docs-links.py` | EVIDENCE-103, EVIDENCE-104 |
| `TASK-2026-11-25-guided-workspace-layout` | `docs/intent/tasks/2026-11-25-guided-workspace-layout.md` | EVIDENCE-103; code manifest `c16d82fa…` |
| `TASK-2026-11-25-btae-protocol-alignment` | this record | EVIDENCE-103, EVIDENCE-104 |

## Verification

Environment: Linux 7.0.0-43-generic x64; Python 3.14.4 (stdlib only); git; cwd repository root. Inputs for EVIDENCE-103: `scripts/check-docs-links.py`, `AGENTS.md`, `SPEC-BTAE.md`, the engineering protocol, and the guided-workspace record. This record is excluded from its own manifest because the evidence block is written after the run. No runtime code changed, so the guided-workspace code evidence remains `valid`.

```text
EVIDENCE-101  docs relative-link check
task: TASK-2026-11-25-btae-protocol-alignment
checker: python3 inline stdlib link check (regex over markdown links)
command: python3 - <<'PY' … (paths: AGENTS.md, SPEC-BTAE.md, engineering-protocol.md, guided-workspace record)
cwd: repository root
started_at / finished_at: 2026-11-25T07:57:43Z / 2026-11-25T07:57:43Z
environment: Linux x64; python3 stdlib; git worktree
exit_code: 0
result: passed
summary: checked 7 relative links in 4 files; all resolve
fingerprint: docs-only; no code manifest
artifacts: none
validity: stale (authority docs edited after 2026-11-25T07:57:43Z; superseded by EVIDENCE-103)
```

```text
EVIDENCE-102  authority docs are tracked
task: TASK-2026-11-25-btae-protocol-alignment
checker: git
command: git check-ignore -v <4 paths>; git ls-files <4 paths>
cwd: repository root
started_at / finished_at: 2026-11-25T07:57:49Z / 2026-11-25T07:57:49Z
environment: Linux x64; git; `*.md` ignore with `!AGENTS.md` and `!docs/**/*.md`
exit_code: 1 (check-ignore: no path ignored) / 0 (ls-files)
result: passed
summary: all 4 authority docs tracked; none ignored
fingerprint: n/a (tracking check)
artifacts: none
validity: valid
```

```text
EVIDENCE-103  authority docs check (repository script)
task: TASK-2026-11-25-btae-protocol-alignment
checker: scripts/check-docs-links.py (python3 3.14.4)
command: python3 scripts/check-docs-links.py
cwd: repository root
started_at / finished_at: 2026-11-25T09:16:01Z / 2026-11-25T09:16:01Z
environment: Linux x64; Python 3.14.4; git worktree
exit_code: 0
result: passed
summary: checked 13 links and 22 id references in 12 files; ok
fingerprint: aggregate 86352465410ba10dbb85a221a44cca87ab847f4b249cf5b59cf8c8b44625bebf over sha256 lines (sorted by path) of scripts/check-docs-links.py adc3bbd7…, AGENTS.md c1f7d773…, SPEC-BTAE 1693bc8f…, engineering-protocol f85719c0…, guided-workspace record ce1b1514…; this record excluded
artifacts: none (stdout summarized in the record)
validity: valid (anchored to the five inputs; the storing record is excluded)
```

```text
EVIDENCE-104  docs check negative control
task: TASK-2026-11-25-btae-protocol-alignment
checker: scripts/check-docs-links.py (python3 3.14.4)
command: python3 scripts/check-docs-links.py /tmp/docscheck-neg/bad.md
cwd: repository root
started_at / finished_at: 2026-11-25T09:15:47Z / 2026-11-25T09:15:47Z
environment: Linux x64; Python 3.14.4; fixture `# bad` with `[a](missing.md)`, `See EVIDENCE-999`, `TASK-2026-01-01-nope`
exit_code: 1 (expected)
result: passed (all three defects reported)
summary: 3 issues — missing link (line 3), undefined EVIDENCE-999 (line 5), no TASK record (line 7)
fingerprint: n/a (synthetic fixture; content described above)
artifacts: none
validity: valid (negative control only)
```

## Risks / open questions

- Design status stays `draft`; a human owner must review the authority docs before they are `approved`.
- EVIDENCE-101 is `stale` after the authority docs changed; EVIDENCE-103 supersedes it. The historical result is retained, not rewritten.
- The docs check is a repository command but not CI-enforced; wiring it requires authorization for `.github/workflows/**`.
- `scripts/check-docs-links.py` is stdlib-only and has no unit test; EVIDENCE-103 and the negative control EVIDENCE-104 cover it.
- Docs-only evidence does not exercise runtime behavior; it proves document consistency, not product behavior.
