# TASK-2026-11-25-btae-protocol-alignment — align authority docs with BTAE v2

Type: refactor (docs/governance)
Tier: T2
Tooling: repo-native (omp/commandcode, 2026-11-25)
Risk: low
Design status: draft (approval by: unassigned — no human review yet)
Implementation: implemented
Verification: passed
Evidence: valid (docs at 2026-11-25T07:57Z)

## Objective

Bring the repository's BTAE authority documents in line with the updated protocol: explicit `mcp | repo-native` mode, change tiers, adoption workflow, template-shaped task records, and the evidence field/freshness vocabulary.

## Acceptance conditions

- AC-1: the recorded mode is `repo-native`, with the missing MCP/EPE capabilities named — verified by the header here and in [AGENTS.md](../../../AGENTS.md).
- AC-2: [AGENTS.md](../../../AGENTS.md) follows the charter template: scope, repository map, authoritative commands, boundaries, workflow/evidence, conventions — verified by review; link check below.
- AC-3: [SPEC-BTAE](../requirements/SPEC-BTAE.md) uses the spec template sections (Intent, Behavior, Contracts, Acceptance, Out of scope, Open questions) and the `valid/stale/invalid/unknown` evidence vocabulary — verified by review.
- AC-4: the [engineering protocol](../../architecture/engineering-protocol.md) defines tiers T1–T3, the adoption workflow, and docs-only checks, and defers evidence fields to the spec — verified by review.
- AC-5: the [guided-workspace record](2026-11-25-guided-workspace-layout.md) carries template header fields, ACs, a trace table, and evidence blocks with an input manifest — verified by review and the code manifest digest.
- AC-6: relative links in the authority docs resolve — verified by EVIDENCE-101.
- AC-7: every authority document is tracked despite the `*.md` ignore rule — verified by EVIDENCE-102.

## Scope

- Target entities: `SPEC-BTAE`, `MOD-DOCS`, task records for the guided workspace and this alignment.
- Write scope: `AGENTS.md`, `docs/intent/requirements/SPEC-BTAE.md`, `docs/architecture/engineering-protocol.md`, `docs/intent/tasks/2026-11-25-guided-workspace-layout.md`, this record.
- Protected paths: none touched; no code, tests, CI, secrets, or runtime data.
- Dependencies: none at runtime; the guided-workspace record's code evidence references commit `2de217e`.

## Design notes (design → code)

- **One vocabulary.** The spec now uses `pending/passed/failed` for verification and `valid/stale/invalid/unknown` for evidence, replacing the earlier `current`/`not_run` wording.
- **Commit provenance.** Code evidence for the guided workspace now points at commit `2de217e` plus a SHA-256 manifest over the 20 changed `frontend/**` files (aggregate `c16d82fa…`), instead of worktree diff hashes that only existed before the commit.
- **Tiers and adoption.** The protocol gains T1–T3 and the uncommitted-worktree adoption path; future sessions no longer have to improvise.
- **No duplicated references.** The repository documents the field set and freshness rule directly; the skill's global references stay out of the repo.
- **Templates as contracts.** `AGENTS.md` now points at the spec/protocol with real links so a link check can catch drift.

## Trace table (code → design)

| Entity | Implementation | Verification |
|--------|----------------|--------------|
| `SPEC-BTAE` | `docs/intent/requirements/SPEC-BTAE.md` | EVIDENCE-101, review |
| `MOD-DOCS` | `AGENTS.md`, `docs/architecture/engineering-protocol.md` | EVIDENCE-101, EVIDENCE-102 |
| `TASK-2026-11-25-guided-workspace-layout` | `docs/intent/tasks/2026-11-25-guided-workspace-layout.md` | EVIDENCE-101; code manifest `c16d82fa…` |
| `TASK-2026-11-25-btae-protocol-alignment` | this record | EVIDENCE-101, EVIDENCE-102 |

## Verification

Environment: Linux 7.0.0-43-generic x64; Python 3 (stdlib only); git; cwd repository root. Inputs: the four authority documents before this record was added. No code or test inputs changed, so the guided-workspace code evidence remains `valid`.

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
validity: valid
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

## Risks / open questions

- Design status stays `draft`; a human owner must review the authority docs before they are `approved`.
- The docs link check is a local stdlib script, not CI-enforced; a broken link can still land if the check is skipped.
- Docs-only evidence does not exercise runtime behavior; it proves document consistency, not product behavior.
- This record's own links were verified by a follow-up run over five files (reported in the session), not by EVIDENCE-101.
