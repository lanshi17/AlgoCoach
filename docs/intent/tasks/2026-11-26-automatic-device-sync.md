# TASK-2026-11-26-automatic-device-sync — exchange mastery and review plans automatically

Type: feature
Tier: T3
Tooling: repo-native (omp/commandcode, 2026-11-26)
Risk: high
Design status: draft (approval by: unassigned — no human review yet)
Implementation: implemented
Verification: passed
Evidence: valid (EVIDENCE-148/149/150/151/152/153/154/155)
ADR: [ADR-4](../../architecture/ADR-4-automatic-device-sync.md) (draft)

## Objective

Manual export/import works but is easy to forget. Add an optional shared sync hub: devices point at one Gateway/Agent with a shared token, exchange the v2 mastery + review bundle over HTTP, and converge on the same topic mastery and due schedule without moving files.

## Acceptance conditions

- AC-1: `POST /memory/sync` returns 503 when `ALGOCOACH_SYNC_TOKEN` is unset and 403 for a wrong token — verified by `test_mastery_sync.py`.
- AC-2: a valid sync merges the incoming bundle into the hub workspace and returns the merged v2 bundle with counts — verified by `test_mastery_sync.py`.
- AC-3: the Gateway forwards `/api/agent/memory/sync` with body, workspace query, and `X-AlgoCoach-Sync-Token` — verified by `AgentProxyControllerTest`.
- AC-4: `ALGOCOACH_ALLOWED_ORIGINS` adds an extra CORS origin for the sync token preflight — verified by `CorsConfigTest`.
- AC-5: the frontend exports the local bundle, posts it with the token, validates the returned bundle, and imports it into the local Agent — verified by `autoSync.test.ts`.
- AC-6: a disabled or incomplete configuration performs no request; HTTP failure leaves the last-sync timestamp unchanged — verified by `autoSync.test.ts`.
- AC-7: enabling without a hub URL/token is rejected in the Settings UI with a visible message — verified by `SettingsPage.test.tsx` and the browser render.
- AC-8: automatic runs are scheduled on mount, every 60 seconds while visible, on visibility return, and on `online`; overlapping calls share one in-flight promise — implemented in `AppShell.tsx`/`autoSync.ts`; timer behaviour is not covered by an automated test (see risks).
- AC-9: the token, hub URL, CORS requirement, endpoint contract, and remaining limits are documented — verified by EVIDENCE-155.

## Scope

- Target entities: `CONTRACT-memory-sync`, `MOD-MEMORY`, `MOD-AGENT-ROUTER`, `MOD-GATEWAY-PROXY`, `MOD-CORS`, `MOD-AUTO-SYNC`, `MOD-SETTINGS`, `MOD-DOCS`, `ADR-4`.
- Write scope: `backend/agent/app/config.py`, `backend/agent/app/models/schemas.py`, `backend/agent/app/memory/memory_service.py`, `backend/agent/app/agent/router.py`, `backend/agent/tests/test_mastery_sync.py`, `backend/gateway/src/main/java/com/algocoach/controller/AgentProxyController.java`, `backend/gateway/src/test/java/com/algocoach/controller/AgentProxyControllerTest.java`, `backend/gateway/src/main/java/com/algocoach/config/CorsConfig.java`, `backend/gateway/src/test/java/com/algocoach/config/CorsConfigTest.java`, `frontend/src/components/Layout/AppShell.tsx`, `frontend/src/pages/SettingsPage.tsx`, `frontend/src/pages/SettingsPage.test.tsx`, `frontend/src/services/autoSync.ts`, `frontend/src/services/autoSync.test.ts`, `README.md`, `docs/architecture/ADR-4-automatic-device-sync.md`, `docs/frontend.md`, `docs/backend-agent.md`, `docs/memory-system.md`, `docs/deeptutor-adaptation.md`, this record.
- Protected paths: none touched. `.env.example` and CI are unchanged.
- Dependencies: existing v2 bundle export/import, Agent memory service, Gateway proxy, and Settings download helpers.

## Design notes (design → code)

1. **Hub endpoint, same merge.** `POST /memory/sync` imports the v2 bundle into the hub workspace and returns the merged full bundle; it reuses `import_mastery`/`export_mastery`, so topic max-merge and schedule LWW are identical to manual sync.
2. **Fail closed on auth.** The endpoint is disabled unless `ALGOCOACH_SYNC_TOKEN` is set; `X-AlgoCoach-Sync-Token` is compared with `hmac.compare_digest`, never logged or returned. A missing token is 503, a wrong token 403.
3. **Minimal Gateway surface.** The Gateway adds one fixed route and forwards only the sync token header in addition to the existing content-type/authorization. CORS gains `ALGOCOACH_ALLOWED_ORIGINS`; the default Vite origins remain.
4. **Client push/pull in one request.** `runAutoSync` exports the local bundle, posts it to the hub, validates the returned v2 bundle with the same parser, and imports it locally. The import result drives the Settings counts.
5. **Scheduling.** AppShell calls `runAutoSync` on mount, every 60 seconds while visible, on visibility return, and on `online`. The service serializes overlapping runs through one in-flight promise and aborts a request after 12 seconds. Background failures are swallowed; the Settings page shows manual results and the last successful timestamp.
6. **Local-only secret.** The hub URL and token live in localStorage, are not in the workspace export, and are not sent anywhere except the configured hub.
7. **Same workspace required.** Both devices send their current workspace ID; different IDs stay separate even on the same hub. Manual export/import remains available for cross-workspace or offline moves.

## Trace table (code → design)

| Entity | Implementation | Verification |
|--------|----------------|--------------|
| `CONTRACT-memory-sync` | `schemas.py` (`MemorySyncResponse`), docs | `test_mastery_sync.py` |
| `MOD-MEMORY` | `memory_service.py` (reused import/export) | `test_mastery_sync.py` |
| `MOD-AGENT-ROUTER` | `router.py` (token gate, merge, return) | `test_mastery_sync.py` |
| `MOD-GATEWAY-PROXY` | `AgentProxyController` (route + token header) | `AgentProxyControllerTest` |
| `MOD-CORS` | `CorsConfig` (extra origins) | `CorsConfigTest` |
| `MOD-AUTO-SYNC` | `autoSync.ts` (settings, run, in-flight, last sync) | `autoSync.test.ts` |
| `MOD-SETTINGS` | `SettingsPage.tsx` (switch, URL, token, status) | `SettingsPage.test.tsx`; browser render |
| `MOD-DOCS` / ADR | docs + ADR-4 | EVIDENCE-155 |

## Verification

Environment: Linux 7.0.0-43-generic x64; Node v24.13.0; npm 11.17.0; Vitest 1.6.1 / jsdom; Python 3.12 venv; JDK 21 (`/home/lanshi/.local/jdk-21`); Chromium. Input manifest: the 20 checked inputs below; aggregate digest `7bb0f2da53a0c02bbb74d0e5b993d4320ee8f1f9f306b91d1eafb9da36321c97` over sorted `sha256<two spaces>path` lines. This record is excluded from its own manifest.

```text
EVIDENCE-148  frontend typecheck
task: TASK-2026-11-26-automatic-device-sync
target_entities: MOD-AUTO-SYNC, MOD-SETTINGS
checker: tsc
command: npx tsc --noEmit
cwd: frontend/
started_at / finished_at: 2026-11-26T02:48:32Z / 2026-11-26T02:48:35Z
environment: Linux x64; node 24.13.0; npm 11.17.0
exit_code: 0 (expected 0)
result: passed
summary: no diagnostics
input_manifest: as the 20-file manifest; aggregate 7bb0f2da…
artifacts: none
validity: valid
```

```text
EVIDENCE-149  frontend lint
task: TASK-2026-11-26-automatic-device-sync
target_entities: MOD-AUTO-SYNC, MOD-SETTINGS
checker: eslint
command: npm run lint
cwd: frontend/
started_at / finished_at: 2026-11-26T02:48:35Z / 2026-11-26T02:48:37Z
environment: Linux x64; node 24.13.0; npm 11.17.0
exit_code: 0 (expected 0)
result: passed
summary: no findings
input_manifest: as EVIDENCE-148; aggregate 7bb0f2da…
artifacts: /tmp/auto-sync-lint.out (sha256 b9dc24903293165476b9aec70ed49cceb5a1b14257f07ad260b7948d5025a6e6, ephemeral)
validity: valid
```

```text
EVIDENCE-150  frontend full suite
task: TASK-2026-11-26-automatic-device-sync
target_entities: MOD-AUTO-SYNC, MOD-SETTINGS
checker: vitest
command: npx vitest run
cwd: frontend/
started_at / finished_at: 2026-11-26T02:48:37Z / 2026-11-26T02:48:41Z
environment: Linux x64; node 24.13.0; vitest 1.6.1; jsdom
exit_code: 0 (expected 0)
result: passed
summary: 46 files, 297 tests passed (292 before; five new: four auto-sync tests, one Settings validation test)
input_manifest: as EVIDENCE-148; aggregate 7bb0f2da…
artifacts: /tmp/auto-sync-frontend-tests.out (sha256 3b0163b72c3ac830afe5efc6d2dd13761f1319365a7ed131f80d598703e63582, ephemeral)
validity: valid
```

```text
EVIDENCE-151  gateway full suite
task: TASK-2026-11-26-automatic-device-sync
target_entities: MOD-GATEWAY-PROXY, MOD-CORS
checker: Maven Surefire (JDK 21)
command: JAVA_HOME=/home/lanshi/.local/jdk-21 mvn -B test
cwd: backend/gateway/
started_at / finished_at: 2026-11-26T02:48:32Z / 2026-11-26T02:48:41Z
environment: Linux x64; OpenJDK 21
exit_code: 0 (expected 0)
result: passed
summary: 128 tests passed (126 before; sync proxy and CORS extra-origin tests)
input_manifest: as EVIDENCE-148; aggregate 7bb0f2da…
artifacts: /tmp/auto-sync-gateway-tests.out (sha256 269f7c84d01ee3f88c27f1e0ed36fe8636f0d3fb9291e6e01c410c59347329dc, ephemeral)
validity: valid
```

```text
EVIDENCE-152  agent full suite
task: TASK-2026-11-26-automatic-device-sync
target_entities: CONTRACT-memory-sync, MOD-MEMORY, MOD-AGENT-ROUTER
checker: pytest
command: .venv/bin/python -m pytest -q
cwd: backend/agent/
started_at / finished_at: 2026-11-26T02:48:32Z / 2026-11-26T02:50:59Z
environment: Linux x64; Python 3.12 venv; pytest 9.2.0
exit_code: 0 (expected 0)
result: passed
summary: 344 passed, 3 skipped (341 before; three sync-hub tests)
input_manifest: as EVIDENCE-148; aggregate 7bb0f2da…
artifacts: /tmp/auto-sync-agent-tests.out (sha256 6a64b7be9d7fccf8baefcb67872687bab99d12ed61b2d4618d2f31fe886921cf, ephemeral)
validity: valid
```

```text
EVIDENCE-153  agent types
task: TASK-2026-11-26-automatic-device-sync
target_entities: CONTRACT-memory-sync, MOD-MEMORY, MOD-AGENT-ROUTER
checker: mypy 1.18.2
command: .venv/bin/mypy app --ignore-missing-imports --follow-imports=silent
cwd: backend/agent/
started_at / finished_at: 2026-11-26T02:50:59Z / 2026-11-26T02:51:02Z
environment: Linux x64; Python 3.12 venv
exit_code: 0 (expected 0)
result: passed
summary: no issues in 23 source files
input_manifest: as EVIDENCE-148; aggregate 7bb0f2da…
artifacts: /tmp/auto-sync-mypy.out (sha256 611aa1600f7acd9acfcbc9ac5e20d1d5610cebbd07e3a6640ee7199f4005c824, ephemeral)
validity: valid
```

```text
EVIDENCE-154  agent lint
task: TASK-2026-11-26-automatic-device-sync
target_entities: CONTRACT-memory-sync, MOD-MEMORY, MOD-AGENT-ROUTER
checker: ruff 0.15.17
command: .venv/bin/ruff check --isolated app tests
cwd: backend/agent/
started_at / finished_at: 2026-11-26T02:51:02Z / 2026-11-26T02:51:02Z
environment: Linux x64; Python 3.12 venv
exit_code: 0 (expected 0)
result: passed
summary: all checks passed
input_manifest: as EVIDENCE-148; aggregate 7bb0f2da…
artifacts: /tmp/auto-sync-ruff.out (sha256 816502ac87846f033683c449f88a8feea2ce6b6aa6e8b102738f99a75f15bb94, ephemeral)
validity: valid
```

```text
EVIDENCE-155  docs link/reference check
task: TASK-2026-11-26-automatic-device-sync
target_entities: MOD-DOCS, ADR-4
checker: scripts/check-docs-links.py (python3 3.14.4)
command: python3 scripts/check-docs-links.py
cwd: repository root
started_at / finished_at: 2026-11-26T02:52:28Z / 2026-11-26T02:52:28Z
environment: Linux x64; python3 3.14.4; git worktree
exit_code: 0 (expected 0)
result: passed
summary: 25 files, 18 links, 58 id references; ok. This record is excluded from its own manifest because the block is written after the run.
input_manifest: README.md 522e596d…, ADR-4 407081dc…, docs/backend-agent.md 1e051f23…, docs/deeptutor-adaptation.md 406b94a5…, docs/frontend.md 0d1f305f…, docs/memory-system.md d1cb9019…; the script also reads the existing authority docs and task records; this record excluded
artifacts: none
validity: valid
```

## Findings from the browser run

- `/settings` rendered the automatic-sync block with the switch, hub URL, token field, 保存并同步 button, and explanatory copy; the layout stayed within the panel.
- Enabling the switch without a hub/token and pressing 保存并同步 produced `启用自动同步需要填写同步服务地址和令牌。` with no network request.
- A live hub was not running in the browser check; endpoint auth/merge and client exchange are covered by the Agent, Gateway, and service tests.

## Risks / open questions

- The token is a shared secret with no per-device identity, rotation UI, or revocation; anyone holding it can read or rewrite the sync aggregates.
- HTTP hubs send the token and aggregates in clear text on the LAN. TLS termination is the operator's responsibility.
- Automatic polling adds background traffic every minute; there is no push channel, and a background failure is silent until the next successful sync or a manual run.
- Clock skew still affects schedule LWW; a device with a fast clock can overwrite a newer state.
- A malicious hub can return a valid but arbitrary bundle and change local mastery/due dates.
- The scheduling timer and visibility/online triggers are implemented but not covered by an automated test; only `runAutoSync` itself is tested.
- Both devices must use the same workspace ID and reach the same hub; manual bundles remain the only cross-workspace/offline path.
- Design status and ADR-4 remain `draft`; no human approval yet.
