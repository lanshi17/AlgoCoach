# TASK-2026-11-26-cross-device-mastery-sync — move mastery between devices

Type: feature
Tier: T3
Tooling: repo-native (omp/commandcode, 2026-11-26)
Risk: medium
Design status: draft (approval by: unassigned — no human review yet)
Implementation: implemented
Verification: passed
Evidence: valid (EVIDENCE-132/133/134/135/136/137/138/139)
ADR: [ADR-2](../../architecture/ADR-2-cross-device-mastery.md) (draft)

## Objective

Mastery lives in each device's local Agent SQLite table, so switching devices loses the topic map. Add a local-first, manual cross-device path: export a small topic-level JSON bundle on one device and import it on another, merging monotonically so order and repetition do not matter.

## Acceptance conditions

- AC-1: `GET /api/agent/memory/mastery-export` returns `{format, exportedAt, workspaceId, topics}` with only topic-level aggregates, sorted by topic — verified by `test_mastery_sync.py`.
- AC-2: `POST /api/agent/memory/mastery-import` creates new topics and updates existing ones with `max(mastery)`, `max(attempts)`, later `lastSeen`; a second import is all-unchanged — verified by `test_mastery_sync.py`.
- AC-3: import targets the query workspace and leaves other workspaces untouched — verified by `test_mastery_sync.py`.
- AC-4: import writes only semantic aggregates, never episodic rows or review schedules — verified by `test_mastery_sync.py`.
- AC-5: invalid format, mastery outside 0–1, blank topic, or non-list topics are rejected with 422 — verified by `test_mastery_sync.py`.
- AC-6: the frontend rejects malformed JSON, wrong format, invalid fields, and more than 5000 topics before upload — verified by `masterySync.test.ts`.
- AC-7: Settings exports/imports the bundle and reports merged counts plus a source-workspace hint — verified by `SettingsPage.test.tsx` and an observed browser render.
- AC-8: the Gateway forwards both endpoints with query and body — verified by `AgentProxyControllerTest`.
- AC-9: the format, merge rule, scope, and limitations are documented — verified by EVIDENCE-139.

## Scope

- Target entities: `CONTRACT-mastery-bundle`, `MOD-MEMORY`, `MOD-AGENT-ROUTER`, `MOD-GATEWAY-PROXY`, `MOD-SETTINGS`, `MOD-MASTERY-SYNC`, `MOD-DOCS`, `ADR-2`.
- Write scope: `backend/agent/app/models/schemas.py`, `backend/agent/app/memory/memory_service.py`, `backend/agent/app/agent/router.py`, `backend/agent/tests/test_mastery_sync.py`, `backend/gateway/src/main/java/com/algocoach/controller/AgentProxyController.java`, `backend/gateway/src/test/java/com/algocoach/controller/AgentProxyControllerTest.java`, `frontend/src/types/index.ts`, `frontend/src/services/agentService.ts`, `frontend/src/services/masterySync.ts`, `frontend/src/services/masterySync.test.ts`, `frontend/src/pages/SettingsPage.tsx`, `frontend/src/pages/SettingsPage.test.tsx`, `docs/architecture/ADR-2-cross-device-mastery.md`, `docs/frontend.md`, `docs/backend-agent.md`, `docs/memory-system.md`, `docs/deeptutor-adaptation.md`, this record.
- Protected paths: none touched. No DB schema, workspace key, security boundary, or CI change.
- Dependencies: existing `semantic` table, Agent proxy, Settings download helper, and workspace-scoped paths.

## Design notes (design → code)

1. **Manual bundle, not a cloud service.** There is no account or device identity in the product, so automatic replication would require inventing hosting and conflict resolution. A JSON file moved by the learner is the smallest honest cross-device path; ADR-2 records the alternatives.
2. **Monotonic join.** Per topic: `mastery = max`, `attempts = max`, `lastSeen = later`. The join is idempotent, commutative, and associative, so re-imports and two-way imports converge without clocks. It deliberately cannot lower local mastery from another device's negative evidence.
3. **Aggregates only.** Export selects `semantic` rows for one workspace; import writes only those rows. Episodes, review schedules, vectors, chat, code, and training stats stay local, so imported topics appear in the graph without co-occurrence edges or progress counts.
4. **Explicit target.** The query `workspaceId` is the import target; the bundle's `workspaceId` is source metadata used by the UI hint. This makes importing into a different local workspace an explicit action.
5. **Double validation.** The browser checks JSON, `format`, field ranges, and a 5000-topic bound; Pydantic checks the same contract again. A 2 MB file cap prevents accidental huge uploads.
6. **Stable contract.** `format = algocoach-mastery-v1` gates future shape changes. Duplicate topics inside one bundle are merged before counting.
7. **UI.** Settings gains a 跨设备掌握度 block with import/export buttons, status text, and a source-workspace notice when it differs from the current workspace.

## Trace table (code → design)

| Entity | Implementation | Verification |
|--------|----------------|--------------|
| `CONTRACT-mastery-bundle` | `schemas.py` (`MasteryBundleTopic`, import/export models), docs | `test_mastery_sync.py` |
| `MOD-MEMORY` | `memory_service.py` (`export_mastery`, `import_mastery`, `_later_timestamp`) | `test_mastery_sync.py` |
| `MOD-AGENT-ROUTER` | `router.py` (two routes) | `test_mastery_sync.py` |
| `MOD-GATEWAY-PROXY` | `AgentProxyController.java` + tests | `AgentProxyControllerTest` |
| `MOD-MASTERY-SYNC` | `masterySync.ts` (client validation), `types/index.ts`, `agentService.ts` | `masterySync.test.ts` |
| `MOD-SETTINGS` | `SettingsPage.tsx` (file input, export/import, messages) | `SettingsPage.test.tsx`; browser render |
| `MOD-DOCS` / `ADR-2` | docs + ADR | EVIDENCE-139 |

## Verification

Environment: Linux 7.0.0-43-generic x64; Node v24.13.0; npm 11.17.0; Vitest 1.6.1 / jsdom; Python 3.12 venv; JDK 21 (`/home/lanshi/.local/jdk-21`); Chromium. Input manifest: the 17 changed inputs below; aggregate digest `2e7bba67eea4501236fd82ddaab9f08eb46725981995bd5903a6b2b8654fcf41` over sorted `sha256<two spaces>path` lines. This record is excluded from its own manifest.

```text
EVIDENCE-132  frontend typecheck
task: TASK-2026-11-26-cross-device-mastery-sync
target_entities: MOD-MASTERY-SYNC, MOD-SETTINGS
checker: tsc
command: npx tsc --noEmit
cwd: frontend/
started_at / finished_at: 2026-11-26T02:03:37Z / 2026-11-26T02:03:39Z
environment: Linux x64; node 24.13.0; npm 11.17.0
exit_code: 0 (expected 0)
result: passed
summary: no diagnostics
input_manifest: as the 17-file manifest; aggregate 2e7bba67…
artifacts: none
validity: valid
```

```text
EVIDENCE-133  frontend lint
task: TASK-2026-11-26-cross-device-mastery-sync
target_entities: MOD-MASTERY-SYNC, MOD-SETTINGS
checker: eslint
command: npm run lint
cwd: frontend/
started_at / finished_at: 2026-11-26T02:03:39Z / 2026-11-26T02:03:41Z
environment: Linux x64; node 24.13.0; npm 11.17.0
exit_code: 0 (expected 0)
result: passed
summary: no findings
input_manifest: as EVIDENCE-132; aggregate 2e7bba67…
artifacts: /tmp/cross-device-lint.out (sha256 b9dc24903293165476b9aec70ed49cceb5a1b14257f07ad260b7948d5025a6e6, ephemeral)
validity: valid
```

```text
EVIDENCE-134  frontend full suite
task: TASK-2026-11-26-cross-device-mastery-sync
target_entities: MOD-MASTERY-SYNC, MOD-SETTINGS
checker: vitest
command: npx vitest run
cwd: frontend/
started_at / finished_at: 2026-11-26T02:03:41Z / 2026-11-26T02:03:46Z
environment: Linux x64; node 24.13.0; vitest 1.6.1; jsdom
exit_code: 0 (expected 0)
result: passed
summary: 45 files, 291 tests passed (286 before; five new: four parser tests and one Settings import test)
input_manifest: as EVIDENCE-132; aggregate 2e7bba67…
artifacts: /tmp/cross-device-frontend-tests.out (sha256 fedcf911fd7d40f3ecb3614bc67da19fe4bb6625983dd84317418f6581144e80, ephemeral)
validity: valid
```

```text
EVIDENCE-135  gateway full suite
task: TASK-2026-11-26-cross-device-mastery-sync
target_entities: MOD-GATEWAY-PROXY
checker: Maven Surefire (JDK 21)
command: JAVA_HOME=/home/lanshi/.local/jdk-21 mvn -B test
cwd: backend/gateway/
started_at / finished_at: 2026-11-26T02:03:25Z / 2026-11-26T02:03:33Z
environment: Linux x64; OpenJDK 21
exit_code: 0 (expected 0)
result: passed
summary: 126 tests passed (124 before; two proxy tests)
input_manifest: as EVIDENCE-132; aggregate 2e7bba67…
artifacts: /tmp/cross-device-gateway-tests.out (sha256 59d4a6d7b60f154e5c1fdedb9a1edee5d5ecc98f3ae5c3634204c1e64d16de7d, ephemeral)
validity: valid
```

```text
EVIDENCE-136  agent full suite
task: TASK-2026-11-26-cross-device-mastery-sync
target_entities: CONTRACT-mastery-bundle, MOD-MEMORY, MOD-AGENT-ROUTER
checker: pytest
command: .venv/bin/python -m pytest -q
cwd: backend/agent/
started_at / finished_at: 2026-11-26T02:09:25Z / 2026-11-26T02:11:42Z
environment: Linux x64; Python 3.12 venv; pytest 9.2.0
exit_code: 0 (expected 0)
result: passed
summary: 337 passed, 3 skipped (336 before; one import-scope test added)
input_manifest: as EVIDENCE-132; aggregate 2e7bba67…
artifacts: /tmp/cross-device-agent-tests3.out (sha256 ca1bfa690515f198c9ea599b976d20d2d66c58ed997ed3349c857176cfb9206f, ephemeral)
validity: valid
```

```text
EVIDENCE-137  agent types
task: TASK-2026-11-26-cross-device-mastery-sync
target_entities: CONTRACT-mastery-bundle, MOD-MEMORY, MOD-AGENT-ROUTER
checker: mypy 1.18.2
command: .venv/bin/mypy app --ignore-missing-imports --follow-imports=silent
cwd: backend/agent/
started_at / finished_at: 2026-11-26T02:09:03Z / 2026-11-26T02:09:06Z
environment: Linux x64; Python 3.12 venv
exit_code: 0 (expected 0)
result: passed
summary: no issues in 23 source files
input_manifest: as EVIDENCE-132; aggregate 2e7bba67…
artifacts: /tmp/cross-device-mypy-final.out (sha256 0547a0c3285b9ca3196f7fd67b05c7a3363ba12d4befab6173ae4b3988bfd24d, ephemeral)
validity: valid
```

```text
EVIDENCE-138  agent lint
task: TASK-2026-11-26-cross-device-mastery-sync
target_entities: CONTRACT-mastery-bundle, MOD-MEMORY, MOD-AGENT-ROUTER
checker: ruff 0.15.17
command: .venv/bin/ruff check --isolated app tests
cwd: backend/agent/
started_at / finished_at: 2026-11-26T02:11:55Z / 2026-11-26T02:11:55Z
environment: Linux x64; Python 3.12 venv
exit_code: 0 (expected 0)
result: passed
summary: all checks passed
input_manifest: as EVIDENCE-132; aggregate 2e7bba67…
artifacts: /tmp/cross-device-ruff4.out (sha256 82b3e6a6c090a57601d22943bd23fca9218d1031dbe5a7b754092f9a156b4f18, ephemeral)
validity: valid
```

```text
EVIDENCE-139  docs link/reference check
task: TASK-2026-11-26-cross-device-mastery-sync
target_entities: MOD-DOCS, ADR-2
checker: scripts/check-docs-links.py (python3 3.14.4)
command: python3 scripts/check-docs-links.py
cwd: repository root
started_at / finished_at: 2026-11-26T02:12:17Z / 2026-11-26T02:12:17Z
environment: Linux x64; python3 3.14.4; git worktree
exit_code: 0 (expected 0)
result: passed
summary: 21 files, 15 links, 50 id references; ok. This record is excluded from its own manifest because the block is written after the run.
input_manifest: docs/architecture/ADR-2-cross-device-mastery.md 6baf6d82…, docs/backend-agent.md c82f5cbe…, docs/deeptutor-adaptation.md 8c9071e9…, docs/frontend.md ee9ba8e0…, docs/memory-system.md a0ebcc56…; the script also reads the existing authority docs and task records; this record excluded
artifacts: none
validity: valid
```

## Findings from the browser run

- `/settings` rendered the 跨设备掌握度 block with the explanation, hidden file input, 导入掌握度, and 导出掌握度 controls at a 1039px section width.
- No live Agent was running, so the browser did not exercise a real export/import; the HTTP contracts are covered by the Agent and Gateway tests, and the UI import path by `SettingsPage.test.tsx`.

## Risks / open questions

- Manual transfer only: no accounts, background sync, device identity, or cloud replication. Users must move the JSON file themselves.
- Monotonic merge cannot lower mastery from another device's failures. It favors not losing strong local evidence over reconciling negative evidence; a future event-log sync could address this.
- Imported topics lack local episodes, so graph edges, daily counts, streaks, average duration, and review schedules do not reflect the source device. Only topic mastery/attempts/lastSeen move.
- A crafted bundle can inflate mastery. This is local trust data, matching the existing manual export model.
- The frontend parser and Agent schema enforce 5000 topics; a legitimate very large workspace above that would need chunking or a higher bound.
- Design status and ADR-2 remain `draft`; no human approval yet.
