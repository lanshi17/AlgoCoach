# TASK-2026-11-26-auto-sync-loop-coverage — make the background sync schedule testable

Type: refactor
Tier: T2
Tooling: repo-native (omp/commandcode, 2026-11-26)
Risk: low
Design status: draft
Implementation: implemented
Verification: passed
Evidence: valid (EVIDENCE-172/173/174/175)

## Objective

The automatic sync schedule lives inline in `AppShell` and has no automated coverage: its mount run, 60-second interval, visibility/online triggers, error swallowing, and cleanup are only verified by reading the code. Extract the loop into `autoSync.ts` with an injectable runner/interval and cover every trigger plus teardown.

## Acceptance conditions

- AC-1: `startAutoSyncLoop` runs immediately when the page is visible, every interval while visible, on visible `visibilitychange`, and on `online`.
- AC-2: a hidden page does not start or retry a sync; becoming visible does.
- AC-3: a rejected run is swallowed so it cannot surface as an unhandled rejection; the failure remains recorded by `runAutoSync` for Settings.
- AC-4: the returned cleanup clears the interval and removes both listeners; no callback fires afterward.
- AC-5: `AppShell` uses the extracted loop and preserves the existing 60-second behavior.
- AC-6: docs name the schedule and the automated coverage; no user-facing behavior changes.

## Scope

- Target entities: `MOD-AUTO-SYNC`, `MOD-APP-SHELL`, `MOD-DOCS`.
- Write scope: `frontend/src/services/autoSync.ts`, `frontend/src/services/autoSync.test.ts`, `frontend/src/components/Layout/AppShell.tsx`, `docs/frontend.md`, this record.
- Protected paths: none.
- Dependencies: existing `runAutoSync` and the AppShell mount effect.

## Design notes (design → code)

1. **Pure scheduling helper.** `startAutoSyncLoop(run = runAutoSync, intervalMs = 60_000)` owns timers and listeners and returns one cleanup function. The runner is injectable for deterministic tests.
2. **Visibility guard.** The initial and interval calls check `document.visibilityState === 'visible'`; the visibility listener only acts when the new state is visible; `online` also goes through the same guard, so a hidden tab stays quiet until it becomes visible.
3. **Swallowed rejection.** The helper catches the runner's rejection; `runAutoSync` has already recorded the failure and dispatched it to Settings, so AppShell needs no duplicate handling.
4. **Same behavior.** AppShell's effect becomes `return startAutoSyncLoop()`; interval and triggers stay identical.

## Verification

Environment: Linux 7.0.0-43-generic x64; Node v24.13.0; npm 11.17.0; Vitest 1.6.1 / jsdom. Input manifest: the four changed inputs below; aggregate digest `202d1990c193ef8a9f2ef34db53ce34486540057ed9659235e6b40aa402f6d98` over sorted `sha256<two spaces>path` lines. This record is excluded from its own manifest.

```text
EVIDENCE-172  frontend typecheck
task: TASK-2026-11-26-auto-sync-loop-coverage
target_entities: MOD-AUTO-SYNC, MOD-APP-SHELL
checker: tsc
command: npx tsc --noEmit
cwd: frontend/
started_at / finished_at: 2026-11-26T07:44:11Z / 2026-11-26T07:44:14Z
environment: Linux x64; node 24.13.0; npm 11.17.0
exit_code: 0 (expected 0)
result: passed
summary: no diagnostics
input_manifest: as the four-file manifest; aggregate 202d1990…
artifacts: none
validity: valid
```

```text
EVIDENCE-173  frontend lint
task: TASK-2026-11-26-auto-sync-loop-coverage
target_entities: MOD-AUTO-SYNC, MOD-APP-SHELL
checker: eslint
command: npm run lint
cwd: frontend/
started_at / finished_at: 2026-11-26T07:44:14Z / 2026-11-26T07:44:15Z
environment: Linux x64; node 24.13.0; npm 11.17.0
exit_code: 0 (expected 0)
result: passed
summary: no findings
input_manifest: as EVIDENCE-172; aggregate 202d1990…
artifacts: /tmp/sync-loop-lint.out (sha256 b9dc24903293165476b9aec70ed49cceb5a1b14257f07ad260b7948d5025a6e6, ephemeral)
validity: valid
```

```text
EVIDENCE-174  frontend full suite
task: TASK-2026-11-26-auto-sync-loop-coverage
target_entities: MOD-AUTO-SYNC, MOD-APP-SHELL
checker: vitest
command: npx vitest run
cwd: frontend/
started_at / finished_at: 2026-11-26T07:44:15Z / 2026-11-26T07:44:19Z
environment: Linux x64; node 24.13.0; vitest 1.6.1; jsdom
exit_code: 0 (expected 0)
result: passed
summary: 47 files, 311 tests passed (309 before; two new schedule tests: trigger/teardown and rejected-run survival)
input_manifest: as EVIDENCE-172; aggregate 202d1990…
artifacts: /tmp/sync-loop-tests.out (sha256 e18b997103e884d7e74a21030495baf041e4b250ef9a6555b469c26b47a9158f, ephemeral)
validity: valid
```

```text
EVIDENCE-175  docs link/reference check
task: TASK-2026-11-26-auto-sync-loop-coverage
target_entities: MOD-DOCS
checker: scripts/check-docs-links.py (python3 3.14.4)
command: python3 scripts/check-docs-links.py
cwd: repository root
started_at / finished_at: 2026-11-26T07:44:45Z / 2026-11-26T07:44:45Z
environment: Linux x64; python3 3.14.4; git worktree
exit_code: 0 (expected 0)
result: passed
summary: 30 files, 18 links, 67 id references; ok. This record is excluded from its own manifest because the block is written after the run.
input_manifest: docs/frontend.md e15e218e…; the script also reads the authority docs and other task records; this record excluded
artifacts: none
validity: valid
```

## Findings

- The helper reproduces the previous AppShell schedule exactly: visible-only mount/interval, visible `visibilitychange`, and `online` through the same guard.
- Fake-timer tests cover the interval, hidden-page skip, visibility return, online, cleanup, and a rejected runner without unhandled rejection.
- No browser run: this is a no-op refactor, and AppShell's existing tests still pass.

## Risks / open questions

- The helper is browser-only (`document`/`window`) and covered in jsdom, not a real tab lifecycle. Browser visibility events can be coalesced or delayed.
- A hidden tab stays quiet even on `online`; it syncs when it becomes visible. This preserves the previous behavior but is a deliberate choice.
- The loop still polls; there is no backoff, push channel, or jitter, so many open clients produce synchronized intervals.
- A rejected runner is swallowed after `runAutoSync` records it; other injected runners must record their own failures for Settings to show them.
- No real-browser run was performed; the existing AppShell integration test only confirms the shell still mounts and renders.
- Design status remains `draft`; no human approval yet.
