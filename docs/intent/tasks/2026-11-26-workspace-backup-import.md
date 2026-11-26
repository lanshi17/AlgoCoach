# TASK-2026-11-26-workspace-backup-import — restore a workspace snapshot without overwriting local work

Type: feature
Tier: T2
Tooling: repo-native (omp/commandcode, 2026-11-26)
Risk: medium
Design status: draft
Implementation: implemented
Verification: passed
Evidence: valid (EVIDENCE-164/165/166/167)

## Objective

`algocoach-workspace-v1` can be downloaded from Settings but never restored or merged. Add an import path for the local browser data (tasks, notebook, practice records, review entries, review events) with a conservative rule: add records the current workspace does not have, keep every local record on an ID conflict, and never import provider credentials, Agent memory, chat, or code.

## Acceptance conditions

- AC-1: Settings accepts a `algocoach-workspace-v1` JSON file up to 5 MB, rejects malformed JSON, wrong formats, non-array collections, and oversized collections with a visible error, and leaves storage untouched on rejection.
- AC-2: import adds missing tasks, notebook entries, practice records, review entries, and review events; every existing local record wins on an ID/problemId conflict.
- AC-3: review events deduplicate by `problemId + reviewedAt + rating`; repeated imports are idempotent.
- AC-4: imported practice records do not displace existing local records when the 80-record cap is full; imported entries only fill free slots, newest first.
- AC-5: imported review entries without a valid schedule remain readable; entries are never silently dropped for a missing optional field.
- AC-6: Settings reports added/skipped counts, names the source workspace, and warns that layout, chat, code, provider keys, and Agent memory are not imported.
- AC-7: docs describe the backup/restore boundary and local-wins merge; no provider secret or chat content enters the bundle.

## Scope

- Target entities: `MOD-WORKSPACE-IMPORT`, `MOD-TASKS`, `MOD-NOTEBOOK`, `MOD-LOCAL-PROGRESS`, `MOD-REVIEW-QUEUE`, `MOD-SETTINGS`, `MOD-DOCS`.
- Write scope: `frontend/src/services/workspaceImport.ts`, `frontend/src/services/workspaceImport.test.ts`, `frontend/src/services/learningTasks.ts`, `frontend/src/services/learningNotebook.ts`, `frontend/src/services/localProgress.ts`, `frontend/src/services/reviewQueue.ts`, `frontend/src/pages/SettingsPage.tsx`, `frontend/src/pages/SettingsPage.test.tsx`, `docs/frontend.md`, this record.
- Protected paths: none.
- Dependencies: `createWorkspaceExport`, existing storage readers/normalizers, workspace key isolation, Settings file-selection patterns.

## Design notes (design → code)

1. **Local wins, add-only.** Existing records are never updated or deleted by import. Missing IDs/problemIds are added; conflicting imported records count as skipped. This makes restore safe and idempotent, and avoids clock-skew LWW for user-authored notes and tasks.
2. **Validate at the boundary.** Parse the format tag and arrays first, enforce per-collection limits and a 5 MB file cap, then let each storage module normalize individual records. Invalid individual records are skipped and counted; the whole import is rejected only for a malformed envelope.
3. **Practice cap keeps local.** Existing local records stay; imported missing records fill remaining slots up to 80, newest first. A full local board therefore loses nothing.
4. **Review evidence.** Review entries add missing problemIds; events dedupe by their natural composite key. Optional schedule/mastered fields are preserved as supplied; no schedule is synthesized by the importer.
5. **No hidden side effects.** Import does not write Agent memory, enqueue sync, change the active workspace, or import layout/preferences. The source workspace is shown only as context.
6. **One status line.** Settings accepts a file through a hidden input, shows counts and a boundary warning, and does not fetch or start any background work.

## Verification

Environment: Linux 7.0.0-43-generic x64; Node v24.13.0; npm 11.17.0; Vitest 1.6.1 / jsdom; Chromium via the browser helper. Input manifest: the ten changed inputs below; aggregate digest `a7c1b379b0ed9fc64cc48326b213b9e37f1264c75ea943400e9ecbc4def92872` over sorted `sha256<two spaces>path` lines. This record is excluded from its own manifest.

```text
EVIDENCE-164  frontend typecheck
task: TASK-2026-11-26-workspace-backup-import
target_entities: MOD-WORKSPACE-IMPORT, MOD-TASKS, MOD-NOTEBOOK, MOD-LOCAL-PROGRESS, MOD-REVIEW-QUEUE, MOD-SETTINGS
checker: tsc
command: npx tsc --noEmit
cwd: frontend/
started_at / finished_at: 2026-11-26T03:31:41Z / 2026-11-26T03:31:43Z
environment: Linux x64; node 24.13.0; npm 11.17.0
exit_code: 0 (expected 0)
result: passed
summary: no diagnostics
input_manifest: as the ten-file manifest; aggregate a7c1b379…
artifacts: none
validity: valid
```

```text
EVIDENCE-165  frontend lint
task: TASK-2026-11-26-workspace-backup-import
target_entities: MOD-WORKSPACE-IMPORT, MOD-TASKS, MOD-NOTEBOOK, MOD-LOCAL-PROGRESS, MOD-REVIEW-QUEUE, MOD-SETTINGS
checker: eslint
command: npm run lint
cwd: frontend/
started_at / finished_at: 2026-11-26T03:31:43Z / 2026-11-26T03:31:44Z
environment: Linux x64; node 24.13.0; npm 11.17.0
exit_code: 0 (expected 0)
result: passed
summary: no findings
input_manifest: as EVIDENCE-164; aggregate a7c1b379…
artifacts: /tmp/backup-import-lint.out (sha256 b9dc24903293165476b9aec70ed49cceb5a1b14257f07ad260b7948d5025a6e6, ephemeral)
validity: valid
```

```text
EVIDENCE-166  frontend full suite
task: TASK-2026-11-26-workspace-backup-import
target_entities: MOD-WORKSPACE-IMPORT, MOD-TASKS, MOD-NOTEBOOK, MOD-LOCAL-PROGRESS, MOD-REVIEW-QUEUE, MOD-SETTINGS
checker: vitest
command: npx vitest run
cwd: frontend/
started_at / finished_at: 2026-11-26T03:31:44Z / 2026-11-26T03:31:48Z
environment: Linux x64; node 24.13.0; vitest 1.6.1; jsdom
exit_code: 0 (expected 0)
result: passed
summary: 47 files, 308 tests passed (303 before; five new: four import/merge cases and the Settings upload path)
input_manifest: as EVIDENCE-164; aggregate a7c1b379…
artifacts: /tmp/backup-import-tests.out (sha256 f195375b7036e949f01ccffea31f230c169812331062092fc32f9ff61905342b, ephemeral)
validity: valid
```

```text
EVIDENCE-167  docs link/reference check
task: TASK-2026-11-26-workspace-backup-import
target_entities: MOD-DOCS
checker: scripts/check-docs-links.py (python3 3.14.4)
command: python3 scripts/check-docs-links.py
cwd: repository root
started_at / finished_at: 2026-11-26T03:32:03Z / 2026-11-26T03:32:03Z
environment: Linux x64; python3 3.14.4; git worktree
exit_code: 0 (expected 0)
result: passed
summary: 28 files, 18 links, 64 id references; ok. This record is excluded from its own manifest because the block is written after the run.
input_manifest: docs/frontend.md 0db0c5e5…, docs/deeptutor-adaptation.md 007f6532…; the script also reads the authority docs and other task records; this record excluded
artifacts: none
validity: valid
```

## Findings from the browser run

- `/settings` accepted a JSON backup through the hidden file input and showed `已补充 任务 1 条。来源 workspace：browser-check；导入到当前 workspace。`
- The imported task appeared on `/learning/dashboard` after navigating there, while existing local tasks remained.
- The message also stated that layout, chat, code, Provider keys, and Agent memory are not imported.
- No gateway or hub was running; import is purely browser-local and succeeded offline.

## Risks / open questions

- Add-only restore cannot update a record that already exists locally; a learner who wants the remote version must delete the local record first. This is deliberate to avoid silent data loss.
- The source workspace ID is informational. Import always targets the currently selected workspace; there is no cross-workspace remap or switch.
- Imported practice records are not queued for Agent memory sync. Mastery and review schedules still need the v2 bundle or the hub.
- A malformed individual record is skipped while the rest of the envelope imports; the skipped count is shown, but partially corrupt backups still restore their valid records.
- Layout, guided conversation snapshots, task drag state, Provider keys, and Agent memory remain out of scope.
- The 5 MB file cap and per-collection limits protect the browser, but a very large review-event history can still hit the 10,000-entry import limit and be rejected.
- Design status remains `draft`; no human approval yet.
