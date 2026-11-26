# TASK-2026-11-26-guided-leetcode-submit — run and submit real LeetCode problems from a guided code stage

Type: feature
Tier: T2
Tooling: repo-native (omp/commandcode, 2026-11-26)
Risk: high
Design status: draft
Implementation: implemented
Verification: passed
Evidence: valid (EVIDENCE-176/177/178/179)

## Objective

Guided `/home` code stages previously ended in a local textarea and a model assessment. Add an optional LeetCode practice panel to the code stage: choose a real problem (topic-filtered), load its official language snippet, run the sample and submit through the existing Gateway cookie boundary, and use an accepted submission as deterministic stage evidence.

## Acceptance conditions

- AC-1: the panel stays collapsed until opened and only then requests the topic-filtered problem list; it never contacts LeetCode on page load.
- AC-2: selecting a problem loads its detail and inserts the snippet for the current language. A non-template custom draft asks before replacement; cancelling leaves both code and selection unchanged.
- AC-3: changing language replaces only the guided template or the previous problem snippet; custom code is preserved. A missing language snippet disables run/submit with a visible hint.
- AC-4: run sends `titleSlug`, current code, language, and the problem's sample input to `POST /api/run`; submit sends the same plus the stage duration to `POST /api/submit` via `leetcodeService`.
- AC-5: `ACCEPTED` marks the code stage passed, shows a stage feedback message, and enqueues guided mastery; non-AC results and errors do not pass the stage.
- AC-6: cookie/auth failures surface a configuration hint and link to `/settings/platforms`; no cookie is read or stored by the frontend.
- AC-7: code is sent to LeetCode only on an explicit run/submit click; the existing “提交代码” coach assessment remains a separate action.
- AC-8: docs record the panel, the Gateway boundary, and the AC-as-stage-evidence decision.

## Scope

- Target entities: `MOD-GUIDED-LEETCODE`, `MOD-GUIDED-PAGE`, `MOD-DOCS`.
- Write scope: `frontend/src/components/Editor/GuidedLeetCodePanel.tsx`, `frontend/src/components/Editor/GuidedLeetCodePanel.test.tsx`, `frontend/src/pages/GuidedLearningPage.tsx`, `docs/frontend.md`, `docs/deeptutor-adaptation.md`, this record.
- Protected paths: none. No Gateway, Agent, schema, or Cookie storage change.
- Dependencies: existing `GET /api/problems`, `GET /api/problems/{slug}`, `POST /api/run`, `POST /api/submit`, `leetcodeService`, `guidedCodeTemplates`, and guided mastery queue.

## Design notes (design → code)

1. **Optional, explicit panel.** The code stage keeps its existing editor. A compact “LeetCode 实战” row expands into a topic-filtered problem picker only when requested; no load or submission happens implicitly.
2. **Real problem, real snippet.** Selecting a problem fetches details and uses the returned `codeSnippets` for the current `CodeLanguage`. Replacement is guarded by the existing template/custom-code check and a confirm.
3. **Existing judge boundary.** Run/submit use the existing Gateway endpoints and `leetcodeService`; the frontend never reads the Cookie. `durationSec` is the stage elapsed time.
4. **Deterministic pass.** `ACCEPTED` calls `acceptLeetCode`, which sets `answered`, shows a judge-based feedback line, and enqueues `GUIDED_ACCEPTED` for the active topic. A non-AC result leaves the stage open.
5. **Two assessments stay separate.** “提交 LeetCode” uses the real judge; “提交代码” keeps the coach assessment for the generated exercise. The learner chooses.
6. **Degrade safely.** Missing Cookie, network errors, missing language snippets, and list failures show actionable messages; no stage transition occurs.

## Verification

Environment: Linux 7.0.0-43-generic x64; Node v24.13.0; npm 11.17.0; Vitest 1.6.1 / jsdom; Chromium via the browser helper; local Gateway 8080 and Agent 8000 with an authenticated LeetCode cookie. Input manifest: the five changed inputs below; aggregate digest `f82cd291e79f45816213cce07eb18c3a8531cca33e0b6921424e37d95e274089` over sorted `sha256<two spaces>path` lines. This record is excluded from its own manifest.

```text
EVIDENCE-176  frontend typecheck
task: TASK-2026-11-26-guided-leetcode-submit
target_entities: MOD-GUIDED-LEETCODE, MOD-GUIDED-PAGE
checker: tsc
command: npx tsc --noEmit
cwd: frontend/
started_at / finished_at: 2026-11-26T08:35:40Z / 2026-11-26T08:35:42Z
environment: Linux x64; node 24.13.0; npm 11.17.0
exit_code: 0 (expected 0)
result: passed
summary: no diagnostics
input_manifest: as the five-file manifest; aggregate f82cd291…
artifacts: none
validity: valid
```

```text
EVIDENCE-177  frontend lint
task: TASK-2026-11-26-guided-leetcode-submit
target_entities: MOD-GUIDED-LEETCODE, MOD-GUIDED-PAGE
checker: eslint
command: npm run lint
cwd: frontend/
started_at / finished_at: 2026-11-26T08:35:42Z / 2026-11-26T08:35:43Z
environment: Linux x64; node 24.13.0; npm 11.17.0
exit_code: 0 (expected 0)
result: passed
summary: no findings
input_manifest: as EVIDENCE-176; aggregate f82cd291…
artifacts: /tmp/guided-leetcode-lint.out (sha256 b9dc24903293165476b9aec70ed49cceb5a1b14257f07ad260b7948d5025a6e6, ephemeral)
validity: valid
```

```text
EVIDENCE-178  frontend full suite
task: TASK-2026-11-26-guided-leetcode-submit
target_entities: MOD-GUIDED-LEETCODE, MOD-GUIDED-PAGE
checker: vitest
command: npx vitest run
cwd: frontend/
started_at / finished_at: 2026-11-26T08:35:43Z / 2026-11-26T08:35:47Z
environment: Linux x64; node 24.13.0; vitest 1.6.1; jsdom
exit_code: 0 (expected 0)
result: passed
summary: 48 files, 314 tests passed (311 before; three panel tests: list/bind/run/submit, cancelled replacement, list failure hint)
input_manifest: as EVIDENCE-176; aggregate f82cd291…
artifacts: /tmp/guided-leetcode-tests.out (sha256 86c5fa5af14e8f316619a2ad799abba78dc4066b5c0c0306557067e86daf1c8e, ephemeral)
validity: valid
```

```text
EVIDENCE-179  docs link/reference check
task: TASK-2026-11-26-guided-leetcode-submit
target_entities: MOD-DOCS
checker: scripts/check-docs-links.py (python3 3.14.4)
command: python3 scripts/check-docs-links.py
cwd: repository root
started_at / finished_at: 2026-11-26T08:36:56Z / 2026-11-26T08:36:56Z
environment: Linux x64; python3 3.14.4; git worktree
exit_code: 0 (expected 0)
result: passed
summary: 31 files, 18 links, 70 id references; ok. This record is excluded from its own manifest because the block is written after the run.
input_manifest: docs/frontend.md 155e0ae3…, docs/deeptutor-adaptation.md 05be2192…; the script also reads the authority docs and other task records; this record excluded
artifacts: none
validity: valid
```

## Findings from the browser run

- `/home` restored a code-stage session and showed the collapsed `LeetCode 实战` row without requesting the problem list.
- Expanding it loaded topic-filtered problems from the local Gateway with the authenticated LeetCode cookie; choosing a problem loaded its detail, inserted the official Python snippet, and showed the LeetCode link, 运行样例, and 提交 LeetCode controls.
- A second selection with modified code raised the replacement confirm; accepting replaced the code. The submit button was initially transparent because the panel sat outside the `.code-workbench` variable scope; adding that scope fixed the color.
- No real submission was sent during review; run/submit calls are covered by mocked service tests.

## Risks / open questions

- The panel only loads the first 50 topic-filtered problems; there is no free-text server search or pagination.
- The selected problem is not persisted in the guided session snapshot; a reload returns the code but clears the binding and judge result state.
- A LeetCode AC passes the current guided stage even though the AI-generated stage question and the chosen LeetCode problem are not guaranteed to be identical. The learner explicitly chooses the binding, but this is a product tradeoff.
- Real run/submit behavior against LeetCode is not exercised in automated tests or this review; only the Gateway list/detail paths were live-checked.
- A missing language snippet disables run/submit, but the code area still shows the previous language's snippet until the learner changes language or problem.
- The panel uses `window.confirm` for custom-code replacement; it is not styled by the app.
- Design status remains `draft`; no human approval yet.
