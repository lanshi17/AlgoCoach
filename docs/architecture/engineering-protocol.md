# Engineering protocol

Operational companion to [AGENTS.md](../../AGENTS.md) and [SPEC-BTAE](../intent/requirements/SPEC-BTAE.md). Entity/evidence rules live in the spec; this file defines how to run each change type.

## 0. Mode, tier, and record

1. Probe the BTAE MCP tools once (`btae_project_context`). Record `Tooling: mcp` or `Tooling: repo-native (<client>, <date>)` in the task record; this repository is `repo-native` (no MCP server, no EPE CLI).
2. Assign a tier before editing:

| Tier | Trigger | Required artifacts | Verification |
|------|---------|--------------------|--------------|
| T1 | one file; no contract, API, schema, security, or architecture surface | task record ≤ 15 lines | reproduction or focused test; one native check |
| T2 | default; multi-file module work | task record with requirements, entities, trace rows, acceptance | native checks for every touched stack |
| T3 | public contract, schema, DB, security boundary, cross-layer or multi-module architecture | T2 + ADR/design record, scope/dependency analysis | T2 + contract tests on both sides + fingerprints |

Never downgrade a tier to skip documentation; never apply T3 ceremony to a T1 fix.

3. Create or reuse `docs/intent/tasks/YYYY-MM-DD-<slug>.md` from the header fields: type, tier, tooling, risk, design status, implementation, verification, evidence. Reuse an existing record before creating one.

## 1. Always

1. Read `AGENTS.md`, the relevant module doc, and the task record if one exists.
2. Identify the entity set and write scope before editing. If scope grows, stop and record why.
3. Prefer existing patterns. A second convention needs an explicit reason in the task record.
4. Use `edit`/`write` for file changes; use `lsp` for definitions, references, and type information before changing exported symbols.
5. Do not edit protected paths (see `AGENTS.md` §Boundaries) without explicit authorization.
6. Before relying on a new `*.md` authority file, run `git check-ignore -v <path>`; the repository ignores `*.md` outside `README.md`, `AGENTS.md`, and `docs/**`.

## 2. Feature

**Before code**

- Fill the task record: objectives, acceptance conditions (`AC-n`), entities, write scope, protected paths, dependencies, risks, design decisions.
- Update the module spec (`docs/frontend.md`, `docs/architecture.md`, module README) so intended behavior exists in prose first.

**Implementation**

- Smallest coherent change set. No placeholder branches, TODO stubs, or fake fallbacks.
- Wire every caller; remove obsolete paths in the same change.
- Add behavior tests only where the consumer-visible contract is uncertain or the feature's core claim needs proof. Do not test wiring, echoes, or source text.
- If the feature touches `FOCUS`, enumerate every AI surface and prove each is silenced. New AI surface ⇒ new `FOCUS` check.

**Acceptance**

- Each `AC-n` maps to a named check or an explicit `unverified` row.
- Run the touched-stack suite once at the end and record evidence blocks.

## 3. Bugfix

1. Quote the user report or write a failing test. No fix without a reproduction.
2. State the root cause in one sentence. If you cannot, the "fix" is a guess; keep investigating.
3. Fix the cause, not the symptom. Do not add retries, suppress errors, or special-case inputs to hide it.
4. Prove the reproduction now passes, and that the covering suite still passes.
5. Add a regression test only if no existing test covers the path.
6. Record the pre-change result as the baseline in the task record.

## 4. Refactor

1. Capture a baseline: run the covering suite and record the result.
2. Pin behavior with existing tests. If coverage is missing for the surface being moved, add characterization tests first.
3. Change structure only. No behavior changes, no new features, no drive-by renames.
4. After the refactor, the same tests must pass unchanged. If a test must change, the contract changed — reclassify as feature/bugfix.
5. Report the architecture diff (module boundaries, imports, public symbols).

## 5. Exploration

- Label prototypes and spikes. Keep them out of production paths or behind an explicit flag.
- Write the hypothesis, the evidence needed to accept/reject it, and the discard criterion before building.
- Report findings, not correctness claims. Exploration output is never `verified`.

## 6. Adoption (uncommitted worktree)

1. Inventory: `git status --short`, `git diff --stat`, untracked list. Note files you did not write.
2. Attribute: decide what is in scope for this session; never claim authorship of unknown work.
3. Baseline: run the existing checks before editing so pre-existing failures are distinguishable. Record the result.
4. Fill gaps only for what you change; do not retro-document untouched files.
5. Verify the combined result, not only your own delta.
6. Commit only declared-scope files; a whole-worktree commit needs explicit user confirmation. Use selective staging, never `git add -A`.

## 7. Cross-layer changes

1. Write the contract first: endpoint, payload, error shape, ownership of state.
2. Change producer and consumer in one change set; never leave a half-migrated wire.
3. Test both sides at their own boundary; add an integration check if a harness exists.
4. Record the contract fingerprint (field list) and mark the change T3.

## 8. Checks

Run the narrowest check first, then the touched-stack suite once. Run only stacks the change touches. Do not replace a missing command with an invented one; report "no configured check".

| Layer | Narrow | Full |
|-------|--------|------|
| Frontend component | `npx vitest run <file>` | `npm test` |
| Frontend types | `npx tsc --noEmit` | same |
| Frontend lint | `npm run lint` | same |
| Agent | `python -m pytest -q <path>` | `python -m pytest -q` plus ruff/mypy |
| Gateway | `mvn -B test -Dtest=<Class>` | `mvn -B test` |
| Docs-only | relative-link/cross-reference check | `markdownlint` if configured, else link check |

Record command, cwd, UTC start/end, environment, exit code, observed summary, manifest digest, and artifact paths as one `EVIDENCE-<n>` block (see the spec). Pipe long output to an artifact and cite the path. Report pre-existing failures separately from failures introduced by the change.

## 9. Definition of done

- Acceptance conditions implemented end to end; no stubs or deferred behavior.
- Design docs updated; obsolete docs/code deleted.
- Scope matches the record.
- Checks run and recorded; evidence `valid` for the final code state (re-run after any input change).
- Risks, unknowns, and missing approvals stated in the report.
- No secrets, runtime data, or build output added to version control.

## 10. When a check fails

- Read the failure; do not re-run to confirm a user-reported failure.
- Fix the cause in the same scope. If the failure is unrelated to the change, record it and leave it alone; do not "clean up" adjacent failures.
- A failed check is evidence, not a blocker to reporting. Report what failed, what it means, and what remains.
