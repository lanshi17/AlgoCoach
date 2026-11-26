# TASK-2026-11-26-deep-solve-entry — ask the coach to break down the current problem

Type: feature
Tier: T2
Tooling: repo-native (omp/commandcode, 2026-11-26)
Risk: medium
Design status: draft
Implementation: implemented
Verification: passed
Evidence: valid (EVIDENCE-156/157/158/159)

## Objective

`deep_solve` is registered in the Agent and documented, but the frontend never sends it. Add a low-friction entry from the current problem: queue the capability, prefill a problem-specific breakdown prompt, and open the coach panel so the learner can review and send it. No model call happens on the click itself.

## Acceptance conditions

- AC-1: with an active problem in PREP or IDLE, the problem panel shows a 拆解思路 action; FOCUS and REVIEW do not.
- AC-2: clicking it queues `deep_solve` for exactly the next chat turn, prefills a problem-specific prompt (model, invariant, proof idea, complexity, counterexample) when the input is empty, never overwrites an existing draft, and opens the coach panel.
- AC-3: the click performs no network or model request; the learner still presses send.
- AC-4: on the mobile workspace the event switches the active panel to AI 教练; the draft is visible in the input.
- AC-5: the docs name the entry and the stale “cross-device sync not implemented” statement is removed.
- AC-6: existing capability handoff semantics remain: FOCUS/REVIEW ignore a queued handoff.

## Scope

- Target entities: `MOD-PROBLEM-PANEL`, `MOD-WORKSPACE-LAYOUT`, `MOD-CAPABILITY-HANDOFF`, `MOD-DOCS`.
- Write scope: `frontend/src/components/Problem/ProblemPanel.tsx`, `frontend/src/components/Problem/ProblemPanel.test.tsx`, `frontend/src/components/Layout/AppShell.tsx`, `frontend/src/components/Layout/AppShell.test.tsx`, `frontend/src/services/deepTutorCapabilities.ts`, `frontend/src/services/deepTutorCapabilities.test.ts`, `docs/frontend.md`, `docs/deeptutor-adaptation.md`, this record.
- Protected paths: none.
- Dependencies: existing `queueCapabilityHandoff`/`takeTurnCapability`, Zustand `setChatDraft`, and the workspace panel state.

## Design notes (design → code)

1. **One shared event.** Add `OPEN_COACH_EVENT` and `requestOpenCoach()` beside the capability handoff helpers; the problem panel dispatches it, the workspace listens and selects the chat panel (raising a floating chat to the front).
2. **Prefill, don't send.** The action queues `deep_solve`, writes a draft keyed to the active problem through `setChatDraft` only when that draft is empty, and opens the coach. Existing text is preserved. This mirrors the knowledge-graph handoff and leaves the learner in control of the model call.
3. **Respect mode precedence.** The action is hidden in FOCUS (silent practice) and REVIEW (review capability wins). If a queued handoff exists when a review starts, existing semantics keep it for a later eligible turn.
4. **Draft is problem-specific.** The text does not include code, test results, or conversation history; it only names the title and asks for reasoning structure. Sending remains subject to the existing REVIEW/FOCUS payload rules.
5. **No new persistence.** The draft uses the existing `chatDrafts` store and workspace storage; the capability handoff remains sessionStorage and one-shot.

## Trace table (code → design)

| Entity | Implementation | Verification |
|--------|----------------|--------------|
| `MOD-CAPABILITY-HANDOFF` | `deepTutorCapabilities.ts` (`requestOpenCoach`, existing handoff) | `deepTutorCapabilities.test.ts` |
| `MOD-PROBLEM-PANEL` | `ProblemPanel.tsx` action, empty-draft guard | `ProblemPanel.test.tsx` |
| `MOD-WORKSPACE-LAYOUT` | `AppShell.tsx` event listener | `AppShell.test.tsx` |
| `MOD-DOCS` | `docs/frontend.md`, `docs/deeptutor-adaptation.md` | docs check |

## Verification

Environment: Linux 7.0.0-43-generic x64; Node v24.13.0; npm 11.17.0; Vitest 1.6.1 / jsdom; Chromium via the browser helper. Input manifest: the eight changed inputs below; aggregate digest `b90d65c24080c6abb7b815849cca7d2ddda50c8771da44b418a1e1a957a3b85c` over sorted `sha256<two spaces>path` lines. This record is excluded from its own manifest.

```text
EVIDENCE-156  frontend typecheck
task: TASK-2026-11-26-deep-solve-entry
target_entities: MOD-PROBLEM-PANEL, MOD-WORKSPACE-LAYOUT, MOD-CAPABILITY-HANDOFF
checker: tsc
command: npx tsc --noEmit
cwd: frontend/
started_at / finished_at: 2026-11-26T03:09:26Z / 2026-11-26T03:09:28Z
environment: Linux x64; node 24.13.0; npm 11.17.0
exit_code: 0 (expected 0)
result: passed
summary: no diagnostics
input_manifest: as the eight-file manifest; aggregate b90d65c2…
artifacts: none
validity: valid
```

```text
EVIDENCE-157  frontend lint
task: TASK-2026-11-26-deep-solve-entry
target_entities: MOD-PROBLEM-PANEL, MOD-WORKSPACE-LAYOUT, MOD-CAPABILITY-HANDOFF
checker: eslint
command: npm run lint
cwd: frontend/
started_at / finished_at: 2026-11-26T03:09:28Z / 2026-11-26T03:09:29Z
environment: Linux x64; node 24.13.0; npm 11.17.0
exit_code: 0 (expected 0)
result: passed
summary: no findings
input_manifest: as EVIDENCE-156; aggregate b90d65c2…
artifacts: /tmp/deep-solve-lint.out (sha256 b9dc24903293165476b9aec70ed49cceb5a1b14257f07ad260b7948d5025a6e6, ephemeral)
validity: valid
```

```text
EVIDENCE-158  frontend full suite
task: TASK-2026-11-26-deep-solve-entry
target_entities: MOD-PROBLEM-PANEL, MOD-WORKSPACE-LAYOUT, MOD-CAPABILITY-HANDOFF
checker: vitest
command: npx vitest run
cwd: frontend/
started_at / finished_at: 2026-11-26T03:09:29Z / 2026-11-26T03:09:33Z
environment: Linux x64; node 24.13.0; vitest 1.6.1; jsdom
exit_code: 0 (expected 0)
result: passed
summary: 46 files, 300 tests passed (297 before; three new: problem action and draft guard, workspace panel switch, coach-open event)
input_manifest: as EVIDENCE-156; aggregate b90d65c2…
artifacts: /tmp/deep-solve-frontend-tests.out (sha256 6d23616c5e0e98340379ac5ed37b6eb4adefa2bfb75f67777011b3a86a7767e9, ephemeral)
validity: valid
```

```text
EVIDENCE-159  docs link/reference check
task: TASK-2026-11-26-deep-solve-entry
target_entities: MOD-DOCS
checker: scripts/check-docs-links.py (python3 3.14.4)
command: python3 scripts/check-docs-links.py
cwd: repository root
started_at / finished_at: 2026-11-26T03:10:10Z / 2026-11-26T03:10:10Z
environment: Linux x64; python3 3.14.4; git worktree
exit_code: 0 (expected 0)
result: passed
summary: 26 files, 18 links, 59 id references; ok. This record is excluded from its own manifest because the block is written after the run.
input_manifest: docs/frontend.md 1d619852…, docs/deeptutor-adaptation.md 2e061f49…; the script also reads the authority docs and other task records; this record excluded
artifacts: none
validity: valid
```

## Findings from the browser run

- With a saved local problem and no gateway, `/workspace` rendered the 拆解思路 action in the problem header next to 更换题目.
- Clicking it switched the active mobile panel to AI 教练 and displayed the breakdown draft in the coach input; no request was made to the Agent.
- Typing `keep me` in the coach input and clicking 拆解思路 again preserved `keep me` exactly; the screen stayed on the coach.
- The problem list still loads only after pressing 更换题目; the earlier test was updated to target that button by text instead of relying on button order.

## Risks / open questions

- The entry only applies to the next eligible turn. FOCUS/REVIEW ignore the queued capability and keep it for a later turn, which is existing behaviour; the UI hides the button there.
- Existing drafts are never modified, so a learner with text already typed gets the coach opened but not the template. This is deliberate to avoid silent data loss.
- No model call is made by the click; the learner must press send and normal payload/privacy rules apply.
