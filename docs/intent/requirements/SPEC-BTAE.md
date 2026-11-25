# SPEC-BTAE — design, evidence, and traceability layers

Status: draft (bootstrapped 2026-11-25; approval requires a human owner)
Related: [AGENTS.md](../../../AGENTS.md), [engineering protocol](../../architecture/engineering-protocol.md), `TASK-2026-11-25-guided-workspace-layout`, `TASK-2026-11-25-btae-protocol-alignment`

## Intent

AlgoCoach spans a React frontend, a Java gateway, a Python agent, and an Electron shell, so one feature can change intent, contracts, code, and tests. Without a layering rule, prose and code drift, "done" becomes opinion, and an unverified assumption is indistinguishable from a checked fact. This spec defines the layers, identities, states, and evidence rules that keep design, implementation, and proof separate.

## Behavior

### Layers

| Layer | Representation | Lives in | Answers |
|-------|----------------|----------|---------|
| L0 Intent | requirements, task scope | `docs/intent/` | Why and what, in user-visible terms |
| L1 Architecture | boundaries, module contracts | `docs/architecture/`, `docs/*.md` | Where the change belongs, what must not leak |
| L2 Design | entities, states, decisions, tradeoffs | `docs/intent/tasks/*.md`, module READMEs | How it works and why this shape |
| L3 Implementation | code | `frontend/`, `backend/` | What exists |
| L4 Behavior evidence | tests and runnable checks | `**/*.test.*`, test scripts | What was observed to work |
| L5 Execution record | commands, results, fingerprints | task record `Verification` / evidence blocks | What was run, when, against which inputs |

Markdown carries intent; code carries behavior; tests carry observed behavior; execution records carry proof. Machine schemas, when added, carry constraints.

### Entities and identity

```text
REQ-<area>-<n>        requirement
SPEC-<n>              capability specification
MOD-<module>          architecture module (Layout, GuidedLearning, Gateway, Agent, ...)
CONTRACT-<name>       cross-layer wire/file contract
ADR-<n>               architecture decision
TASK-YYYY-MM-DD-<slug> task/design record
EVIDENCE-<n>          one verification run
RUN-<id>              execution grouping when several checks share a run
```

Rules: IDs are stable English strings (titles may be Chinese); moving or splitting a file does not change identity; one task record may cover many entities; deleting an implementation retires its entity instead of leaving phantom traceability.

### Traceability

Both directions must hold: every requirement maps to an implementation and at least one named check (or an explicit `unverified` row); every non-trivial module maps back to an entity and a task record.

Trace rows: `| Requirement | Implementation | Behavior evidence | Status |` with status `unverified` (static discovery or inference only), `verified` (a named check observed it), `failed`, or `retired`.

### Four independent state axes

1. Design — `draft`, `reviewed`, `approved`. Only a recorded human or CI approval grants `approved`.
2. Implementation — `not_started`, `in_progress`, `implemented`, `removed`.
3. Verification — `pending`, `passed`, `failed`. Describes one execution, not design quality.
4. Evidence — `valid`, `stale`, `invalid`, `unknown`. Independent of the verification result.

Forbidden: agent-granted `approved`; `passed` without a recorded command and output; `valid` after the fingerprinted inputs changed; `verified` from source reading alone.

### Evidence fields and freshness

Each block carries: `id` / `run_id`, `task_id`, `target_entities`, `checker` (+ version), `command` (argv as executed), `cwd`, `started_at` / `finished_at` (UTC ISO-8601), `exit_code`, `result` (`passed` / `failed` / `error` / `not_run`), `validity`, `input_manifest` (`{path, sha256}` entries plus an aggregate digest over sorted path+digest lines), `artifacts` (`{path, sha256}`), `environment` (OS, runtime/tool versions, no secrets), `provenance` (commit SHA or worktree fingerprint, host, client).

Freshness: recompute the digests of the recorded input paths. Any change makes the evidence `stale`; the historical result stands but no longer satisfies a gate. Re-run to produce new evidence. Never rewrite an old block's `validity` to `valid` by assumption.

### Gates

A change may be reported complete only when the applicable L0–L2 documents reflect the behavior, scope matches the record, the narrowest covering check passed and the touched-stack suite ran once, evidence is `valid` for the final code state, and known unknowns or missing approvals are stated. A gate records a check; it does not grant permission.

## Contracts

| Surface | Contract | Notes |
|---------|----------|-------|
| `AGENTS.md` | Authority order, authoritative commands, boundaries, workflow, entity scheme | Top-level entrypoint; may not be bypassed by module docs |
| Task record | Header fields: type, tier, tooling, risk, design/implementation/verification/evidence states | One record per logical work item, not per file |
| Evidence block | Field set in "Evidence fields and freshness" | Markdown here; EPE schema if the CLI is installed |
| Entity IDs | Ten known prefixes above | Stable, English, never reused |
| Planning location | `docs/intent/tasks/` | Reuse before creating; no empty scaffolds |

## Acceptance conditions

- AC-1: `AGENTS.md` exists, is tracked despite `*.md` ignores, and lists the authoritative commands — verified by `git check-ignore -v AGENTS.md` (negated rule) and `git ls-files AGENTS.md`.
- AC-2: every task record header carries type, tier, tooling, risk, and all four states — verified by review against the task-record template.
- AC-3: every implemented requirement has a trace row with a named check or an explicit `unverified` status — verified by the record's trace table.
- AC-4: every recorded check has command, cwd, UTC times, exit code, environment, result, manifest digest, and validity — verified by review against the evidence field list.
- AC-5: relative links in authority docs resolve — verified by the docs link check recorded in `TASK-2026-11-25-btae-protocol-alignment`.
- AC-6: evidence whose fingerprinted inputs changed is marked `stale` and re-run before handoff — verified by comparing the manifest digest to the current tree.

## Out of scope

- Implementing the BTAE MCP server or EPE CLI in this repository.
- A machine-readable entity registry; task records are the registry for now.
- Retro-documenting modules the current change did not touch.
- Automating design approval or treating CI green as approval.

## Open questions

- Who owns design approval for this repository? Until assigned, records stay `draft`.
- Install the MCP server/EPE later, or keep `repo-native` permanently?
- Should browser-only layout behavior (pointer drag, overflow) gain an automated harness, or stay `unverified`?
