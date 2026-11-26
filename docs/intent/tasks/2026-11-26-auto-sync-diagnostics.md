# TASK-2026-11-26-auto-sync-diagnostics — surface background sync failures

Type: feature
Tier: T2
Tooling: repo-native (omp/commandcode, 2026-11-26)
Risk: medium
Design status: draft
Implementation: implemented
Verification: passed
Evidence: valid (EVIDENCE-160/161/162/163)

## Objective

Automatic sync runs in the background, but a failed attempt is swallowed by AppShell and Settings only reports manual runs. Record the last failure with a safe message, dispatch it to the open Settings page, and keep it across reloads until a successful sync clears it.

## Acceptance conditions

- AC-1: a failed export, network, timeout, HTTP, response-parse, or import step stores `{at, message}` in workspace-independent localStorage, dispatches `algocoach:auto-sync` with `status: 'failed'`, and still rejects the promise.
- AC-2: failure messages are bounded and never contain the sync token or request body; timeouts and unreachable hubs get actionable text.
- AC-3: a successful sync removes the stored failure, updates the last-sync timestamp, and dispatches `status: 'synced'`.
- AC-4: Settings initializes from a stored failure, shows it as an error, and updates live on a background failure; a later successful event clears both the error and the stored failure.
- AC-5: changing settings clears the visible message as today; the stored failure is not treated as a success.
- AC-6: docs and ADR-4 no longer claim background failures are silent.

## Scope

- Target entities: `MOD-AUTO-SYNC`, `MOD-SETTINGS`, `MOD-DOCS`, `ADR-4`.
- Write scope: `frontend/src/services/autoSync.ts`, `frontend/src/services/autoSync.test.ts`, `frontend/src/pages/SettingsPage.tsx`, `frontend/src/pages/SettingsPage.test.tsx`, `docs/frontend.md`, `docs/architecture/ADR-4-automatic-device-sync.md`, this record.
- Protected paths: none.
- Dependencies: existing `runAutoSync`, `readLastAutoSync`, Settings event listener, and the auto-sync test harness.

## Design notes (design → code)

1. **One failure record.** Store `{at, message}` under `algocoach.autoSyncFailure`; validate shape on read. Success removes it, failure replaces it. Last-sync remains the success-only timestamp.
2. **Bounded, safe text.** Map abort to a timeout message, `TypeError` to an address/network/CORS hint, and other errors to a trimmed message capped at 200 characters. The token, bundle body, and headers are never part of the record.
3. **Same event, two outcomes.** Extend the existing `AutoSyncResult` status to `failed` with optional `message`, so Settings has one listener. `runAutoSync` still throws for callers that need the error.
4. **Restore on open.** Settings initializes the message and error state from the stored failure so a reload does not hide it. A background success clears both; editing settings continues to clear only the visible message.
5. **Quiet but not silent.** AppShell still ignores the rejection, but the recorded state and event make the failure visible while the learner is on Settings.

## Verification

Environment: Linux 7.0.0-43-generic x64; Node v24.13.0; npm 11.17.0; Vitest 1.6.1 / jsdom; Chromium via the browser helper. Input manifest: the six changed inputs below; aggregate digest `37b3a3a6ad82dc623b76d697d5441c8d145d5c2e467ae4d524fcf6be2aff464d` over sorted `sha256<two spaces>path` lines. This record is excluded from its own manifest.

```text
EVIDENCE-160  frontend typecheck
task: TASK-2026-11-26-auto-sync-diagnostics
target_entities: MOD-AUTO-SYNC, MOD-SETTINGS
checker: tsc
command: npx tsc --noEmit
cwd: frontend/
started_at / finished_at: 2026-11-26T03:19:48Z / 2026-11-26T03:19:50Z
environment: Linux x64; node 24.13.0; npm 11.17.0
exit_code: 0 (expected 0)
result: passed
summary: no diagnostics
input_manifest: as the six-file manifest; aggregate 37b3a3a6…
artifacts: none
validity: valid
```

```text
EVIDENCE-161  frontend lint
task: TASK-2026-11-26-auto-sync-diagnostics
target_entities: MOD-AUTO-SYNC, MOD-SETTINGS
checker: eslint
command: npm run lint
cwd: frontend/
started_at / finished_at: 2026-11-26T03:19:50Z / 2026-11-26T03:19:51Z
environment: Linux x64; node 24.13.0; npm 11.17.0
exit_code: 0 (expected 0)
result: passed
summary: no findings
input_manifest: as EVIDENCE-160; aggregate 37b3a3a6…
artifacts: /tmp/sync-diag-lint.out (sha256 b9dc24903293165476b9aec70ed49cceb5a1b14257f07ad260b7948d5025a6e6, ephemeral)
validity: valid
```

```text
EVIDENCE-162  frontend full suite
task: TASK-2026-11-26-auto-sync-diagnostics
target_entities: MOD-AUTO-SYNC, MOD-SETTINGS
checker: vitest
command: npx vitest run
cwd: frontend/
started_at / finished_at: 2026-11-26T03:19:51Z / 2026-11-26T03:19:55Z
environment: Linux x64; node 24.13.0; vitest 1.6.1; jsdom
exit_code: 0 (expected 0)
result: passed
summary: 46 files, 303 tests passed (300 before; three new: failure lifecycle, local-Agent error text, Settings restore/live update)
input_manifest: as EVIDENCE-160; aggregate 37b3a3a6…
artifacts: /tmp/sync-diag-tests.out (sha256 5a2e102d7452145550b977b38df4c275ab18c304f6ed42faa8910442c14344bf, ephemeral)
validity: valid
```

```text
EVIDENCE-163  docs link/reference check
task: TASK-2026-11-26-auto-sync-diagnostics
target_entities: MOD-DOCS, ADR-4
checker: scripts/check-docs-links.py (python3 3.14.4)
command: python3 scripts/check-docs-links.py
cwd: repository root
started_at / finished_at: 2026-11-26T03:20:18Z / 2026-11-26T03:20:18Z
environment: Linux x64; python3 3.14.4; git worktree
exit_code: 0 (expected 0)
result: passed
summary: 27 files, 18 links, 61 id references; ok. This record is excluded from its own manifest because the block is written after the run.
input_manifest: docs/frontend.md c1105e6e…, ADR-4 9929af91…; the script also reads the authority docs and other task records; this record excluded
artifacts: none
validity: valid
```

## Findings from the browser run

- With automatic sync enabled and a stored failure, `/settings` restored the failed state and showed the failure time plus the error text in the danger colour.
- The background sync started on mount and replaced the stored record with the current failure, so the page reflected the latest attempt rather than a stale entry.
- The hint now renders `ALGOCOACH_SYNC_TOKEN` as code instead of literal backticks.
- A successful event is covered by the Settings unit test; no hub was running for an end-to-end success in the browser.

## Risks / open questions

- The failure record is global, not workspace-scoped, matching the single global hub configuration. Switching workspaces does not clear it.
- The record shows the most recent failure only; earlier failures are overwritten. A successful sync clears it.
- Messages are capped at 200 characters, but unexpected third-party error text can still be generic. Local Agent wrapper errors are translated; other errors pass through.
- Settings hides a stored failure while automatic sync is disabled, so re-enabling without a successful run can reveal the old message again.
- AppShell still ignores the rejection by design; the failure is visible on the Settings page, not as a global toast.
- The browser check had no reachable hub, so success in this environment is covered by unit tests, not an end-to-end sync.
