# ADR-1 — guided stage passes as a separate mastery evidence class

Status: draft (proposed 2026-11-25; a human owner must approve before this is `approved`)
Related: `TASK-2026-11-25-guided-mastery-sync`, `SPEC-BTAE`, `docs/memory-system.md`, `docs/backend-agent.md`

## Context

Guided learning already persists its lesson locally, but a passed stage never reached the Agent's semantic mastery. The Agent updates mastery from `POST /memory/record`: `ACCEPTED` and `LOCAL_ACCEPTED` add `+0.05`, every other status subtracts `0.08`, and the self-improvement replay reconstructs the same rule from episodic rows.

Guided passes are not judge results. A choice stage has a deterministic `[[答案:X]]` check, while short-answer and code stages rely on the coach's `[[评价:通过]]`. Reusing `LOCAL_ACCEPTED` would overstate model-reviewed evidence and would collide with the existing replay rule, which only recognized `ACCEPTED` (`LOCAL_ACCEPTED` already diverged). Not syncing leaves the documented "跨会话掌握度同步" gap open.

## Decision

1. Add the status `GUIDED_ACCEPTED`, used only for a passed guided stage.
2. The live mastery step is `+0.03` — smaller than a judge or local-run acceptance (`+0.05`) because the evidence is coach-reviewed.
3. Both the live update and `self_improve._replay_mastery` use one shared `mastery_delta(status)` helper. The replay also starts recognizing `LOCAL_ACCEPTED` at `+0.05`, fixing its divergence from live behavior.
4. A guided pass is not due material for the review schedule: `_episode_is_due_material` treats `GUIDED_ACCEPTED` like an accepted attempt without sticking points.
5. The frontend records only passed answer-bearing stages (`choice`, `short`, `code`), once per `workspace + conversationId + stageId`. The deterministic `client_id` makes retries and reloads idempotent at the Agent receipt table.
6. The browser keeps a per-workspace queue. Offline events survive a reload and flush on the next page open; only topic, stage id, language, and elapsed seconds are sent — no chat text or code.
7. Stage ids are preserved by `normalizePlan` during restore so a saved outline does not mint new client ids after a reload.

## Consequences

- Guided mastery moves more slowly than judge evidence, and the knowledge graph shows the topic after the first pass.
- The Agent contract gains one status value; any future status must go through `mastery_delta` or the replay will diverge again.
- Backtests for existing `LOCAL_ACCEPTED` episodes change from `-0.08` to `+0.05`, matching what the live service had already been doing.
- The queue is workspace-scoped localStorage; clearing browser data drops unsent evidence. There is no cross-device sync.
- A model-judged pass can still be wrong; the smaller delta limits, but does not eliminate, that risk.

## Alternatives rejected

- **Reuse `LOCAL_ACCEPTED`**: conflates local sample runs with coach opinions and inherits the replay mismatch.
- **Reuse `ACCEPTED`**: implies a judge acceptance that did not happen.
- **No Agent sync / local-only ledger**: leaves mastery invisible to the existing knowledge graph and mastery path, which read Agent semantic memory.
- **A new endpoint**: the existing `/memory/record` contract already carries topic, duration, status, and an idempotency key.
