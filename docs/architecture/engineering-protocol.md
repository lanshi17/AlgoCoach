# Engineering protocol

Companion to `AGENTS.md` and `docs/intent/requirements/SPEC-BTAE.md`. This is the operational checklist for each change type.

## 0. Always

1. Read `AGENTS.md`, the relevant module doc, and the task record if one exists.
2. Identify the entity set and write scope before editing. If scope grows, stop and record why.
3. Prefer existing patterns. A second convention needs an explicit reason in the task record.
4. Use `edit`/`write` for file changes; use `lsp` for definitions, references, and type information before changing exported symbols.
5. Do not edit protected paths (see `AGENTS.md` §7) without explicit authorization.

## 1. Feature

**Before code**

- Create `docs/intent/tasks/YYYY-MM-DD-<slug>.md` with: requirements (`REQ-*`), affected modules, write scope, protected paths, acceptance conditions, design decisions, risks.
- Update the module spec (`docs/frontend.md`, `docs/architecture.md`, module README) so the intended behavior exists in prose before implementation.

**Implementation**

- Smallest coherent change set. No placeholder branches, TODO stubs, or fake fallbacks.
- Wire every caller; remove obsolete paths in the same change.
- Add behavior tests only where the consumer-visible contract is uncertain or where the feature's core claim needs proof. Do not test wiring, echoes, or source text.
- If the feature touches `FOCUS`, enumerate every AI surface and prove each one is silenced. New AI surface ⇒ new `FOCUS` check.

**Acceptance**

- Each acceptance condition maps to a named check or an explicit `unverified` row.
- Full frontend/agent/gateway suite for touched layers runs once at the end.

## 2. Bugfix

1. Quote the user report or write a failing test. No fix without a reproduction.
2. State the root cause in one sentence. If you cannot, the "fix" is a guess; keep investigating.
3. Fix the cause, not the symptom. Do not add retries, suppress errors, or special-case inputs to hide it.
4. Prove the reproduction now passes, and that the covering suite still passes.
5. Add a regression test only if no existing test covers the path.

## 3. Refactor

1. Capture a baseline: run the covering suite and record the result.
2. Pin behavior with existing tests. If coverage is missing for the surface being moved, add characterization tests first.
3. Change structure only. No behavior changes, no new features, no drive-by renames.
4. After the refactor, the same tests must pass unchanged. If a test must change, the contract changed — reclassify as a feature/bugfix.

## 4. Exploration

- Label prototypes and spikes. Keep them out of production paths or behind an explicit flag.
- Write the hypothesis, the evidence needed to accept/reject it, and the discard criterion before building.
- Report findings, not correctness claims. Exploration output is never `verified`.

## 5. Cross-layer changes

When a change crosses frontend/gateway/agent:

1. Write the contract first: endpoint, payload, error shape, ownership of state.
2. Change the producer and consumer in one change set; never leave a half-migrated wire.
3. Test both sides at their own boundary; add one integration check if an existing harness exists.
4. Record the contract fingerprint (field list) in the task record.

## 6. Checks

Run the narrowest check first, then the layer suite once.

| Layer | Narrow | Full |
|-------|--------|------|
| Frontend component | `npx vitest run <file>` | `npm test` |
| Frontend types | `npx tsc --noEmit` | same |
| Frontend lint | `npm run lint` | same |
| Agent | `python -m pytest -q <path>` | `python -m pytest -q` plus ruff/mypy |
| Gateway | `mvn -B test -Dtest=<Class>` | `mvn -B test` |

Record command, directory, timestamp, environment, exit code, and observed summary in the task record. Pipe long output to an artifact and cite the path.

## 7. Definition of done

- Requirements implemented end to end; no stubs or deferred behavior.
- Design docs updated; obsolete docs/code deleted.
- Scope matches the record.
- Checks run and recorded; evidence current for the final code state.
- Risks, unknowns, and missing approvals stated in the report.
- No secrets, runtime data, or build output added to version control.

## 8. When a check fails

- Read the failure; do not re-run to confirm a user-reported failure.
- Fix the cause in the same scope. If the failure is unrelated to the change, record it and leave it alone; do not "clean up" adjacent failures.
- A failed check is evidence, not a blocker to reporting. Report what failed, what it means, and what remains.
