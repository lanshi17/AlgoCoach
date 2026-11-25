# TASK-2026-11-25-review-event-history — surface review self-assessment history

Type: feature
Tier: T2
Tooling: repo-native (omp/commandcode, 2026-11-25)
Risk: low
Design status: draft (approval by: unassigned — no human review yet)
Implementation: implemented
Verification: passed
Evidence: valid (EVIDENCE-105/106/107/108)

## Objective

Make the local review scheduler inspectable: the progress page already stores one event per self-assessment, but the UI never showed them. Display the most recent events with the title, the self-rating, and the interval that rating produced, while keeping the full log for later scheduler evaluation.

## Acceptance conditions

- AC-1: after a due note is rated, the progress page shows a `复习评分记录` entry with the total count, and the new row carries the note title, the rating label, and the resulting interval — verified by `ProgressPage.test.tsx`.
- AC-2: the history lists newest first and caps the table at 20 rows without truncating the stored log or the displayed total — verified by `ProgressPage.test.tsx`.
- AC-3: the progress page and the learning-space review block render the same four rating options from one exported list — verified by `ProgressPage.test.tsx`, `LearningSpaceTaskBoard.test.tsx`, typecheck.
- AC-4: the review-scheduling paragraph in `docs/frontend.md` states that the history is displayed and bounded — verified by inspection and EVIDENCE-108.

## Scope

- Target entities: `MOD-PROGRESS`, `MOD-REVIEW`, `MOD-DOCS`.
- Write scope: `frontend/src/pages/ProgressPage.tsx`, `frontend/src/pages/ProgressPage.test.tsx`, `frontend/src/pages/LearningSpacePage.tsx`, `frontend/src/services/deepTutorScheduler.ts`, `docs/frontend.md`, this record.
- Protected paths: none touched. No storage key, schedule, or event schema changed; no backend, gateway, agent, desktop, or CI changes.
- Dependencies: `reviewQueue.readReviewEvents`, the existing `LocalReviewEvent` shape, the existing page state.

## Design notes (design → code)

1. **State follows storage, not intent.** `rateReviewEntry` ignores a rating for a mastered or already-rescheduled note and rolls the event back when the schedule write fails, so the page re-reads `readReviewEvents()` after every rating instead of appending optimistically.
2. **Resolve titles through the review entry first.** An event stores the local practice record id; the record may be evicted while the note survives. The row therefore tries the review entry title, then the practice record title, then labels the row `原练习记录已过期`.
3. **Display cap, not storage cap.** The scheduler keeps every event for replay; only the table slices to the newest 20 and the summary keeps the true total.
4. **One label set.** `REVIEW_RATING_OPTIONS` now lives beside `ReviewRating` in `deepTutorScheduler.ts`; the progress page and learning-space block both map it, so the labels cannot drift.
5. **Collapsed by default.** The section is a `<details>` after the saved notes; its summary always shows the count, and the table is not another always-expanded block in an already long page.

## Trace table (code → design)

| Entity | Implementation | Verification |
|--------|----------------|--------------|
| `MOD-PROGRESS` | `ProgressPage.tsx` (`reviewEvents` state, `rateReview`, `ReviewEventHistory`, `formatReviewGap`) | `ProgressPage.test.tsx` |
| `MOD-REVIEW` | `deepTutorScheduler.ts` (`REVIEW_RATING_OPTIONS`), `LearningSpacePage.tsx` | `LearningSpaceTaskBoard.test.tsx`, `ProgressPage.test.tsx` |
| `MOD-DOCS` | `docs/frontend.md` §本地复习调度 | EVIDENCE-108 |

## Verification

Environment for all blocks: Linux 7.0.0-43-generic x64; Node v24.13.0; npm 11.17.0; Vitest 1.6.1 / jsdom; cwd `frontend/` unless stated. Input manifest: the six changed inputs below; aggregate digest `4a373f45e961d08886b498638e56ba283f366a2b1daebb7a4341fcb60ac9a371` over sorted `sha256<two spaces>path` lines. This record is excluded from its own manifest.

```text
EVIDENCE-105  frontend typecheck
task: TASK-2026-11-25-review-event-history
target_entities: MOD-PROGRESS, MOD-REVIEW
checker: tsc (typescript from frontend devDependencies)
command: npx tsc --noEmit
cwd: frontend/
started_at / finished_at: 2026-11-25T13:05:47Z / 2026-11-25T13:05:49Z
environment: Linux x64; node 24.13.0; npm 11.17.0
exit_code: 0 (expected 0)
result: passed
summary: no diagnostics
input_manifest: docs/frontend.md 216608b0…, LearningSpacePage.tsx 0bd7e309…, LearningSpaceTaskBoard.test.tsx 6319a3d0…, ProgressPage.test.tsx 4702beae…, ProgressPage.tsx e92ae30f…, deepTutorScheduler.ts f4c75068…; aggregate 4a373f45…
artifacts: none
validity: valid
```

```text
EVIDENCE-106  frontend lint
task: TASK-2026-11-25-review-event-history
target_entities: MOD-PROGRESS, MOD-REVIEW
checker: eslint
command: npm run lint
cwd: frontend/
started_at / finished_at: 2026-11-25T13:05:49Z / 2026-11-25T13:05:50Z
environment: Linux x64; node 24.13.0; npm 11.17.0
exit_code: 0 (expected 0)
result: passed
summary: no findings
input_manifest: as EVIDENCE-105; aggregate 4a373f45…
artifacts: /tmp/review-history-lint.out (sha256 b9dc24903293165476b9aec70ed49cceb5a1b14257f07ad260b7948d5025a6e6, ephemeral)
validity: valid
```

```text
EVIDENCE-107  frontend full suite
task: TASK-2026-11-25-review-event-history
target_entities: MOD-PROGRESS, MOD-REVIEW
checker: vitest
command: npx vitest run
cwd: frontend/
started_at / finished_at: 2026-11-25T13:05:50Z / 2026-11-25T13:05:54Z
environment: Linux x64; node 24.13.0; vitest 1.6.1; jsdom
exit_code: 0 (expected 0)
result: passed
summary: 42 files, 260 tests passed (258 before; two new tests: progress history and learning-space rating)
input_manifest: as EVIDENCE-105; aggregate 4a373f45…
artifacts: /tmp/review-history-vitest.out (sha256 9132373db84fc2a9ac249aeb0fc7d1de74646659731793e4a351d248cf00930b, ephemeral)
validity: valid
```

```text
EVIDENCE-108  docs link/reference check
task: TASK-2026-11-25-review-event-history
target_entities: MOD-DOCS
checker: scripts/check-docs-links.py (python3 3.14.4)
command: python3 scripts/check-docs-links.py
cwd: repository root
started_at / finished_at: 2026-11-25T13:06:22Z / 2026-11-25T13:06:22Z
environment: Linux x64; python3 3.14.4; git worktree
exit_code: 0 (expected 0)
result: passed
summary: 13 files, 13 links, 26 id references; ok. This record is excluded from its own manifest because the block is written after the run.
input_manifest: docs/frontend.md 216608b0…; AGENTS.md, SPEC-BTAE, engineering protocol, and the prior task record are read by the script but not fingerprinted here; this record excluded
artifacts: none
validity: valid
```

## Risks / open questions

- The history only refreshes when this page rates a note; a rating in another tab or in the learning-space block does not push an update into an already-open progress page. The underlying log is correct on reload.
- A review event stores the practice record id, not the platform problem key, so an evicted record shows `原练习记录已过期` even though the note title usually survives in the review entry.
- The event log still has no storage cap; the UI cap is display-only. A long-lived workspace can eventually hit quota, which the existing rollback keeps consistent but does not prevent.
- Design status remains `draft`; no human review yet.
