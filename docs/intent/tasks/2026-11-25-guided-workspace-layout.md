# TASK-2026-11-25-guided-workspace-layout

| Field | Value |
|-------|-------|
| Type | Feature (with bugfix) |
| Design state | `draft` — bootstrapped by the coding agent; no human review yet |
| Implementation state | `implemented` |
| Verification result | `passed` (frontend typecheck, lint, full unit suite) |
| Evidence validity | `current` for the code fingerprint recorded below |
| Owner | unassigned |
| Created | 2026-11-25 |

## 1. Requirements

| ID | Requirement |
|----|-------------|
| REQ-LAYOUT-1 | `/workspace` exposes four layout presets, a saved custom preset, per-panel width dividers, reset, and dock/float toggles at `>=1280px`. |
| REQ-LAYOUT-2 | Layout (widths, dock/float modes, maximize, float rects, custom preset) persists per workspace and syncs across tabs; malformed or out-of-range data falls back safely. |
| REQ-LAYOUT-3 | Docking/floating must not remount panel content (Monaco, chat, problem) and floats stay inside the viewport. |
| REQ-GUIDED-1 | `/home` asks the agent to plan a stage outline, parses it defensively, guarantees a single final review and at least one programming stage, and falls back to the default path. |
| REQ-GUIDED-2 | The programming stage opens a dedicated code area with per-language templates, manual template reset, template-only submit guard, and agent assessment. |
| REQ-GUIDED-3 | The guided outline/code columns collapse, resize, and the code area detaches into a floating window; this layout also persists and clamps. |
| REQ-FOCUS-1 | `FOCUS` hides the coach in every form: docked, detached, narrow tab, and wide toolbar control. Hidden, not force-docked, so state and float position survive. |
| REQ-FOCUS-2 | `FOCUS` keeps local code editable while disabling AI assessment submission. |
| REQ-ERR-1 | Agent failures in the guided flow expose a repair action (link to settings) alongside the message. |

## 2. Affected entities

| Entity | Implementation |
|--------|----------------|
| MOD-LAYOUT | `frontend/src/components/Layout/{AppShell,ColumnResizer,FloatingPanelChrome,FloatingPanelResizeHandle,floatingPanel,layoutStorage,useLayoutStorageSync}.tsx|ts`, `Layout/README.md` |
| MOD-GUIDED-PAGE | `frontend/src/pages/GuidedLearningPage.tsx` |
| MOD-GUIDED-PLAN | `frontend/src/services/guidedPlan.ts` |
| MOD-GUIDED-CODE | `frontend/src/components/Editor/GuidedCodeEditor.tsx`, `frontend/src/services/guidedCodeTemplates.ts` |
| MOD-WORKSPACE-STYLE | `frontend/src/index.css` (`.column-resizer`, `.floating-resize-handle`, `.guided-workspace`) |
| MOD-DOCS | `docs/frontend.md`, `frontend/src/components/Layout/README.md`, `AGENTS.md`, `docs/intent/**`, `docs/architecture/engineering-protocol.md` |

Write scope: the files above plus their tests. No backend, gateway, agent, desktop, or CI changes.

Protected paths touched: `.gitignore` (one line, `!AGENTS.md`) — needed so the new authority file is versioned under the repo's `*.md` ignore rule.

## 3. Design decisions

1. **No portal for floats.** Floating panels remain in the workspace DOM as `position: fixed` wrappers (z-index 91/92). Keeps content mounted and avoids event/stacking regressions; the tradeoff is that floats can cover the header, which is accepted for this local tool.
2. **Hide, do not dock, in FOCUS.** Force-docking would discard the user's float rect and change the post-focus layout. `isFloating()` returns false for `chat` under FOCUS and the wrapper gets a bare `hidden`; `ChatPanel` stays mounted.
3. **Versioned storage envelope.** `packLayout` writes `{version, layout}` (version 3); `unpackLayout` still accepts legacy direct objects. Readers re-validate every number and mode rather than trusting stored JSON.
4. **Two-step planning.** Outline generation and stage entry are separate agent turns so a failed outline does not emit a half-started lesson; parse failure falls back to `DEFAULT_GUIDED_STAGES` and is labeled 「默认路径」.
5. **Template identity, not diffing.** A stage opens with `GUIDED_CODE_TEMPLATES[lang]`; submit is blocked while `isGuidedCodeTemplate(code)` is true, so an untouched scaffold cannot be assessed as an answer.
6. **FOCUS and local code.** `GuidedCodeEditor` gained `focusQuiet`: editing, language switching, and template reset stay enabled (matching `EditorPanel`), while the assessment submit is disabled and the status bar says 「专注模式 · 教练静默」.

## 4. Traceability

| Requirement | Implementation | Behavior evidence | Status |
|-------------|----------------|-------------------|--------|
| REQ-LAYOUT-1 | `AppShell.tsx` `WORKSPACE_PRESETS`, `applyPreset`, `ColumnResizer` | `AppShell.test.tsx` › resizes the wide workspace and detaches a panel into a floating window | `verified` |
| REQ-LAYOUT-2 | `layoutStorage.ts`, `useLayoutStorageSync.ts`, `readWorkspaceLayout` | `layoutStorage.test.ts` (round-trip, legacy, malformed); `AppShell.test.tsx` › applies a layout written by another tab | `verified` |
| REQ-LAYOUT-3 | `AppShell.tsx` memoized panels + stable wrappers, `clampFloatRect` | `AppShell.test.tsx` › panel content identity / render count / viewport clamp assertions | `verified` |
| REQ-GUIDED-1 | `guidedPlan.ts`, `planOutline` in `GuidedLearningPage.tsx` | `guidedPlan.test.ts` (fenced JSON, Chinese types, forced code/review); `GuidedLearningPage.test.tsx` › agent-planned outline | `verified` |
| REQ-GUIDED-2 | `GuidedCodeEditor.tsx`, `guidedCodeTemplates.ts`, `submitCode` | `guidedCodeTemplates.test.ts`; `GuidedLearningPage.test.tsx` › dedicated code area + template/language swap; `GuidedCodeEditor.test.tsx` › template guard | `verified` |
| REQ-GUIDED-3 | `GuidedLearningPage.tsx` guided layout + `ColumnResizer`/float primitives | `GuidedLearningPage.test.tsx` › columns collapse/expand/resize | `verified` |
| REQ-FOCUS-1 | `AppShell.tsx` `chatSuppressed`, `isFloating`, `panelClass`, toolbar filter | `AppShell.test.tsx` › focus hides coach tab/panel; › detached coach hidden and restored | `verified` |
| REQ-FOCUS-2 | `focusQuiet` in `GuidedCodeEditor.tsx`, `GuidedLearningPage.tsx` | `GuidedCodeEditor.test.tsx` › keeps code editable in focus while disabling assessment; `GuidedLearningPage.test.tsx` › keeps guided code editable in focus while blocking the coach assessment | `verified` |
| REQ-ERR-1 | `getAgentErrorAction` wiring in `GuidedLearningPage.tsx` | `GuidedLearningChoiceGrading.test.tsx`, `agentService.test.ts` | `verified` |
| REQ-LAYOUT-1..3 (real browser) | — | Pointer-drag geometry, overflow at every viewport, localStorage quota, simultaneous two-tab drag | `unverified` |

## 5. Verification evidence

Environment: Linux x64, Node v24.13.0, npm 11.17.0, Vitest 1.6.1 / jsdom. Working directory `frontend/` unless noted.

| # | Command | Time (UTC) | Result |
|---|---------|-----------|--------|
| 1 | `npx tsc --noEmit` | 2026-11-25T03:31:54Z → 03:32:01Z | exit 0, no diagnostics |
| 2 | `npm run lint` (`eslint src --ext ts,tsx`) | same run | exit 0, no findings |
| 3 | `npx vitest run` | 2026-11-25T03:31:54Z → 03:32:01Z | 42 files, 258 tests, all passed |
| 4 | `npx vitest run src/components/Layout/AppShell.test.tsx src/components/Editor/GuidedCodeEditor.test.tsx` | 2026-11-25T03:28:23Z | 15 tests passed after the FOCUS fix |
| 5 | `npx vitest run src/pages/GuidedLearningPage.test.tsx` | 2026-11-25T03:31:49Z | 9 tests passed, including the page-level FOCUS check |

Fingerprints (computed 2026-11-25T03:32Z, repository root):

- Tracked diff: `git diff | sha256sum` = `e70992ffdc67f07336e6f42521e6f4316ec98f5a0abb9aff5116a008aec6bb60`
- Untracked frontend code/tests: `git ls-files --others --exclude-standard -z -- frontend | xargs -0 sha256sum | sort | sha256sum` = `8a649f7509883fe9752cdd94c5bf21e0a6c8d67bcd69ecb55b8682468d84ccd0`
- Intent docs (`AGENTS.md`, `docs/architecture/engineering-protocol.md`, `docs/intent/**`) are excluded from the code fingerprint; this record is part of that set, so its own hash is omitted to avoid self-reference.

Full command output was captured to `/tmp/lint.out` and `/tmp/vitest.out` during the run; the summaries above are the observed tail.

## 6. Findings and fixes from this session

- **FOCUS regression (fixed).** The pending layout rewrite moved `xl:flex` out of the tab-switch conditional, so the docked coach became visible at `>=1280px` during FOCUS, and a detached coach ignored FOCUS entirely. Fixed in `isFloating`/`panelClass`; the wide toolbar now drops the coach detach control. Covered by two `AppShell` tests.
- **FOCUS inconsistency (fixed).** `GuidedCodeEditor` disabled the whole editor in FOCUS, contradicting `EditorPanel`'s documented rule that local editing remains available. Added `focusQuiet`; editing stays on, assessment submit is off. Covered by a new test file.
- **Docs drift (fixed).** `docs/frontend.md` still described fixed 420/360 columns and had no guided-learning/code sections; `Layout/README.md` did not state the FOCUS rule. Both updated.

## 7. Risks and unknowns

- Pointer drag, resize, and float behavior are exercised only through synthetic pointer/keyboard events in jsdom; real geometry and overflow are `unverified`.
- LocalStorage quota failures keep the current session usable (`try/catch`) but silently stop persisting; no test covers quota exhaustion.
- Cross-tab layout writes are last-writer-wins with a 120ms debounce; simultaneous drags in two tabs are not merged.
- `unpackLayout` ignores the `version` value and relies on per-field validation; a future schema change must add explicit migration.
- The BTAE MCP server is not installed in this repository. `btae_project_context`, `btae_design_plan`, and `btae_validate_project` were unavailable, so this record and the checks above are the substitute evidence trail.
- Design state remains `draft`; a human owner has not reviewed this record.
