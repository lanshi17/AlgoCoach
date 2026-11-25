# TASK-2026-11-25-guided-workspace-layout — resizable workspace panels and AI-planned guided lessons

Type: feature (includes a bugfix)
Tier: T2
Tooling: repo-native (omp/commandcode, 2026-11-25)
Risk: medium
Design status: draft (approval by: unassigned — no human review yet)
Implementation: implemented
Verification: passed
Evidence: valid (code commit `2de217e`, manifest digest `c16d82fa…`)

## Objective

Make the three-panel workspace resizable and detachable with persisted layout, and turn `/home` into an agent-planned guided lesson with a dedicated programming stage, while keeping `FOCUS` free of AI surfaces and locally editable.

## Acceptance conditions

- AC-1: `/workspace` exposes four presets, a saved custom preset, per-panel dividers, reset, and dock/float toggles at `>=1280px` — verified by `AppShell.test.tsx`.
- AC-2: layout persists per workspace, syncs across tabs, and falls back safely on malformed data — verified by `layoutStorage.test.ts` and `AppShell.test.tsx` cross-tab test.
- AC-3: docking/floating never remounts panel content and floats stay in the viewport — verified by `AppShell.test.tsx` identity/render-count/clamp assertions.
- AC-4: `/home` plans an outline with the agent, normalizes it defensively, guarantees one final review and at least one code stage, and falls back to defaults — verified by `guidedPlan.test.ts` and `GuidedLearningPage.test.tsx`.
- AC-5: the programming stage opens a dedicated code area with per-language templates, reset confirmation, template-only submit guard, and agent assessment — verified by `guidedCodeTemplates.test.ts`, `GuidedCodeEditor.test.tsx`, `GuidedLearningPage.test.tsx`.
- AC-6: the guided outline/code columns collapse, resize, and detach; that layout persists and clamps — verified by `GuidedLearningPage.test.tsx`.
- AC-7: `FOCUS` hides the coach docked, detached, in the narrow tab, and in the wide toolbar, and restores the float afterwards — verified by two `AppShell.test.tsx` FOCUS tests.
- AC-8: `FOCUS` keeps local code editable while disabling assessment submission — verified by `GuidedCodeEditor.test.tsx` and `GuidedLearningPage.test.tsx`.
- AC-9: guided agent failures expose a repair link to settings — verified by `GuidedLearningChoiceGrading.test.tsx` and `agentService.test.ts`.

## Scope

- Target entities: `MOD-LAYOUT`, `MOD-GUIDED-PAGE`, `MOD-GUIDED-PLAN`, `MOD-GUIDED-CODE`, `MOD-WORKSPACE-STYLE`, `MOD-DOCS`.
- Write scope: the files below plus their tests; no backend, gateway, agent, desktop, or CI changes.
- Protected paths: `.gitignore` (one line, `!AGENTS.md`) to keep the authority file versioned; `data/**`, secrets, and build output untouched.
- Dependencies: `useAppStore` (`mode`, `theme`), `agentService.chatStream`, `workspaceStorageKey`, Monaco wrapper.

## Requirements

| ID | Requirement |
|----|-------------|
| REQ-LAYOUT-1 | Workspace presets, dividers, reset, dock/float. |
| REQ-LAYOUT-2 | Per-workspace persistence, cross-tab sync, safe fallback. |
| REQ-LAYOUT-3 | No panel remount on dock/float; floats clamped. |
| REQ-GUIDED-1 | Agent-planned outline with defensive parsing. |
| REQ-GUIDED-2 | Dedicated code stage with templates and assessment. |
| REQ-GUIDED-3 | Guided layout collapse/resize/detach with persistence. |
| REQ-FOCUS-1 | Coach hidden in every form during FOCUS. |
| REQ-FOCUS-2 | Local code editable in FOCUS; assessment blocked. |
| REQ-ERR-1 | Repair action for agent failures. |

## Design notes (design → code)

1. **No portal for floats.** Floating panels stay in the workspace DOM as `position: fixed` wrappers (z-index 91/92), keeping content mounted; floats may cover the header, accepted for a local tool.
2. **Hide, do not dock, in FOCUS.** Force-docking would discard the float rect. `isFloating()` returns false for `chat` under FOCUS; the wrapper gets a bare `hidden` (no `xl:flex`), and `ChatPanel` stays mounted.
3. **Versioned storage envelope.** `packLayout` writes `{version, layout}` (version 3); `unpackLayout` still accepts legacy direct objects; readers re-validate every number and mode.
4. **Two-step planning.** Outline generation and stage entry are separate agent turns; parse failure falls back to `DEFAULT_GUIDED_STAGES` labeled 「默认路径」.
5. **Template identity, not diffing.** Submit is blocked while `isGuidedCodeTemplate(code)` is true, so an untouched scaffold cannot be assessed.
6. **FOCUS and local code.** `GuidedCodeEditor.focusQuiet` keeps editing, language switching, and reset enabled (matching `EditorPanel`) and disables only assessment submit.

## Trace table (code → design)

| Entity | Implementation | Verification |
|--------|----------------|--------------|
| `MOD-LAYOUT` | `AppShell.tsx` presets/resizers/floats; `ColumnResizer.tsx`; `FloatingPanelChrome.tsx`; `FloatingPanelResizeHandle.tsx`; `floatingPanel.ts`; `layoutStorage.ts`; `useLayoutStorageSync.ts` | `AppShell.test.tsx`, `layoutStorage.test.ts` |
| `MOD-GUIDED-PAGE` | `GuidedLearningPage.tsx` (planning, code stage, guided layout, error action) | `GuidedLearningPage.test.tsx`, `GuidedLearningChoiceGrading.test.tsx` |
| `MOD-GUIDED-PLAN` | `guidedPlan.ts` | `guidedPlan.test.ts` |
| `MOD-GUIDED-CODE` | `GuidedCodeEditor.tsx`, `guidedCodeTemplates.ts` | `GuidedCodeEditor.test.tsx`, `guidedCodeTemplates.test.ts` |
| `MOD-WORKSPACE-STYLE` | `index.css` (`.column-resizer`, `.floating-resize-handle`, `.guided-workspace`) | Visual contract; browser geometry `unverified` |
| `MOD-DOCS` | `docs/frontend.md` §2/3.1/3.10/3.11/4.3/6.2, `Layout/README.md` | Docs link check |

## Reproduction / baseline (adoption)

The worktree arrived with 15 uncommitted files (6 modified, 9 untracked) from a previous session. Baseline before edits:

- EVIDENCE-000: `npx vitest run src/components/Layout src/services/guidedPlan.test.ts src/services/guidedCodeTemplates.test.ts` in `frontend/`, 2026-11-25T03:24:48Z, exit 0, 7 files / 36 tests passed.
- Inspection found the FOCUS regression (docked coach visible at `>=1280px` because `xl:flex` sat outside the FOCUS conditional; detached coach ignored FOCUS entirely) and the guided editor locking all editing in FOCUS.

## Verification

Environment for all blocks: Linux 7.0.0-43-generic x64; Node v24.13.0; npm 11.17.0; Vitest 1.6.1 / jsdom; cwd `frontend/`; provenance commit `2de217e` (worktree at run time matched this commit). Input manifest: 20 `frontend/**` files changed in `2de217e`; aggregate digest over sorted `path+sha256` lines = `c16d82fac85c78fb4bca71121bad1e00caeaa9f98266e8c325781de3027e619b`. Docs are not code inputs and do not invalidate these blocks.

```text
EVIDENCE-000  baseline suite
task: TASK-2026-11-25-guided-workspace-layout
command: npx vitest run src/components/Layout src/services/guidedPlan.test.ts src/services/guidedCodeTemplates.test.ts
cwd: frontend/
started_at / finished_at: 2026-11-25T03:24:48Z / 2026-11-25T03:24:49Z
environment: Linux x64; node 24.13.0; vitest 1.6.1; jsdom
exit_code: 0
result: passed
summary: 7 files, 36 tests passed
fingerprint: unknown (pre-edit worktree; inputs not captured)
artifacts: none
validity: unknown (historical context only; not a gate)
```

```text
EVIDENCE-001  frontend typecheck
task: TASK-2026-11-25-guided-workspace-layout
checker: tsc (typescript from frontend devDependencies)
command: npx tsc --noEmit
cwd: frontend/
started_at / finished_at: 2026-11-25T03:31:54Z / 2026-11-25T03:32:01Z
environment: Linux x64; node 24.13.0; npm 11.17.0
exit_code: 0
result: passed
summary: no diagnostics
fingerprint: c16d82fa… (20 frontend files)
artifacts: none
validity: valid
```

```text
EVIDENCE-002  frontend lint
task: TASK-2026-11-25-guided-workspace-layout
checker: eslint
command: npm run lint
cwd: frontend/
started_at / finished_at: 2026-11-25T03:31:54Z / 2026-11-25T03:32:01Z
environment: Linux x64; node 24.13.0; npm 11.17.0
exit_code: 0
result: passed
summary: no findings
fingerprint: c16d82fa…
artifacts: /tmp/lint.out (sha256 b9dc24903293165476b9aec70ed49cceb5a1b14257f07ad260b7948d5025a6e6)
validity: valid
```

```text
EVIDENCE-003  frontend full suite
task: TASK-2026-11-25-guided-workspace-layout
checker: vitest
command: npx vitest run
cwd: frontend/
started_at / finished_at: 2026-11-25T03:31:57Z / 2026-11-25T03:32:01Z
environment: Linux x64; node 24.13.0; vitest 1.6.1; jsdom
exit_code: 0
result: passed
summary: 42 files, 258 tests passed
fingerprint: c16d82fa…
artifacts: /tmp/vitest.out (sha256 21750b7f114049fcbc867acec84adaab0f925b6d94ac71b9bd22b395598fd737)
validity: valid
```

```text
EVIDENCE-004  FOCUS regression suite (post-fix)
task: TASK-2026-11-25-guided-workspace-layout
checker: vitest
command: npx vitest run src/components/Layout/AppShell.test.tsx src/components/Editor/GuidedCodeEditor.test.tsx
cwd: frontend/
started_at / finished_at: 2026-11-25T03:28:23Z / 2026-11-25T03:28:24Z
environment: Linux x64; node 24.13.0; vitest 1.6.1; jsdom
exit_code: 0
result: passed
summary: 15 tests passed
fingerprint: c16d82fa…
artifacts: none
validity: valid
```

```text
EVIDENCE-005  guided page FOCUS wiring
task: TASK-2026-11-25-guided-workspace-layout
checker: vitest
command: npx vitest run src/pages/GuidedLearningPage.test.tsx
cwd: frontend/
started_at / finished_at: 2026-11-25T03:31:49Z / 2026-11-25T03:31:50Z
environment: Linux x64; node 24.13.0; vitest 1.6.1; jsdom
exit_code: 0
result: passed
summary: 9 tests passed, including the page-level FOCUS check
fingerprint: c16d82fa…
artifacts: none
validity: valid
```

## Findings from adoption

- **FOCUS regression (fixed).** `xl:flex` sat outside the tab-switch conditional, so the docked coach was visible at `>=1280px` during FOCUS, and a detached coach ignored FOCUS. Fixed in `isFloating`/`panelClass`; the wide toolbar drops the coach detach control. Two `AppShell` tests cover both forms.
- **FOCUS inconsistency (fixed).** `GuidedCodeEditor` disabled the whole editor in FOCUS, contradicting `EditorPanel`'s rule. Added `focusQuiet`: editing stays on, assessment submit is off.
- **Docs drift (fixed).** `docs/frontend.md` described fixed 420/360 columns and had no guided-learning/code sections; `Layout/README.md` did not state the FOCUS rule.

## Risks / open questions

- Pointer drag, resize, and float geometry are exercised only through synthetic events in jsdom; real geometry and overflow stay `unverified`.
- LocalStorage quota failures keep the session usable but stop persisting; no test covers quota exhaustion.
- Cross-tab layout writes are last-writer-wins with a 120ms debounce; simultaneous drags are not merged.
- `unpackLayout` ignores the `version` value and relies on per-field validation; a schema change needs explicit migration.
- Design status remains `draft`; a human owner has not reviewed this record.
