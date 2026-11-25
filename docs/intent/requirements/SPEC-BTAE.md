# SPEC-BTAE — design, evidence, and traceability layers

Status: draft (bootstrapped 2026-11-25; not yet reviewed by a human owner)
Scope: this repository only. `AGENTS.md` remains the top-level authority.

## 1. Why this exists

AlgoCoach spans a React frontend, a Java gateway, a Python agent, and an Electron shell. A single feature can change intent, contracts, code, and tests. Without a layering rule, prose and code drift, "done" becomes opinion, and an unverified assumption is indistinguishable from a checked fact.

BTAE separates five representations and never lets one stand in for another.

| Layer | Representation | Lives in | Answers |
|-------|----------------|----------|---------|
| L0 Intent | requirements, task scope | `docs/intent/` | Why and what, in user-visible terms |
| L1 Architecture | boundaries, module contracts | `docs/architecture/`, `docs/*.md` | Where the change belongs, what must not leak |
| L2 Design | entities, states, decisions, tradeoffs | `docs/intent/tasks/*.md`, module READMEs | How it works and why this shape |
| L3 Implementation | code | `frontend/`, `backend/` | What exists |
| L4 Behavior evidence | tests and runnable checks | `**/*.test.*`, test scripts | What was observed to work |
| L5 Execution record | commands, results, fingerprints | task record `Evidence` section | What was actually run, when, against which code |

Markdown carries intent. Code carries behavior. Tests carry observed behavior. Execution records carry proof. Schemas and machine checks, when added, carry constraints.

## 2. Entities and identity

An entity is a logical thing with a stable ID, not a file:

```text
REQ-<area>-<n>      requirement
TASK-YYYY-MM-DD-<slug> task/design record
MOD-<module>        architecture module (Layout, GuidedLearning, Gateway, Agent, ...)
ADR-<n>             architecture decision
```

Rules:

- IDs are stable English strings. Titles may be Chinese, matching repository prose.
- When a file moves or splits, the entity ID does not change; update the entity's path table row.
- One task record may cover several entities and many files. Do not create one document per code file.
- An entity whose implementation is deleted must be removed from the record or marked retired; do not leave phantom traceability.

## 3. Traceability

Both directions must hold:

- Design → implementation → tests: every requirement has an implementation location and at least one behavior check, or is explicitly marked unverified.
- Implementation → design: every non-trivial module maps back to an entity and a task record; no orphan behavior.

Traceability rows in task records use this shape:

```text
| Requirement | Implementation | Behavior evidence | Status |
```

`Status` values: `unverified` (static discovery or model inference only), `verified` (a named check observed it), `failed`, `retired`.

## 4. Four independent state axes

Do not collapse these into one status word:

1. **Design state** — `draft`, `reviewed`, `approved`. Only a human owner grants `approved`. An agent may produce `draft` and request review.
2. **Implementation state** — `not_started`, `in_progress`, `implemented`, `removed`. Describes code, not quality.
3. **Verification result** — `not_run`, `passed`, `failed`, `partial`. Describes one execution of one check.
4. **Evidence validity** — `current`, `stale`, `unknown`. `stale` when code, dependencies, or contracts changed after the recorded run; recompute the fingerprint or re-run.

Forbidden transitions:

- `draft` → `approved` by agent action.
- `passed` without a recorded command and output.
- `current` after editing the code the evidence covers.
- `verified` for behavior observed only by reading source.

## 5. Evidence record

Each verification entry in a task record contains:

```text
Command: exact command line
Directory: working directory
Time: ISO-8601 timestamp
Environment: OS, runtime versions, relevant fixtures
Result: exit code and the observed summary (counts, failures)
Fingerprint: hash of the changed/untracked inputs or git diff at run time
Artifact: path to full output when the summary is not enough
```

Fingerprints:

- Committed work: record the commit SHA.
- Uncommitted work: `git diff | sha256sum` plus a `sha256sum` list of untracked files. If either changes, evidence becomes `stale`.

## 6. Gates

A change may be reported complete only when:

1. The applicable L0–L2 documents reflect the implemented behavior.
2. Scope matches the task record; unrelated edits are absent or listed.
3. The narrowest covering check passed, and the full suite ran once before handoff.
4. Evidence is `current` for the final code state.
5. Known unknowns and missing external approvals are stated.

A gate does not grant permission. It records that a check was performed. Host authorization, secrets access, release, and human approval are separate decisions.

## 7. Known limits in this repository

- No BTAE MCP server is installed, so `btae_project_context`, `btae_design_plan`, and `btae_validate_project` are unavailable. The protocol is enforced by documents and commands, not tooling.
- No machine-readable entity registry exists yet. Task records are the registry.
- UI behavior that needs a real browser (pointer drag geometry, overflow at every viewport, localStorage quota) is `unverified` until manually checked; unit tests do not cover it.
