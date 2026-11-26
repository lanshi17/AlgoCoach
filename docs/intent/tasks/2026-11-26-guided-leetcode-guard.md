# TASK-2026-11-26-guided-leetcode-guard — clean-code guard pass on the LeetCode panel

Type: refactor
Tier: T2
Tooling: repo-native (omp/commandcode, 2026-11-26)
Risk: low
Design status: draft
Implementation: implemented
Verification: passed
Evidence: valid (EVIDENCE-180/181/182/183)

## Objective

Apply the clean-code guard to the shipped guided LeetCode panel: reduce the 284-line component that mixed list I/O, selection, language/snippet synchronization, run/submit state, and rendering; remove a speculative list cap; and keep observable behavior identical.

## Acceptance conditions

- AC-1: no observable behavior change; all existing panel/page tests still pass.
- AC-2: problem-list state moves to `useGuidedProblemList`, selection/snippet state to `useGuidedProblemBinding`, and run/submit state to `useLeetCodeAttempt`.
- AC-3: topic/snippet/run-result helpers live in `services/guidedLeetCode.ts`; no duplicate `snippetFor`/`runSummary` definitions remain.
- AC-4: the unused `MAX_VISIBLE_PROBLEMS = 80` cap is removed; the panel uses the service's returned list directly (currently one 50-item page).
- AC-5: the unused `disabled` prop on `AttemptActions` and unused type imports are removed.
- AC-6: the main component is composed of small presentational functions (`PanelHeader`, `ProblemPicker`, `AttemptActions`) and has no I/O or request logic.

## Scope

- Target entities: `MOD-GUIDED-LEETCODE`, `MOD-GUIDED-LEETCODE-HELPERS`, `MOD-GUIDED-LEETCODE-HOOKS`.
- Write scope: `frontend/src/components/Editor/GuidedLeetCodePanel.tsx`, `frontend/src/hooks/useGuidedLeetCode.ts`, `frontend/src/services/guidedLeetCode.ts`, this record.
- Protected paths: none.
- Dependencies: existing `GuidedLearningPage` integration and panel tests.

## Design notes (design → code)

1. **Hooks own stateful workflows.** List loading/filtering, problem binding/snippet sync, and run/submit each live in a named hook; the component composes them.
2. **Helpers own pure rules.** Topic-slug matching, language snippet lookup, and run-result text are pure functions in `services/guidedLeetCode.ts`.
3. **Presentational split.** Header, picker, and attempt actions are separate functions with typed prop objects; the default export only composes and wires callbacks.
4. **Same behavior.** Aria labels, text, confirm flow, AC callback, and disabled rules are unchanged; only structure was reduced.
5. **No speculative cap.** The previous 80-item local cap was above the service page size of 50 and had no caller-specific meaning.

## Verification

Environment: Linux 7.0.0-43-generic x64; Node v24.13.0; npm 11.17.0; Vitest 1.6.1 / jsdom. Input manifest: the three changed production inputs below; aggregate digest `00e25e19d1eee4d8b86aeed9960c97885aa3d59e1bb4796a04a9123df746431d` over sorted `sha256<two spaces>path` lines. This record is excluded from its own manifest.

```text
EVIDENCE-180  frontend typecheck
task: TASK-2026-11-26-guided-leetcode-guard
target_entities: MOD-GUIDED-LEETCODE, MOD-GUIDED-LEETCODE-HELPERS, MOD-GUIDED-LEETCODE-HOOKS
checker: tsc
command: npx tsc --noEmit
cwd: frontend/
started_at / finished_at: 2026-11-26T09:54:52Z / 2026-11-26T09:54:54Z
environment: Linux x64; node 24.13.0; npm 11.17.0
exit_code: 0 (expected 0)
result: passed
summary: no diagnostics
input_manifest: as the three-file manifest; aggregate 00e25e19…
artifacts: none
validity: valid
```

```text
EVIDENCE-181  frontend lint
task: TASK-2026-11-26-guided-leetcode-guard
target_entities: MOD-GUIDED-LEETCODE, MOD-GUIDED-LEETCODE-HELPERS, MOD-GUIDED-LEETCODE-HOOKS
checker: eslint
command: npm run lint
cwd: frontend/
started_at / finished_at: 2026-11-26T09:54:54Z / 2026-11-26T09:54:56Z
environment: Linux x64; node 24.13.0; npm 11.17.0
exit_code: 0 (expected 0)
result: passed
summary: no findings
input_manifest: as EVIDENCE-180; aggregate 00e25e19…
artifacts: /tmp/guard-leetcode-lint.out (sha256 b9dc24903293165476b9aec70ed49cceb5a1b14257f07ad260b7948d5025a6e6, ephemeral)
validity: valid
```

```text
EVIDENCE-182  frontend full suite
task: TASK-2026-11-26-guided-leetcode-guard
target_entities: MOD-GUIDED-LEETCODE, MOD-GUIDED-LEETCODE-HELPERS, MOD-GUIDED-LEETCODE-HOOKS
checker: vitest
command: npx vitest run
cwd: frontend/
started_at / finished_at: 2026-11-26T09:54:56Z / 2026-11-26T09:55:00Z
environment: Linux x64; node 24.13.0; vitest 1.6.1; jsdom
exit_code: 0 (expected 0)
result: passed
summary: 48 files, 314 tests passed; panel and guided page suites unchanged (3 panel tests, 13 page tests)
input_manifest: as EVIDENCE-180; aggregate 00e25e19…
artifacts: /tmp/guard-leetcode-tests.out (sha256 6758ffcb5090e44d4c294ac4275683f8bebbde2b72d5de547dc7c489be65f862, ephemeral)
validity: valid
```

```text
EVIDENCE-183  docs link/reference check
task: TASK-2026-11-26-guided-leetcode-guard
target_entities: MOD-DOCS
checker: scripts/check-docs-links.py (python3 3.14.4)
command: python3 scripts/check-docs-links.py
cwd: repository root
started_at / finished_at: 2026-11-26T09:55:41Z / 2026-11-26T09:55:41Z
environment: Linux x64; python3 3.14.4; git worktree
exit_code: 0 (expected 0)
result: passed
summary: 32 files, 18 links, 71 id references; ok. This record is excluded from its own manifest because the block is written after the run.
input_manifest: this record excluded; production inputs as EVIDENCE-180
artifacts: none
validity: valid
```

## Findings

- The panel component dropped from 284 lines with mixed I/O/state/render to a composition of three hooks, three pure helpers, and three presentational functions.
- `MAX_VISIBLE_PROBLEMS = 80` was dead speculation above the service's 50-item page; removed.
- Unused `disabled` on `AttemptActions` and unused `SubmissionResultDto`/`RunResult` component imports were removed.
- Behavior is covered by the existing 314-test suite; no test was changed to accommodate the refactor.
- Remaining flagged for author: hooks are cohesive state machines (~50–60 lines), not ≤20-line leaf functions; broad UI `catch` blocks map unknown API failures to fixed messages rather than typed errors.

## Risks / open questions

- The refactor adds three files for one panel; the split follows current responsibilities but may be over-structured if the panel shrinks later.
- Hook functions remain longer than the skill's leaf-function target because they own coordinated React state and refs.
- Broad UI catches remain; they show errors rather than swallow them, but cannot distinguish auth/network/parse failures beyond the fixed messages.
- No behavior change was intended; the browser was not re-run after this structural-only change.


- Pending verification; hooks are cohesive state machines rather than ≤20-line leaf functions.
