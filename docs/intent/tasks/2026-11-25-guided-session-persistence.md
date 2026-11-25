# TASK-2026-11-25-guided-session-persistence — persist the guided lesson across browser sessions

Type: feature
Tier: T2
Tooling: repo-native (omp/commandcode, 2026-11-25)
Risk: medium
Design status: draft (approval by: unassigned — no human review yet)
Implementation: implemented
Verification: passed
Evidence: valid (EVIDENCE-113/114/115/116)

## Objective

The guided learning page kept its outline, stage, messages, and code in sessionStorage, so closing the tab or restarting the browser discarded the lesson. Persist that snapshot per workspace in localStorage, migrate existing tab-scoped lessons on first read, and keep the defensive restore path unchanged.

## Acceptance conditions

- AC-1: after the tab session is cleared and the page remounts, `/home` restores the topic, AI outline, current stage, messages, and code from localStorage without calling the planner again — verified by `GuidedLearningPage.test.tsx` and an observed browser run.
- AC-2: starting a new topic clears both the durable and legacy snapshots — verified by `guidedSession.test.ts` and the browser run.
- AC-3: a legacy sessionStorage lesson is migrated on first read and removed only after the localStorage write succeeds; a refused write keeps the tab copy — verified by `guidedSession.test.ts`.
- AC-4: malformed payloads, unknown future versions, and snapshots missing a stage or messages are ignored — verified by `guidedSession.test.ts`.
- AC-5: each workspace keeps its own snapshot key — verified by `guidedSession.test.ts`.
- AC-6: `docs/frontend.md` and `docs/deeptutor-adaptation.md` describe the durable snapshot, migration, reset, and local-only boundary — verified by inspection and EVIDENCE-116.

## Scope

- Target entities: `MOD-GUIDED-PAGE`, `MOD-GUIDED-SESSION`, `MOD-DOCS`.
- Write scope: `frontend/src/services/guidedSession.ts`, `frontend/src/services/guidedSession.test.ts`, `frontend/src/pages/GuidedLearningPage.tsx`, `frontend/src/pages/GuidedLearningPage.test.tsx`, `frontend/src/pages/GuidedLearningChoiceGrading.test.tsx`, `docs/frontend.md`, `docs/deeptutor-adaptation.md`, this record.
- Protected paths: none touched. No storage key rename, API, schema, backend, gateway, agent, desktop, or CI change.
- Dependencies: existing `workspaceStorageKey`, `sanitizeGuidedStages`, and the page's restore/save effects; no new package.

## Design notes (design → code)

1. **Durable snapshot, same key.** `algocoach.guidedLearning` now lives in localStorage under `{version: 1, session}`. The version gate rejects unknown future shapes instead of misreading them; direct unversioned payloads remain readable for migration.
2. **Migration on read, not on write.** `readGuidedSession` copies a legacy sessionStorage payload to localStorage immediately and removes the tab copy only after a successful write. If the write is refused, the tab keeps working from sessionStorage.
3. **Full snapshot, not outline alone.** Restoring only `stages` would leave an active-stage marker with no transcript, question, or code context. The snapshot therefore carries messages, choice attempts, question id, code, and language; it stays inside the browser and is not added to the workspace export or Agent memory.
4. **Effects unchanged in shape.** The page still skips persistence on its first hydrated render, then saves on every relevant state change; `resetTopic` clears through the same empty `activeTopic` path. The storage module owns versioning and migration.
5. **Test isolation follows durability.** `GuidedLearningChoiceGrading.test.tsx` now clears localStorage too, because a lesson from one test would otherwise restore into the next mount.

## Trace table (code → design)

| Entity | Implementation | Verification |
|--------|----------------|--------------|
| `MOD-GUIDED-SESSION` | `guidedSession.ts` (envelope, migration, validation, clear) | `guidedSession.test.ts` |
| `MOD-GUIDED-PAGE` | `GuidedLearningPage.tsx` (read/save/clear wiring) | `GuidedLearningPage.test.tsx`, `GuidedLearningChoiceGrading.test.tsx` |
| `MOD-DOCS` | `docs/frontend.md` §3.10, `docs/deeptutor-adaptation.md` §引导式学习 | EVIDENCE-116 |

## Verification

Environment for all blocks: Linux 7.0.0-43-generic x64; Node v24.13.0; npm 11.17.0; Vitest 1.6.1 / jsdom; cwd `frontend/` unless stated. Input manifest: the seven changed inputs below; aggregate digest `21236bae4238348a2a600640313dbd5077dc08686ad3001b7c702695ee7d9a83` over sorted `sha256<two spaces>path` lines. This record is excluded from its own manifest.

```text
EVIDENCE-113  frontend typecheck
task: TASK-2026-11-25-guided-session-persistence
target_entities: MOD-GUIDED-SESSION, MOD-GUIDED-PAGE
checker: tsc (typescript from frontend devDependencies)
command: npx tsc --noEmit
cwd: frontend/
started_at / finished_at: 2026-11-25T13:26:24Z / 2026-11-25T13:26:26Z
environment: Linux x64; node 24.13.0; npm 11.17.0
exit_code: 0 (expected 0)
result: passed
summary: no diagnostics
input_manifest: docs/deeptutor-adaptation.md 71097502…, docs/frontend.md 72c3e7b6…, GuidedLearningChoiceGrading.test.tsx 353edb01…, GuidedLearningPage.test.tsx 5fa621cf…, GuidedLearningPage.tsx 23fc57ad…, guidedSession.test.ts 76f0a792…, guidedSession.ts 6c748e54…; aggregate 21236bae…
artifacts: none
validity: valid
```

```text
EVIDENCE-114  frontend lint
task: TASK-2026-11-25-guided-session-persistence
target_entities: MOD-GUIDED-SESSION, MOD-GUIDED-PAGE
checker: eslint
command: npm run lint
cwd: frontend/
started_at / finished_at: 2026-11-25T13:26:26Z / 2026-11-25T13:26:27Z
environment: Linux x64; node 24.13.0; npm 11.17.0
exit_code: 0 (expected 0)
result: passed
summary: no findings
input_manifest: as EVIDENCE-113; aggregate 21236bae…
artifacts: /tmp/guided-session-lint.out (sha256 b9dc24903293165476b9aec70ed49cceb5a1b14257f07ad260b7948d5025a6e6, ephemeral)
validity: valid
```

```text
EVIDENCE-115  frontend full suite
task: TASK-2026-11-25-guided-session-persistence
target_entities: MOD-GUIDED-SESSION, MOD-GUIDED-PAGE
checker: vitest
command: npx vitest run
cwd: frontend/
started_at / finished_at: 2026-11-25T13:26:27Z / 2026-11-25T13:26:31Z
environment: Linux x64; node 24.13.0; vitest 1.6.1; jsdom
exit_code: 0 (expected 0)
result: passed
summary: 43 files, 276 tests passed (269 before; seven new: six storage tests, one cross-session page test)
input_manifest: as EVIDENCE-113; aggregate 21236bae…
artifacts: /tmp/guided-session-vitest.out (sha256 07b33940a4642e228c8126a12d493ce0b4fdbfb649dc05773ffafab665ea5a75, ephemeral)
validity: valid
```

```text
EVIDENCE-116  docs link/reference check
task: TASK-2026-11-25-guided-session-persistence
target_entities: MOD-DOCS
checker: scripts/check-docs-links.py (python3 3.14.4)
command: python3 scripts/check-docs-links.py
cwd: repository root
started_at / finished_at: 2026-11-25T13:26:56Z / 2026-11-25T13:26:56Z
environment: Linux x64; python3 3.14.4; git worktree
exit_code: 0 (expected 0)
result: passed
summary: 15 files, 13 links, 34 id references; ok. This record is excluded from its own manifest because the block is written after the run.
input_manifest: docs/deeptutor-adaptation.md 71097502…, docs/frontend.md 72c3e7b6…; the script also reads the existing authority docs and task records; this record excluded
artifacts: none
validity: valid
```

## Findings from the browser run

- A legacy sessionStorage snapshot survived a reload, migrated to `{version: 1, session}` in localStorage, and disappeared from sessionStorage.
- After `sessionStorage.clear()` and another reload, `/home` still showed the topic, the AI-planned outline (with the injected programming stage), the current `选择题` stage, and the restored transcript.
- Clicking `新主题` removed both storage copies and returned the page to the empty state.

## Risks / open questions

- localStorage is shared across tabs: two `/home` tabs can overwrite each other's lesson (last writer wins) and there is no `storage`-event sync. sessionStorage previously isolated tabs.
- The snapshot has no size cap. Long lessons with code can consume the localStorage quota shared with drafts, review data, and layout; a refused write keeps the lesson in memory only.
- Guided chat and code now outlive the tab in browser localStorage. It remains local-only (not in the workspace export, Agent memory, or database), but this widens the on-disk footprint compared with sessionStorage.
- A restored `conversationId` may reference Agent state that no longer exists after an Agent restart; the transcript renders, but a follow-up turn may start fresh server-side context.
- Design status remains `draft`; no human review yet.
