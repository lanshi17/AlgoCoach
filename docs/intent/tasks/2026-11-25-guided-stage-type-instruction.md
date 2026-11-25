# TASK-2026-11-25-guided-stage-type-instruction — edit stage types and coach instructions

Type: feature
Tier: T2
Tooling: repo-native (omp/commandcode, 2026-11-25)
Risk: medium
Design status: draft (approval by: unassigned — no human review yet)
Implementation: implemented
Verification: passed
Evidence: valid (EVIDENCE-121/122/123/124)

## Objective

Remove the remaining outline-editing limit: let the learner change a stage's type and coach instruction, validate both, reset stale question state, and make the editor usable with a full eight-stage outline.

## Acceptance conditions

- AC-1: every edit row has a type select (概念/选择/问答/编程/复盘) and an expandable coach-instruction textarea with a 600-character counter — verified by `GuidedLearningPage.test.tsx` and an observed browser run.
- AC-2: saving rejects an empty instruction and one over 600 characters; the error is shown and the editor stays open — verified by `guidedPlan.test.ts` and the browser run.
- AC-3: changing a type replaces an instruction that was not edited in this editing session with the new type's default, while a session-edited instruction is preserved — implemented in `changeOutlineStageType`; default replacement verified by `GuidedLearningPage.test.tsx`.
- AC-4: changing the current stage's type or instruction clears its answer/question and shows 「重新出题」; re-asking generates a new question from the edited instruction — verified by `GuidedLearningPage.test.tsx`.
- AC-5: re-asking the current code stage does not reset the learner's code — verified by `GuidedLearningPage.test.tsx`.
- AC-6: a long outline scrolls inside the panel while the save/cancel footer stays visible — verified by an observed browser run at eight stages with all instructions open.
- AC-7: `docs/frontend.md` and `docs/deeptutor-adaptation.md` describe type/instruction editing, validation, reset, and re-ask — verified by EVIDENCE-124.

## Scope

- Target entities: `MOD-GUIDED-PAGE`, `MOD-GUIDED-PLAN`, `MOD-GUIDED-LAYOUT`, `MOD-DOCS`.
- Write scope: `frontend/src/services/guidedPlan.ts`, `frontend/src/services/guidedPlan.test.ts`, `frontend/src/pages/GuidedLearningPage.tsx`, `frontend/src/pages/GuidedLearningPage.test.tsx`, `frontend/src/index.css`, `docs/frontend.md`, `docs/deeptutor-adaptation.md`, this record.
- Protected paths: none touched. No storage key, snapshot schema rename, API, backend, gateway, agent, desktop, or CI change.
- Dependencies: existing `GuidedStage`, `stageNeedsAnswer`, guided-session snapshot, and the guided layout CSS; no new package.

## Design notes (design → code)

1. **Type select, instruction details.** Each draft row exposes a five-type select and a `<details>` block with the coach instruction and a live count. The instruction stays collapsed by default so eight stages remain scannable in the 230px panel.
2. **Dirty tracking for instructions.** `editedInstructionIds` records instructions typed in the current editing session. A type change replaces untouched text (including AI-tailored defaults) with the new type's default; a session-edited instruction is preserved, and the learner can still adjust it after switching.
3. **Validation covers instructions.** `validateGuidedOutline` now rejects empty instructions and text over `MAX_GUIDED_INSTRUCTION_LENGTH` (600), alongside the existing stage-count, name, review-position, and code-stage checks. Save trims and caps before storing.
4. **Current-stage reset is explicit.** Changing the current stage's type or instruction clears `answered`/`questionId`/selection/feedback and surfaces 「重新出题」; the page never calls the model from save. This makes the edit effective on the next question without a hidden request.
5. **General re-ask.** The choice-only re-ask control became 「重新出题」 for any answer-bearing stage whose question is missing. `enterStage` now resets the code template only when advancing to a different code stage, so re-asking the current code stage preserves the learner's code.
6. **Bounded panel, fixed footer.** At `>=1024px` the guided grid row is `minmax(0, 1fr)`, the aside content scrolls, and the edit footer sits outside the scroller. Without this, eight stages with open instructions made the aside 1613px tall and pushed save below a non-scrolling viewport.
7. **Restore guard unchanged.** The persisted outline still passes through `sanitizeGuidedStages`, which fills defaults and caps instructions, so older snapshots remain readable.

## Trace table (code → design)

| Entity | Implementation | Verification |
|--------|----------------|--------------|
| `MOD-GUIDED-PAGE` | `GuidedLearningPage.tsx` (type select, instruction editor, dirty tracking, reset, re-ask) | `GuidedLearningPage.test.tsx`; browser run |
| `MOD-GUIDED-PLAN` | `guidedPlan.ts` (`MAX_GUIDED_INSTRUCTION_LENGTH`, `defaultGuidedInstruction`, instruction validation) | `guidedPlan.test.ts` |
| `MOD-GUIDED-LAYOUT` | `index.css` (guided row bound), aside scroller and fixed footer | Browser measurement at eight stages |
| `MOD-DOCS` | `docs/frontend.md` §3.10, `docs/deeptutor-adaptation.md` §引导式学习 | EVIDENCE-124 |

## Verification

Environment for all blocks: Linux 7.0.0-43-generic x64; Node v24.13.0; npm 11.17.0; Vitest 1.6.1 / jsdom; Chromium via the browser helper; cwd `frontend/` unless stated. Input manifest: the seven changed inputs below; aggregate digest `80ab77be7f71633fbe7861b984595240f5bd4ec092af9d7268f697b281074dc3` over sorted `sha256<two spaces>path` lines. This record is excluded from its own manifest.

```text
EVIDENCE-121  frontend typecheck
task: TASK-2026-11-25-guided-stage-type-instruction
target_entities: MOD-GUIDED-PAGE, MOD-GUIDED-PLAN, MOD-GUIDED-LAYOUT
checker: tsc (typescript from frontend devDependencies)
command: npx tsc --noEmit
cwd: frontend/
started_at / finished_at: 2026-11-25T13:46:56Z / 2026-11-25T13:46:58Z
environment: Linux x64; node 24.13.0; npm 11.17.0
exit_code: 0 (expected 0)
result: passed
summary: no diagnostics
input_manifest: docs/deeptutor-adaptation.md c8163f28…, docs/frontend.md e4f0b712…, index.css a3f69658…, GuidedLearningPage.test.tsx 71780a2c…, GuidedLearningPage.tsx efbaf73d…, guidedPlan.test.ts 88f598a2…, guidedPlan.ts 6a004ec9…; aggregate 80ab77be…
artifacts: none
validity: valid
```

```text
EVIDENCE-122  frontend lint
task: TASK-2026-11-25-guided-stage-type-instruction
target_entities: MOD-GUIDED-PAGE, MOD-GUIDED-PLAN, MOD-GUIDED-LAYOUT
checker: eslint
command: npm run lint
cwd: frontend/
started_at / finished_at: 2026-11-25T13:46:58Z / 2026-11-25T13:47:00Z
environment: Linux x64; node 24.13.0; npm 11.17.0
exit_code: 0 (expected 0)
result: passed
summary: no findings
input_manifest: as EVIDENCE-121; aggregate 80ab77be…
artifacts: /tmp/stage-type-lint.out (sha256 b9dc24903293165476b9aec70ed49cceb5a1b14257f07ad260b7948d5025a6e6, ephemeral)
validity: valid
```

```text
EVIDENCE-123  frontend full suite
task: TASK-2026-11-25-guided-stage-type-instruction
target_entities: MOD-GUIDED-PAGE, MOD-GUIDED-PLAN, MOD-GUIDED-LAYOUT
checker: vitest
command: npx vitest run
cwd: frontend/
started_at / finished_at: 2026-11-25T13:47:00Z / 2026-11-25T13:47:03Z
environment: Linux x64; node 24.13.0; vitest 1.6.1; jsdom
exit_code: 0 (expected 0)
result: passed
summary: 43 files, 280 tests passed (279 before; one new type/instruction page test)
input_manifest: as EVIDENCE-121; aggregate 80ab77be…
artifacts: /tmp/stage-type-vitest.out (sha256 41d9a94842f0e3530d46d4d8982d608749d0b4d19d804e916d7cbb3ec51740ee, ephemeral)
validity: valid
```

```text
EVIDENCE-124  docs link/reference check
task: TASK-2026-11-25-guided-stage-type-instruction
target_entities: MOD-DOCS
checker: scripts/check-docs-links.py (python3 3.14.4)
command: python3 scripts/check-docs-links.py
cwd: repository root
started_at / finished_at: 2026-11-25T13:47:31Z / 2026-11-25T13:47:31Z
environment: Linux x64; python3 3.14.4; git worktree
exit_code: 0 (expected 0)
result: passed
summary: 17 files, 13 links, 42 id references; ok. This record is excluded from its own manifest because the block is written after the run.
input_manifest: docs/deeptutor-adaptation.md c8163f28…, docs/frontend.md e4f0b712…; the script also reads the existing authority docs and task records; this record excluded
artifacts: none
validity: valid
```

## Findings from the browser run

- Eight stages with every instruction expanded produced a 1545px scroller inside a 575px content area; the footer's 保存大纲 stayed at 701–726px in a 768px viewport instead of falling below the fold.
- Changing the current stage from 概念 to 编程 and saving showed the 已编辑 badge, opened the code pane, kept the outline scroller, and surfaced 「重新出题」.
- The blank-instruction save showed `教练指令不能为空。` and stayed in edit mode; cancel discarded it.
- An early check hit a stale Vite transform that omitted the moved footer; restarting Vite with a cleared cache served the current module.

## Risks / open questions

- Editing the current concept/review instruction does not regenerate the explanation already in the transcript; the new instruction applies to the next entry or re-ask.
- Editing the current answer stage's instruction intentionally clears its pending answer; the transcript and earlier stages remain.
- A session-edited instruction survives type changes, so a learner can keep text that no longer matches the selected type.
- Changing a stage to code preserves non-template code carried from an earlier code stage; only empty or untouched template code is replaced.
- The layout change bounds the guided grid row at `>=1024px`; mobile stacking keeps the previous flow. The resizer remains outside the scrolling aside.
- Design status remains `draft`; no human review yet.
