# TASK-2026-11-25-guided-mastery-sync — sync guided stage mastery across sessions

Type: feature
Tier: T3
Tooling: repo-native (omp/commandcode, 2026-11-25)
Risk: medium
Design status: draft (approval by: unassigned — no human review yet)
Implementation: implemented
Verification: passed
Evidence: valid (EVIDENCE-125/126/127/128/129/130/131)
ADR: [ADR-1](../../architecture/ADR-1-guided-mastery-evidence.md) (draft)

## Objective

Close the last guided-learning gap: a passed stage should become durable semantic mastery evidence in the Agent, visible from the knowledge graph and mastery path in later sessions, without treating model feedback as a judge result. The browser queues events offline and retries them on the next page open.

## Acceptance conditions

- AC-1: a deterministic choice pass and a coach-passed short/code stage each enqueue one event and POST it; a failed attempt enqueues nothing — verified by `guidedMastery.test.ts` and `GuidedLearningPage.test.tsx`.
- AC-2: the request carries `platform=GUIDED`, `status=GUIDED_ACCEPTED`, the topic, stage language, elapsed seconds, and a deterministic `client_id`; it carries no chat text or code — verified by `guidedMastery.test.ts` and `GuidedLearningPage.test.tsx`.
- AC-3: offline events persist in the workspace queue and flush on the next mount; success clears the queue, failure keeps it — verified by `guidedMastery.test.ts`.
- AC-4: the Agent adds `+0.03` to the topic's mastery and increments `attempts` — verified by `test_memory_record.py`.
- AC-5: the self-improvement replay uses the same deltas (`GUIDED_ACCEPTED +0.03`, `LOCAL_ACCEPTED +0.05`) — verified by `test_self_improve.py`.
- AC-6: a guided pass does not create a review schedule — verified by `test_memory_record.py`.
- AC-7: restored outlines keep their stage ids, so the mastery client id is stable across reloads — verified by `guidedPlan.test.ts`.
- AC-8: the contract, replay rule, UI status, privacy boundary, and ADR are documented — verified by EVIDENCE-131.

## Scope

- Target entities: `CONTRACT-memory-record`, `MOD-MEMORY`, `MOD-SELF-IMPROVE`, `MOD-GUIDED-MASTERY`, `MOD-GUIDED-PAGE`, `MOD-GUIDED-PLAN`, `MOD-DOCS`, `ADR-1`.
- Write scope: `backend/agent/app/memory/memory_service.py`, `backend/agent/app/agent/self_improve.py`, `backend/agent/tests/test_memory_record.py`, `backend/agent/tests/test_self_improve.py`, `frontend/src/services/guidedMastery.ts`, `frontend/src/services/guidedMastery.test.ts`, `frontend/src/services/guidedPlan.ts`, `frontend/src/services/guidedPlan.test.ts`, `frontend/src/pages/GuidedLearningPage.tsx`, `frontend/src/pages/GuidedLearningPage.test.tsx`, `frontend/src/pages/GuidedLearningChoiceGrading.test.tsx`, `docs/architecture/ADR-1-guided-mastery-evidence.md`, `docs/backend-agent.md`, `docs/memory-system.md`, `docs/frontend.md`, `docs/deeptutor-adaptation.md`, this record.
- Protected paths: none touched. No DB schema, storage key rename, gateway, desktop, or CI change.
- Dependencies: existing `POST /memory/record`, `workspaceStorageKey`, guided-session snapshot, and `MemoryService._update_mastery`.

## Design notes (design → code)

1. **A separate evidence class.** `GUIDED_ACCEPTED` moves mastery by `+0.03`, not the `+0.05` of a judge/local-run acceptance, because the pass came from deterministic choice scoring or a coach assessment. ADR-1 records the tradeoff and rejected alternatives.
2. **One live/replay rule.** `mastery_delta(status)` in `memory_service` is used by `record_attempt` and `self_improve._replay_mastery`. The replay now also recognizes `LOCAL_ACCEPTED` at `+0.05`, fixing an existing divergence.
3. **No review schedule.** `_episode_is_due_material` treats `GUIDED_ACCEPTED` like an accepted attempt without sticking points, so a pass does not create a due review.
4. **Pass-only trigger.** `submitChoice` syncs when the deterministic answer is correct; `applyAssessment` syncs short/code only when the model emits `[[评价:通过]]`. Wrong/retry outcomes are not recorded as mastery failures.
5. **Queue + idempotency.** The browser stores `{clientId, topic, stageId, lang, durationSec, createdAt}` per workspace. `clientId` is a deterministic FNV-1a hash of workspace+conversation+stage, which stays under the Agent's 128-character limit; the Agent receipt table dedupes repeated posts.
6. **Stable stage identity.** `normalizePlan` now preserves supplied stage ids (deduplicating collisions) instead of reminting them on every restore, so the client id does not change after a reload.
7. **Offline continuity.** A pass queues before posting; success clears the event, failure leaves it for the next mount. The outline shows 正在同步 / 已同步 / 等待同步.
8. **Metadata only.** The request sends topic, stage id, language, and seconds; the conversation, questions, answers, and code remain browser-local.

## Trace table (code → design)

| Entity | Implementation | Verification |
|--------|----------------|--------------|
| `CONTRACT-memory-record` | `memory_service.py` (`GUIDED_ACCEPTED`, `mastery_delta`, `_update_mastery` delta), `docs/backend-agent.md` | `test_memory_record.py` |
| `MOD-SELF-IMPROVE` | `self_improve.py` (shared `mastery_delta`) | `test_self_improve.py` |
| `MOD-GUIDED-MASTERY` | `guidedMastery.ts` (queue, flush, payload, hash) | `guidedMastery.test.ts` |
| `MOD-GUIDED-PAGE` | `GuidedLearningPage.tsx` (pass hooks, timer, mount flush, status) | `GuidedLearningPage.test.tsx`, browser run |
| `MOD-GUIDED-PLAN` | `guidedPlan.ts` (id preservation) | `guidedPlan.test.ts` |
| `MOD-DOCS` / `ADR-1` | docs + ADR | EVIDENCE-131 |

## Verification

Environment: Linux 7.0.0-43-generic x64; Node v24.13.0; npm 11.17.0; Vitest 1.6.1 / jsdom; Python 3.12 venv; Chromium via the browser helper. Input manifest: the 16 changed inputs below; aggregate digest `76a189a103f10f36009817512b2de5acf17df54f84069f06ef94358ec6404ec9` over sorted `sha256<two spaces>path` lines. This record is excluded from its own manifest.

```text
EVIDENCE-125  frontend typecheck
task: TASK-2026-11-25-guided-mastery-sync
target_entities: MOD-GUIDED-MASTERY, MOD-GUIDED-PAGE, MOD-GUIDED-PLAN
checker: tsc (typescript from frontend devDependencies)
command: npx tsc --noEmit
cwd: frontend/
started_at / finished_at: 2026-11-25T13:59:40Z / 2026-11-25T13:59:42Z
environment: Linux x64; node 24.13.0; npm 11.17.0
exit_code: 0 (expected 0)
result: passed
summary: no diagnostics
input_manifest: as the 16-file manifest (aggregate 76a189a1…)
artifacts: none
validity: valid
```

```text
EVIDENCE-126  frontend lint
task: TASK-2026-11-25-guided-mastery-sync
target_entities: MOD-GUIDED-MASTERY, MOD-GUIDED-PAGE, MOD-GUIDED-PLAN
checker: eslint
command: npm run lint
cwd: frontend/
started_at / finished_at: 2026-11-25T13:59:42Z / 2026-11-25T13:59:43Z
environment: Linux x64; node 24.13.0; npm 11.17.0
exit_code: 0 (expected 0)
result: passed
summary: no findings
input_manifest: as EVIDENCE-125; aggregate 76a189a1…
artifacts: /tmp/guided-mastery-lint.out (sha256 b9dc24903293165476b9aec70ed49cceb5a1b14257f07ad260b7948d5025a6e6, ephemeral)
validity: valid
```

```text
EVIDENCE-127  frontend full suite
task: TASK-2026-11-25-guided-mastery-sync
target_entities: MOD-GUIDED-MASTERY, MOD-GUIDED-PAGE, MOD-GUIDED-PLAN
checker: vitest
command: npx vitest run
cwd: frontend/
started_at / finished_at: 2026-11-25T13:59:31Z / 2026-11-25T13:59:35Z
environment: Linux x64; node 24.13.0; vitest 1.6.1; jsdom
exit_code: 0 (expected 0)
result: passed
summary: 44 files, 286 tests passed (280 before; six new: four queue tests, one page sync test, one id-preservation test)
input_manifest: as EVIDENCE-125; aggregate 76a189a1…
artifacts: /tmp/guided-mastery-frontend-tests2.out (sha256 ed9dbe6da9808d7b42225db6f5ba25a822919e23492a22a1c9ec8412b005b934, ephemeral)
validity: valid
```

```text
EVIDENCE-128  agent full suite
task: TASK-2026-11-25-guided-mastery-sync
target_entities: CONTRACT-memory-record, MOD-MEMORY, MOD-SELF-IMPROVE
checker: pytest
command: .venv/bin/python -m pytest -q
cwd: backend/agent/
started_at / finished_at: 2026-11-25T14:00:34Z / 2026-11-25T14:02:50Z
environment: Linux x64; Python 3.12 venv; pytest 9.2.0
exit_code: 0 (expected 0)
result: passed
summary: 328 passed, 3 skipped (327 before; one new guided review-schedule test)
input_manifest: as EVIDENCE-125; aggregate 76a189a1…
artifacts: /tmp/guided-mastery-agent-tests2.out (sha256 97462ab2293cdff59e44082e437f94001d27c9aeb1753f2a96c8423bafd83899, ephemeral)
validity: valid
```

```text
EVIDENCE-129  agent types
task: TASK-2026-11-25-guided-mastery-sync
target_entities: CONTRACT-memory-record, MOD-MEMORY, MOD-SELF-IMPROVE
checker: mypy 1.18.2
command: .venv/bin/mypy app --ignore-missing-imports --follow-imports=silent
cwd: backend/agent/
started_at / finished_at: 2026-11-25T14:03:01Z / 2026-11-25T14:03:04Z
environment: Linux x64; Python 3.12 venv
exit_code: 0 (expected 0)
result: passed
summary: no issues found in 23 source files
input_manifest: as EVIDENCE-125; aggregate 76a189a1…
artifacts: /tmp/guided-mastery-mypy3.out (sha256 ae8cdf9d91c934bf8e89998f97259fc56d89503bffb3adcf4e6bd8cb9d7838f8, ephemeral)
validity: valid
```

```text
EVIDENCE-130  agent lint
task: TASK-2026-11-25-guided-mastery-sync
target_entities: CONTRACT-memory-record, MOD-MEMORY, MOD-SELF-IMPROVE
checker: ruff 0.15.17
command: .venv/bin/ruff check --isolated app tests
cwd: backend/agent/
started_at / finished_at: 2026-11-25T14:03:04Z / 2026-11-25T14:03:04Z
environment: Linux x64; Python 3.12 venv
exit_code: 0 (expected 0)
result: passed
summary: all checks passed
input_manifest: as EVIDENCE-125; aggregate 76a189a1…
artifacts: /tmp/guided-mastery-ruff2.out (sha256 82b3e6a6c090a57601d22943bd23fca9218d1031dbe5a7b754092f9a156b4f18, ephemeral)
validity: valid
```

```text
EVIDENCE-131  docs link/reference check
task: TASK-2026-11-25-guided-mastery-sync
target_entities: MOD-DOCS, ADR-1
checker: scripts/check-docs-links.py (python3 3.14.4)
command: python3 scripts/check-docs-links.py
cwd: repository root
started_at / finished_at: 2026-11-25T14:03:54Z / 2026-11-25T14:03:54Z
environment: Linux x64; python3 3.14.4; git worktree
exit_code: 0 (expected 0)
result: passed
summary: 19 files, 14 links, 46 id references; ok. This record is excluded from its own manifest because the block is written after the run.
input_manifest: docs/architecture/ADR-1-guided-mastery-evidence.md d55fdd3f…, docs/backend-agent.md 2268f402…, docs/deeptutor-adaptation.md df9c0253…, docs/frontend.md f361f05f…, docs/memory-system.md 0523ba9d…; the script also reads the existing authority docs and task records; this record excluded
artifacts: none
validity: valid
```

## Findings from the browser run

- A seeded choice lesson with the correct answer selected posted through a patched `window.fetch`, showed `掌握度已同步到训练记忆` in the outline, and left `algocoach.guidedMasteryQueue` as `[]`.
- The Agent was not running, so the follow-up explanation failed with the existing Provider error; the mastery write still completed independently.
- The outline showed the injected code stage and the choice stage while the sync status stayed visible under the path.

## Risks / open questions

- A coach-judged short/code pass can be wrong; the `+0.03` step limits but does not eliminate that exposure. The synthetic `guided:<topic>` problem id is topic-level, not stage-level, in the semantic graph.
- The 32-bit FNV client id can theoretically collide across stages, which would drop one event; the probability is negligible for a local single-user workspace.
- Unsent events live in browser localStorage; clearing site data, private-window closure, or permanent offline mode drops them. There is no cross-device queue.
- Retries happen on mount and after the next pass, not on an `online` event; a long-lived offline tab stays 等待同步 until one of those triggers.
- The replay change also moves historical `LOCAL_ACCEPTED` episodes from `-0.08` to `+0.05`, which can change backtest outcomes; it aligns them with what live mastery already did.
- Design status and ADR-1 remain `draft`; no human approval yet.
