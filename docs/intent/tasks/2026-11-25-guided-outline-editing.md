# TASK-2026-11-25-guided-outline-editing — edit the guided learning outline

Type: feature
Tier: T2
Tooling: repo-native (omp/commandcode, 2026-11-25)
Risk: medium
Design status: draft (approval by: unassigned — no human review yet)
Implementation: implemented
Verification: passed
Evidence: valid (EVIDENCE-117/118/119/120)

## Objective

The AI-planned outline was read-only. Let the learner rename stages, reorder them, add a stage, and remove stages without breaking the page invariants or losing the current stage, then persist the edited outline through the existing guided-session snapshot.

## Acceptance conditions

- AC-1: the pencil beside 学习路径 opens an edit mode listing every stage with a name input, type label, up/down, delete, add, save, and cancel — verified by `GuidedLearningPage.test.tsx` and an observed browser run.
- AC-2: saving rejects empty or duplicate names, more than 8 stages, fewer than 2 stages, a missing code stage, and a final stage that is not review; the error is shown and the editor stays open — verified by `guidedPlan.test.ts` and `GuidedLearningPage.test.tsx`.
- AC-3: reordering and adding stages keep the current stage (matched by id); the current stage's delete control is disabled — verified by `GuidedLearningPage.test.tsx`.
- AC-4: a saved edit sets `planSource` to `edited`, persists in the guided snapshot, and restores after the tab session is cleared — verified by `GuidedLearningPage.test.tsx`.
- AC-5: cancel discards the draft, including a failed validation attempt — verified by `GuidedLearningPage.test.tsx`.
- AC-6: `docs/frontend.md` and `docs/deeptutor-adaptation.md` describe the editor, its invariants, and the remaining gap — verified by EVIDENCE-120.

## Scope

- Target entities: `MOD-GUIDED-PAGE`, `MOD-GUIDED-PLAN`, `MOD-GUIDED-SESSION`, `MOD-DOCS`.
- Write scope: `frontend/src/services/guidedPlan.ts`, `frontend/src/services/guidedPlan.test.ts`, `frontend/src/services/guidedSession.ts`, `frontend/src/pages/GuidedLearningPage.tsx`, `frontend/src/pages/GuidedLearningPage.test.tsx`, `docs/frontend.md`, `docs/deeptutor-adaptation.md`, this record.
- Protected paths: none touched. No storage key rename, API, schema, backend, gateway, agent, desktop, or CI change.
- Dependencies: existing `GuidedStage`, `sanitizeGuidedStages`, guided-session snapshot, and workspace storage; no new package.

## Design notes (design → code)

1. **Edit a draft, commit on save.** `outlineDraft` is a copy; invalid input never reaches the active lesson. Cancel discards it, including after a failed save.
2. **Invariants live in `guidedPlan.ts`.** `validateGuidedOutline` checks length (2–8), non-empty unique names, exactly one review in the last position, and at least one code stage. Names double as restore markers, so duplicates are rejected rather than silently merged.
3. **Stage identity, not index.** Saving remaps the current stage by `id`, so moving or adding stages before it keeps progress. Deleting the current stage is disabled; the save path still has a clamp-and-reset fallback.
4. **Structure only.** Stage type and coach instruction are fixed; a new stage is a concept stage with the default concept instruction. Changing a type would alter question controls, answer gating, and the code pane mid-lesson, so it is a separate change.
5. **Provenance and persistence.** A saved edit sets `planSource` to `edited`; the badge shows 已编辑, and the existing snapshot carries the outline and source across sessions. `sanitizeGuidedStages` still runs on restore as the final guard.
6. **Add before review.** New stages are inserted immediately before the final review, preserving the final-review invariant by construction; the max-stage control disables at 8.

## Trace table (code → design)

| Entity | Implementation | Verification |
|--------|----------------|--------------|
| `MOD-GUIDED-PAGE` | `GuidedLearningPage.tsx` (draft state, editor UI, save/remap) | `GuidedLearningPage.test.tsx`; browser run |
| `MOD-GUIDED-PLAN` | `guidedPlan.ts` (`validateGuidedOutline`, `newGuidedStage`, labels, max) | `guidedPlan.test.ts` |
| `MOD-GUIDED-SESSION` | `guidedSession.ts` (`planSource: 'edited'`) | `GuidedLearningPage.test.tsx` |
| `MOD-DOCS` | `docs/frontend.md` §3.10, `docs/deeptutor-adaptation.md` §引导式学习 | EVIDENCE-120 |

## Verification

Environment for all blocks: Linux 7.0.0-43-generic x64; Node v24.13.0; npm 11.17.0; Vitest 1.6.1 / jsdom; cwd `frontend/` unless stated. Input manifest: the seven changed inputs below; aggregate digest `09bfbcaaa1770c765d00c3a06b44eaa820ee1bd73cf925a55d57f85f387f2c8e` over sorted `sha256<two spaces>path` lines. This record is excluded from its own manifest.

```text
EVIDENCE-117  frontend typecheck
task: TASK-2026-11-25-guided-outline-editing
target_entities: MOD-GUIDED-PAGE, MOD-GUIDED-PLAN, MOD-GUIDED-SESSION
checker: tsc (typescript from frontend devDependencies)
command: npx tsc --noEmit
cwd: frontend/
started_at / finished_at: 2026-11-25T13:36:58Z / 2026-11-25T13:37:00Z
environment: Linux x64; node 24.13.0; npm 11.17.0
exit_code: 0 (expected 0)
result: passed
summary: no diagnostics
input_manifest: docs/deeptutor-adaptation.md a69e78c8…, docs/frontend.md 04c832f0…, GuidedLearningPage.test.tsx d30f946c…, GuidedLearningPage.tsx 54195941…, guidedPlan.test.ts b71d2688…, guidedPlan.ts acfbb585…, guidedSession.ts 0993c8b1…; aggregate 09bfbcaa…
artifacts: none
validity: valid
```

```text
EVIDENCE-118  frontend lint
task: TASK-2026-11-25-guided-outline-editing
target_entities: MOD-GUIDED-PAGE, MOD-GUIDED-PLAN, MOD-GUIDED-SESSION
checker: eslint
command: npm run lint
cwd: frontend/
started_at / finished_at: 2026-11-25T13:37:00Z / 2026-11-25T13:37:01Z
environment: Linux x64; node 24.13.0; npm 11.17.0
exit_code: 0 (expected 0)
result: passed
summary: no findings
input_manifest: as EVIDENCE-117; aggregate 09bfbcaa…
artifacts: /tmp/outline-edit-lint.out (sha256 b9dc24903293165476b9aec70ed49cceb5a1b14257f07ad260b7948d5025a6e6, ephemeral)
validity: valid
```

```text
EVIDENCE-119  frontend full suite
task: TASK-2026-11-25-guided-outline-editing
target_entities: MOD-GUIDED-PAGE, MOD-GUIDED-PLAN, MOD-GUIDED-SESSION
checker: vitest
command: npx vitest run
cwd: frontend/
started_at / finished_at: 2026-11-25T13:37:01Z / 2026-11-25T13:37:05Z
environment: Linux x64; node 24.13.0; vitest 1.6.1; jsdom
exit_code: 0 (expected 0)
result: passed
summary: 43 files, 279 tests passed (276 before; three new outline tests)
input_manifest: as EVIDENCE-117; aggregate 09bfbcaa…
artifacts: /tmp/outline-edit-vitest.out (sha256 daf27c4dfb1616a9b5f541edd29f1cb20fd74b64a3cd29fc08aec4102befb7d2, ephemeral)
validity: valid
```

```text
EVIDENCE-120  docs link/reference check
task: TASK-2026-11-25-guided-outline-editing
target_entities: MOD-DOCS
checker: scripts/check-docs-links.py (python3 3.14.4)
command: python3 scripts/check-docs-links.py
cwd: repository root
started_at / finished_at: 2026-11-25T13:38:03Z / 2026-11-25T13:38:03Z
environment: Linux x64; python3 3.14.4; git worktree
exit_code: 0 (expected 0)
result: passed
summary: 16 files, 13 links, 38 id references; ok. This record is excluded from its own manifest because the block is written after the run.
input_manifest: docs/deeptutor-adaptation.md a69e78c8…, docs/frontend.md 04c832f0…; the script also reads the existing authority docs and task records; this record excluded
artifacts: none
validity: valid
```

## Findings from the browser run

- The pencil opened the editor inside the 230px outline column: inputs, type labels, move/delete controls, add/save/cancel, and the invariant hint all fit without horizontal overflow.
- Renaming the current stage, moving it down, deleting the old choice stage, adding a concept stage, and saving produced `自定义概念 / 问答题 / 编程题 / 新阶段 / 复盘`, kept the current marker on `自定义概念`, and set `planSource` to `edited`.
- An empty name stayed in edit mode and showed `阶段名称不能为空。`; cancel restored the saved outline.
- The 已编辑 badge and pencil reappeared after saving, and the saved outline survived a reload without sessionStorage.

## Risks / open questions

- Stage type and coach instruction are not editable; a new stage is always a concept stage with the default instruction.
- The outline's done checkmarks are index-based (`index < stage`). Structural edits during an active lesson can make a stage that was never entered appear done, or move a completed stage after the current one. The current stage itself is preserved by id.
- Deleting a non-current stage removes it from the outline but leaves its messages in the transcript; re-adding a similarly named stage does not recreate its question state.
- Editing is blocked while a request is live at entry, but a stream started after entering edit mode can still change stage state before save; save remaps by id but the draft may be stale.
- Design status remains `draft`; no human review yet.
