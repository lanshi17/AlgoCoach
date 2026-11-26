# TASK-2026-11-26-chat-stop-generation — stop a streaming coach reply

Type: feature
Tier: T2
Tooling: repo-native (omp/commandcode, 2026-11-26)
Risk: low
Design status: draft
Implementation: implemented
Verification: passed
Evidence: valid (EVIDENCE-168/169/170/171)

## Objective

The chat panel waits for a full model turn with no way out except changing the problem or hiding the tab. A stop control should abort the in-flight request, clear the transient thinking/stream state, leave a short system notice, and return the composer to the send state without presenting an error or retry prompt.

## Acceptance conditions

- AC-1: while a request is loading the send button becomes a stop control with `aria-label="停止生成"` and `aria-busy="true"`.
- AC-2: pressing stop aborts the request signal, clears thinking and streamed text, adds one `已停止生成。` system message, and immediately restores the send state.
- AC-3: the aborted turn is not treated as a failure: no error/retry action and no duplicated user message.
- AC-4: a stale stop call with no active controller is a no-op.
- AC-5: the behavior is documented next to the chat flow.

## Scope

- Target entities: `MOD-CHAT-PANEL`, `MOD-DOCS`.
- Write scope: `frontend/src/components/Chat/ChatPanel.tsx`, `frontend/src/components/Chat/ChatPanel.test.tsx`, `docs/frontend.md`, this record.
- Protected paths: none.
- Dependencies: existing `chatRequestRef` AbortController and `agentService.chatStream`.

## Design notes (design → code)

1. **Same controller.** Stop calls the existing `AbortController`; `chatRequestRef` is cleared so the late `finally` cannot re-enable a newer request.
2. **No failure path.** The catch already returns on `signal.aborted`; stop does not call `getAgentErrorMessage` or set a retry marker.
3. **Visible outcome.** A single system message confirms the user's action; transient stream/thinking state is cleared. The user's message stays in the transcript.
4. **No server cancellation protocol.** Aborting the fetch stops this client's stream; the Agent may finish its turn server-side and remains replayable by turn id.

## Verification

Environment: Linux 7.0.0-43-generic x64; Node v24.13.0; npm 11.17.0; Vitest 1.6.1 / jsdom; Chromium via the browser helper; a local fake SSE gateway on port 8080. Input manifest: the three changed inputs below; aggregate digest `9ceb7db4c5c004d25fb6ebe0caf89ca2c9df872e7ab7a33b731d8c771a139d25` over sorted `sha256<two spaces>path` lines. This record is excluded from its own manifest.

```text
EVIDENCE-168  frontend typecheck
task: TASK-2026-11-26-chat-stop-generation
target_entities: MOD-CHAT-PANEL
checker: tsc
command: npx tsc --noEmit
cwd: frontend/
started_at / finished_at: 2026-11-26T07:41:34Z / 2026-11-26T07:41:36Z
environment: Linux x64; node 24.13.0; npm 11.17.0
exit_code: 0 (expected 0)
result: passed
summary: no diagnostics
input_manifest: as the three-file manifest; aggregate 9ceb7db4…
artifacts: none
validity: valid
```

```text
EVIDENCE-169  frontend lint
task: TASK-2026-11-26-chat-stop-generation
target_entities: MOD-CHAT-PANEL
checker: eslint
command: npm run lint
cwd: frontend/
started_at / finished_at: 2026-11-26T07:41:36Z / 2026-11-26T07:41:37Z
environment: Linux x64; node 24.13.0; npm 11.17.0
exit_code: 0 (expected 0)
result: passed
summary: no findings
input_manifest: as EVIDENCE-168; aggregate 9ceb7db4…
artifacts: /tmp/chat-stop-lint.out (sha256 b9dc24903293165476b9aec70ed49cceb5a1b14257f07ad260b7948d5025a6e6, ephemeral)
validity: valid
```

```text
EVIDENCE-170  frontend full suite
task: TASK-2026-11-26-chat-stop-generation
target_entities: MOD-CHAT-PANEL
checker: vitest
command: npx vitest run
cwd: frontend/
started_at / finished_at: 2026-11-26T07:41:37Z / 2026-11-26T07:41:41Z
environment: Linux x64; node 24.13.0; vitest 1.6.1; jsdom
exit_code: 0 (expected 0)
result: passed
summary: 47 files, 309 tests passed (308 before; one new stop-generation test; the existing loading assertion now targets the stop control)
input_manifest: as EVIDENCE-168; aggregate 9ceb7db4…
artifacts: /tmp/chat-stop-tests.out (sha256 30142c53d333c50d9aa69732881c73dc13b86318492380dc1751d12a100dcfc0, ephemeral)
validity: valid
```

```text
EVIDENCE-171  docs link/reference check
task: TASK-2026-11-26-chat-stop-generation
target_entities: MOD-DOCS
checker: scripts/check-docs-links.py (python3 3.14.4)
command: python3 scripts/check-docs-links.py
cwd: repository root
started_at / finished_at: 2026-11-26T07:42:06Z / 2026-11-26T07:42:06Z
environment: Linux x64; python3 3.14.4; git worktree
exit_code: 0 (expected 0)
result: passed
summary: 29 files, 18 links, 65 id references; ok. This record is excluded from its own manifest because the block is written after the run.
input_manifest: docs/frontend.md 69eb9a11…; the script also reads the authority docs and other task records; this record excluded
artifacts: none
validity: valid
```

## Findings from the browser run

- With a fake gateway that kept a thinking stream open, the chat showed the stop control while loading; clicking it aborted the request.
- After stopping, the transcript kept the user message, showed `已停止生成。`, restored the send button, and showed no retry or error state.
- The fake gateway observed the client disconnect; no server cancellation endpoint was called.
- The loading screenshot and the stopped screenshot were taken against a local problem with no real model or credentials.

## Risks / open questions

- Aborting the fetch only ends this client stream; the Agent may keep generating the turn server-side. There is no cancellation endpoint or cross-process cancel signal.
- Partial streamed output is discarded when stopping; only the user message and the stop notice remain. Keeping a partial reply would need a new message state and product decision.
- The stop notice uses the current mode at click time; the normal path is unchanged.
- A completed turn can still be recovered through the existing replay path; stop does not delete the durable turn ledger.
- Design status remains `draft`; no human approval yet.
