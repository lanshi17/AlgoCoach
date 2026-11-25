# TASK-2026-11-25-task-board-reorder-notes — drag reordering and card notes

Type: feature
Tier: T2
Tooling: repo-native (omp/commandcode, 2026-11-25)
Risk: medium
Design status: draft (approval by: unassigned — no human review yet)
Implementation: implemented
Verification: passed
Evidence: valid (EVIDENCE-109/110/111/112)

## Objective

Close the two documented Task Board gaps: let a learner order tasks explicitly instead of inheriting due-date order, and keep a short note on each card. Order and notes stay local per workspace, and both survive reloads and archiving.

## Acceptance conditions

- AC-1: dragging a task's handle onto another task moves it to that slot, persisting across reloads; dragging downward lands after the target, upward lands before it — verified by `learningTasks.test.ts` and `LearningSpaceTaskBoard.test.tsx`.
- AC-2: a focused drag handle moves the task with ArrowUp/ArrowDown — verified by `LearningSpaceTaskBoard.test.tsx` and an observed browser run.
- AC-3: the board renders every active task in stored order, not the first four sorted by due date — verified by `LearningSpaceTaskBoard.test.tsx`.
- AC-4: a card note can be added, edited, and cleared; it is trimmed, capped at 500 characters, shown under the title, and persisted — verified by `learningTasks.test.ts` and `LearningSpaceTaskBoard.test.tsx`.
- AC-5: archiving and restoring a task keeps its note — verified by `learningTasks.test.ts`.
- AC-6: the task-board paragraphs in `docs/frontend.md`, `docs/deeptutor-adaptation.md`, and `README.md` describe the behaviour — verified by inspection and EVIDENCE-112.

## Scope

- Target entities: `MOD-LEARNING-TASKS`, `MOD-LEARNING-SPACE`, `MOD-DOCS`.
- Write scope: `frontend/src/services/learningTasks.ts`, `frontend/src/services/learningTasks.test.ts`, `frontend/src/pages/LearningSpacePage.tsx`, `frontend/src/pages/LearningSpaceTaskBoard.test.tsx`, `docs/frontend.md`, `docs/deeptutor-adaptation.md`, `README.md`, this record.
- Protected paths: none touched. No storage key, API, schema, backend, gateway, agent, desktop, or CI change.
- Dependencies: existing `LearningTask` persistence and workspace key; React 18 event system; no new package.

## Design notes (design → code)

1. **Stored array order is the board order.** No rank column and no migration: `reorderLearningTask` splices the task to the target slot. Dropping downward inserts after the target, upward inserts before it, so a two-row move round-trips.
2. **Handle-only native drag.** `draggable` sits on the grip, not the row, so status buttons, links, and the note textarea keep their normal clicks. A ref carries the dragged id across `dragstart`/`drop` because the browser exposes no shared payload; state only drives the drop highlight.
3. **Keyboard fallback.** The grip is focusable (`role="button"`) and ArrowUp/ArrowDown move the task one slot, using the same reorder path as drag. This keeps ordering available without a pointer.
4. **All active tasks, one scroller.** The list now shows every non-archived task in a `max-h-80` scroller rather than four due-date-sorted rows, because hidden rows cannot be drag targets.
5. **Notes are optional fields.** `note` is trimmed and capped at `MAX_LEARNING_TASK_NOTE_LENGTH` (500) on write, removed when empty, and dropped on read if not a string. The row keeps edit state locally; the parent persists through `setLearningTaskNote`.
6. **No note in the archive path.** Archiving only flips `archived`, so restored cards keep their note unchanged.

## Trace table (code → design)

| Entity | Implementation | Verification |
|--------|----------------|--------------|
| `MOD-LEARNING-TASKS` | `learningTasks.ts` (`note`, `reorderLearningTask`, `setLearningTaskNote`, normalize) | `learningTasks.test.ts` |
| `MOD-LEARNING-SPACE` | `LearningSpacePage.tsx` (drag state, `moveTaskByKeyboard`, `TaskRow`, note editor) | `LearningSpaceTaskBoard.test.tsx`; browser run |
| `MOD-DOCS` | `docs/frontend.md` §本地复习调度, `docs/deeptutor-adaptation.md`, `README.md` | EVIDENCE-112 |

## Verification

Environment for all blocks: Linux 7.0.0-43-generic x64; Node v24.13.0; npm 11.17.0; Vitest 1.6.1 / jsdom; cwd `frontend/` unless stated. Input manifest: the seven changed inputs below; aggregate digest `4064213bb192582d4add3c38c410778653c528b1d558cba39b929aa0057ae51a` over sorted `sha256<two spaces>path` lines. This record is excluded from its own manifest.

```text
EVIDENCE-109  frontend typecheck
task: TASK-2026-11-25-task-board-reorder-notes
target_entities: MOD-LEARNING-TASKS, MOD-LEARNING-SPACE
checker: tsc (typescript from frontend devDependencies)
command: npx tsc --noEmit
cwd: frontend/
started_at / finished_at: 2026-11-25T13:17:53Z / 2026-11-25T13:17:56Z
environment: Linux x64; node 24.13.0; npm 11.17.0
exit_code: 0 (expected 0)
result: passed
summary: no diagnostics
input_manifest: README.md b43b81b1…, docs/deeptutor-adaptation.md 6fafc730…, docs/frontend.md 81515f69…, LearningSpacePage.tsx 6e0034c7…, LearningSpaceTaskBoard.test.tsx 74b4e8fe…, learningTasks.test.ts 7eca19c1…, learningTasks.ts 5bdcda86…; aggregate 4064213b…
artifacts: none
validity: valid
```

```text
EVIDENCE-110  frontend lint
task: TASK-2026-11-25-task-board-reorder-notes
target_entities: MOD-LEARNING-TASKS, MOD-LEARNING-SPACE
checker: eslint
command: npm run lint
cwd: frontend/
started_at / finished_at: 2026-11-25T13:17:56Z / 2026-11-25T13:17:57Z
environment: Linux x64; node 24.13.0; npm 11.17.0
exit_code: 0 (expected 0)
result: passed
summary: no findings
input_manifest: as EVIDENCE-109; aggregate 4064213b…
artifacts: /tmp/task-board-lint.out (sha256 b9dc24903293165476b9aec70ed49cceb5a1b14257f07ad260b7948d5025a6e6, ephemeral)
validity: valid
```

```text
EVIDENCE-111  frontend full suite
task: TASK-2026-11-25-task-board-reorder-notes
target_entities: MOD-LEARNING-TASKS, MOD-LEARNING-SPACE
checker: vitest
command: npx vitest run
cwd: frontend/
started_at / finished_at: 2026-11-25T13:17:57Z / 2026-11-25T13:18:00Z
environment: Linux x64; node 24.13.0; vitest 1.6.1; jsdom
exit_code: 0 (expected 0)
result: passed
summary: 42 files, 269 tests passed (260 before; nine new board tests)
input_manifest: as EVIDENCE-109; aggregate 4064213b…
artifacts: /tmp/task-board-vitest.out (sha256 572bb13ba357eac0432160abc3e4fbbb4c0229eeaf0fc9cc1808299c8f96ce28, ephemeral)
validity: valid
```

```text
EVIDENCE-112  docs link/reference check
task: TASK-2026-11-25-task-board-reorder-notes
target_entities: MOD-DOCS
checker: scripts/check-docs-links.py (python3 3.14.4)
command: python3 scripts/check-docs-links.py
cwd: repository root
started_at / finished_at: 2026-11-25T13:19:03Z / 2026-11-25T13:19:03Z
environment: Linux x64; python3 3.14.4; git worktree
exit_code: 0 (expected 0)
result: passed
summary: 14 files, 13 links, 30 id references; ok. This record is excluded from its own manifest because the block is written after the run.
input_manifest: README.md b43b81b1…, docs/deeptutor-adaptation.md 6fafc730…, docs/frontend.md 81515f69…; the script also reads the existing authority docs and task records; this record excluded
artifacts: none
validity: valid
```

## Findings from the browser run

- `/learning/dashboard` showed the seeded five tasks and both notes; the title, note preview, date, and note/archive controls stayed aligned.
- ArrowDown on a focused handle reordered the task and persisted the new array order.
- Synthetic `DragEvent`s with a `DataTransfer` reordered the board and persisted; Puppeteer's mouse drag did not start HTML5 drag, so pointer-drag automation remains unverified.
- The note editor opened on the card, showed a live `n/500` counter, saved the note, and rendered it under the title.

## Risks / open questions

- Touch devices have no native HTML5 drag and no keyboard; ordering is effectively pointer/keyboard only. A future touch long-press or explicit move buttons would be a separate change.
- Dropping onto a row far outside the `max-h-80` scroller depends on browser auto-scroll during drag; no automated check covers it.
- The board is one ordered list, not per-status columns, so reordering also moves done tasks relative to open ones.
- `persist` still swallows quota errors; the in-memory order/note updates even when the write fails, so a reload can lose the change.
- Design status remains `draft`; no human review yet.
