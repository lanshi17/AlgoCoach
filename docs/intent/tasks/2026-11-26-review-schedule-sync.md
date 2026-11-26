# TASK-2026-11-26-review-schedule-sync — carry review schedules across devices

Type: feature
Tier: T3
Tooling: repo-native (omp/commandcode, 2026-11-26)
Risk: medium
Design status: draft (approval by: unassigned — no human review yet)
Implementation: implemented
Verification: passed
Evidence: valid (EVIDENCE-140/141/142/143/144/145/146/147)
ADR: [ADR-3](../../architecture/ADR-3-review-schedule-sync.md), [ADR-2](../../architecture/ADR-2-cross-device-mastery.md) (both draft)

## Objective

The v1 cross-device bundle moved topic mastery but left each device's review queue behind. Extend the bundle to v2 with per-problem review schedules, merge them by the newest update, and keep device-local notification state so an import cannot suppress a real reminder.

## Acceptance conditions

- AC-1: export returns `algocoach-mastery-v2` with sorted `reviewSchedules` beside topics — verified by `test_mastery_sync.py`.
- AC-2: import creates missing schedules and replaces an existing schedule only when the remote `updatedAt` is newer — verified by `test_mastery_sync.py`.
- AC-3: updating a schedule preserves local `notified_on` / `last_notified_at` and clears the remote `source_episode_id` — verified by `test_mastery_sync.py`.
- AC-4: an older or equal schedule is left unchanged — verified by `test_mastery_sync.py`.
- AC-5: v1 bundles still import topics and do not touch schedules — verified by `test_mastery_sync.py`.
- AC-6: invalid timestamps, interval 0, blank topics, and malformed schedule lists are rejected with 422 / parser errors — verified by `test_mastery_sync.py` and `masterySync.test.ts`.
- AC-7: the Settings import reports separate topic and schedule counts and the source workspace — verified by `SettingsPage.test.tsx`.
- AC-8: the Gateway continues to forward both endpoints with query and body — verified by `AgentProxyControllerTest`.
- AC-9: the v2 contract, LWW rule, notification boundary, and compatibility are documented — verified by EVIDENCE-147.

## Scope

- Target entities: `CONTRACT-mastery-bundle`, `MOD-MEMORY`, `MOD-AGENT-ROUTER`, `MOD-GATEWAY-PROXY`, `MOD-MASTERY-SYNC`, `MOD-SETTINGS`, `MOD-DOCS`, `ADR-2`, `ADR-3`.
- Write scope: `backend/agent/app/models/schemas.py`, `backend/agent/app/memory/memory_service.py`, `backend/agent/app/agent/router.py`, `backend/agent/tests/test_mastery_sync.py`, `frontend/src/types/index.ts`, `frontend/src/services/masterySync.ts`, `frontend/src/services/masterySync.test.ts`, `frontend/src/pages/SettingsPage.tsx`, `frontend/src/pages/SettingsPage.test.tsx`, `docs/architecture/ADR-2-cross-device-mastery.md`, `docs/architecture/ADR-3-review-schedule-sync.md`, `docs/frontend.md`, `docs/backend-agent.md`, `docs/memory-system.md`, `docs/deeptutor-adaptation.md`, this record.
- Protected paths: none touched. Gateway source is unchanged; its existing tests were rerun for the contract.
- Dependencies: existing `review_schedule` table, mastery bundle endpoints, and Settings import/export UI.

## Design notes (design → code)

1. **Same envelope, new version.** `algocoach-mastery-v2` adds `reviewSchedules` to the existing bundle. `algocoach-mastery-v1` remains importable with topics only; export always writes v2.
2. **Last-writer-wins, not max.** A review can move `dueAt` forward on a pass or backward on a failure, so the newest `updatedAt` is authoritative. Equal timestamps keep the local row. Topics keep their monotonic max merge, so the two rules stay separate.
3. **Notification state is local.** `notified_on` and `last_notified_at` are not exported or applied. Importing them could suppress a reminder on the receiving device or cause a duplicate push.
4. **No remote episode link.** Imported schedules set `source_episode_id = NULL`; a remote episode id has no row in the local database.
5. **Dedupe before write.** If a bundle contains several rows for one problem, the newest `updatedAt` wins before counting. Counts are unique-topic / unique-problem counts.
6. **Validation on both sides.** The browser checks ISO timestamps, interval 1–3650, mastery 0–1, attempts 0–1e6, up to 50 topics per schedule, and at most 5000 schedules. Pydantic enforces the same bounds; a v1 bundle without schedules remains valid.
7. **No Gateway change.** The existing proxy already forwards body and query to the fixed upstream paths; the new fields are opaque to it. Its tests were rerun to confirm the routes still forward.

## Trace table (code → design)

| Entity | Implementation | Verification |
|--------|----------------|--------------|
| `CONTRACT-mastery-bundle` | `schemas.py` (`ReviewScheduleBundle`, v2 export model, import counts) | `test_mastery_sync.py` |
| `MOD-MEMORY` | `memory_service.py` (`export_mastery`, schedule LWW import) | `test_mastery_sync.py` |
| `MOD-AGENT-ROUTER` | `router.py` (schedules passed to the merge) | `test_mastery_sync.py` |
| `MOD-GATEWAY-PROXY` | unchanged `AgentProxyController` | `AgentProxyControllerTest` |
| `MOD-MASTERY-SYNC` | `masterySync.ts`, `types/index.ts` | `masterySync.test.ts` |
| `MOD-SETTINGS` | `SettingsPage.tsx` (copy + counts) | `SettingsPage.test.tsx` |
| `MOD-DOCS` / ADR | docs + ADR-3, ADR-2 link | EVIDENCE-147 |

## Verification

Environment: Linux 7.0.0-43-generic x64; Node v24.13.0; npm 11.17.0; Vitest 1.6.1 / jsdom; Python 3.12 venv; JDK 21 (`/home/lanshi/.local/jdk-21`). Input manifest: the 17 checked inputs below; aggregate digest `f4b21e4b412d59432acddc7ece303a1b050ce833ac246a1eca542a0b385bf3b0` over sorted `sha256<two spaces>path` lines. This record is excluded from its own manifest.

```text
EVIDENCE-140  frontend typecheck
task: TASK-2026-11-26-review-schedule-sync
target_entities: MOD-MASTERY-SYNC, MOD-SETTINGS
checker: tsc
command: npx tsc --noEmit
cwd: frontend/
started_at / finished_at: 2026-11-26T02:23:16Z / 2026-11-26T02:23:18Z
environment: Linux x64; node 24.13.0; npm 11.17.0
exit_code: 0 (expected 0)
result: passed
summary: no diagnostics
input_manifest: as the 17-file manifest; aggregate f4b21e4b…
artifacts: none
validity: valid
```

```text
EVIDENCE-141  frontend lint
task: TASK-2026-11-26-review-schedule-sync
target_entities: MOD-MASTERY-SYNC, MOD-SETTINGS
checker: eslint
command: npm run lint
cwd: frontend/
started_at / finished_at: 2026-11-26T02:23:18Z / 2026-11-26T02:23:20Z
environment: Linux x64; node 24.13.0; npm 11.17.0
exit_code: 0 (expected 0)
result: passed
summary: no findings
input_manifest: as EVIDENCE-140; aggregate f4b21e4b…
artifacts: /tmp/review-sync-lint.out (sha256 b9dc24903293165476b9aec70ed49cceb5a1b14257f07ad260b7948d5025a6e6, ephemeral)
validity: valid
```

```text
EVIDENCE-142  frontend full suite
task: TASK-2026-11-26-review-schedule-sync
target_entities: MOD-MASTERY-SYNC, MOD-SETTINGS
checker: vitest
command: npx vitest run
cwd: frontend/
started_at / finished_at: 2026-11-26T02:23:20Z / 2026-11-26T02:23:23Z
environment: Linux x64; node 24.13.0; vitest 1.6.1; jsdom
exit_code: 0 (expected 0)
result: passed
summary: 45 files, 292 tests passed (291 before; one parser test for schedules/v1)
input_manifest: as EVIDENCE-140; aggregate f4b21e4b…
artifacts: /tmp/review-sync-frontend-tests.out (sha256 bc03b504ed2a68b6deac4263b24f5b1839fc1f787c4f760d8f9cda417e8ac27c, ephemeral)
validity: valid
```

```text
EVIDENCE-143  gateway full suite
task: TASK-2026-11-26-review-schedule-sync
target_entities: MOD-GATEWAY-PROXY
checker: Maven Surefire (JDK 21)
command: JAVA_HOME=/home/lanshi/.local/jdk-21 mvn -B test
cwd: backend/gateway/
started_at / finished_at: 2026-11-26T02:23:29Z / 2026-11-26T02:23:37Z
environment: Linux x64; OpenJDK 21
exit_code: 0 (expected 0)
result: passed
summary: 126 tests passed; proxy routes unchanged and still forward body/query
input_manifest: as EVIDENCE-140; aggregate f4b21e4b…
artifacts: /tmp/review-sync-gateway-tests.out (sha256 8f652ede66ca136c03b2945fc10b01d5891b47a6346af1cb73ff3319553fdc2c, ephemeral)
validity: valid
```

```text
EVIDENCE-144  agent full suite
task: TASK-2026-11-26-review-schedule-sync
target_entities: CONTRACT-mastery-bundle, MOD-MEMORY, MOD-AGENT-ROUTER
checker: pytest
command: .venv/bin/python -m pytest -q
cwd: backend/agent/
started_at / finished_at: 2026-11-26T02:26:52Z / 2026-11-26T02:29:14Z
environment: Linux x64; Python 3.12 venv; pytest 9.2.0
exit_code: 0 (expected 0)
result: passed
summary: 341 passed, 3 skipped (337 before; four net new schedule tests)
input_manifest: as EVIDENCE-140; aggregate f4b21e4b…
artifacts: /tmp/review-sync-agent-tests2.out (sha256 4dfa1b5b953e3d134091e994a31040e49d07625946dd25c62a662a42e88506cb, ephemeral)
validity: valid
```

```text
EVIDENCE-145  agent types
task: TASK-2026-11-26-review-schedule-sync
target_entities: CONTRACT-mastery-bundle, MOD-MEMORY, MOD-AGENT-ROUTER
checker: mypy 1.18.2
command: .venv/bin/mypy app --ignore-missing-imports --follow-imports=silent
cwd: backend/agent/
started_at / finished_at: 2026-11-26T02:25:55Z / 2026-11-26T02:25:57Z
environment: Linux x64; Python 3.12 venv
exit_code: 0 (expected 0)
result: passed
summary: no issues in 23 source files
input_manifest: as EVIDENCE-140; aggregate f4b21e4b…
artifacts: /tmp/review-sync-mypy2.out (sha256 0547a0c3285b9ca3196f7fd67b05c7a3363ba12d4befab6173ae4b3988bfd24d, ephemeral)
validity: valid
```

```text
EVIDENCE-146  agent lint
task: TASK-2026-11-26-review-schedule-sync
target_entities: CONTRACT-mastery-bundle, MOD-MEMORY, MOD-AGENT-ROUTER
checker: ruff 0.15.17
command: .venv/bin/ruff check --isolated app tests
cwd: backend/agent/
started_at / finished_at: 2026-11-26T02:26:02Z / 2026-11-26T02:26:02Z
environment: Linux x64; Python 3.12 venv
exit_code: 0 (expected 0)
result: passed
summary: all checks passed
input_manifest: as EVIDENCE-140; aggregate f4b21e4b…
artifacts: /tmp/review-sync-ruff2.out (sha256 82b3e6a6c090a57601d22943bd23fca9218d1031dbe5a7b754092f9a156b4f18, ephemeral)
validity: valid
```

```text
EVIDENCE-147  docs link/reference check
task: TASK-2026-11-26-review-schedule-sync
target_entities: MOD-DOCS, ADR-2, ADR-3
checker: scripts/check-docs-links.py (python3 3.14.4)
command: python3 scripts/check-docs-links.py
cwd: repository root
started_at / finished_at: 2026-11-26T02:26:31Z / 2026-11-26T02:26:31Z
environment: Linux x64; python3 3.14.4; git worktree
exit_code: 0 (expected 0)
result: passed
summary: 23 files, 17 links, 54 id references; ok. This record is excluded from its own manifest because the block is written after the run.
input_manifest: ADR-2 1e43361e…, ADR-3 446c49ea…, docs/backend-agent.md c911aa2b…, docs/deeptutor-adaptation.md 8325bc53…, docs/frontend.md ed11c27a…, docs/memory-system.md aa8423e1…; the script also reads the existing authority docs and task records; this record excluded
artifacts: none
validity: valid
```

## Risks / open questions

- Last-writer-wins trusts the exporting Agent's UTC clock. Skewed clocks can let an older schedule replace a newer one; the manual bundle has no trusted time source.
- A later state can move `dueAt` backward (a failed review), which is intended but may surprise a learner expecting the queue only to move forward.
- Notification fields remain local; a reminder already sent on one device may be sent again on another.
- Imported schedules have no local episode, so graph co-occurrence, daily stats, and streaks do not include the source device.
- Importing a crafted bundle can set arbitrary future or past due dates; mastery and schedules are local trust data.
- Manual file transfer only; no automatic cloud sync or device identity.
- Design status and ADR-2/ADR-3 remain `draft`; no human approval yet.
