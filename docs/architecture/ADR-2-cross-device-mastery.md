# ADR-2 — cross-device mastery as a portable monotonic JSON bundle

Status: draft (proposed 2026-11-26; a human owner must approve before this is `approved`)
Related: `TASK-2026-11-26-cross-device-mastery-sync`, `ADR-1-guided-mastery-evidence`, `ADR-3-review-schedule-sync`, `docs/memory-system.md`, `docs/backend-agent.md`

## Context

Mastery lives in each device's local Agent SQLite `semantic` table. The project has no account service, cloud backend, or device identity, so "cross-device sync" cannot mean an automatic bidirectional service without inventing infrastructure and a conflict model. Devices can already export a full memory ZIP, but importing a SQLite archive would replace local evidence and is too broad for a mastery-only sync.

The useful requirement is narrower: move topic-level mastery between two local installs without losing the receiving device's stronger evidence or double-counting attempts.

## Decision

1. Add `GET /memory/mastery-export` and `POST /memory/mastery-import` under the existing Agent proxy. The bundle is `{format: "algocoach-mastery-v1", exportedAt, workspaceId, topics: [{topic, mastery, attempts, lastSeen}]}`.
2. Export reads only `semantic` rows for one workspace. It excludes episodes, review schedules, vectors, chat, code, and files.
3. Import targets the workspace in the query string. The bundle's `workspaceId` is source metadata for the UI, not the merge target, so importing into a different local workspace is explicit.
4. Merge per topic with a monotonic join: `mastery = max`, `attempts = max`, `lastSeen = later`. The operation is idempotent, commutative, and associative, so repeated imports and two-way imports converge without a clock or a server.
5. The browser validates JSON, format, field ranges, and a 5000-topic bound before POSTing; Pydantic validates again. Settings exposes download/upload and a source-workspace hint.
6. Imported topics have no local episodes, so graph co-occurrence edges, daily counts, streaks, and review schedules remain local. The UI copy states that only topic aggregates sync.

## Consequences

- Users must move a JSON file manually; there is no automatic cloud sync, account, or background replication.
- Negative evidence from another device never lowers local mastery. This is deliberate for a manual merge: a stale or weaker bundle cannot erase stronger local evidence, but a device with genuinely lower mastery after failures cannot correct the other side through this channel.
- Importing a crafted bundle can inflate mastery. Mastery is local trust data; the same trust applies to manually imported workspace exports.
- The response counts use unique topics, so a bundle with duplicate topic entries merges them before counting.
- Adding fields later requires a new bundle format or a compatible optional field; the format string is the gate.

## Alternatives rejected

- **Cloud sync service**: requires accounts, identity, hosting, and conflict resolution the local-first product does not have.
- **ZIP/SQLite import**: replaces or merges whole databases, risks local episodes and review schedules, and is not a mastery-only operation.
- **Event-log union and replay**: more accurate for negative evidence but needs portable episode ids, dedupe across devices, and recomputation; a possible future upgrade.
- **Last-writer-wins by `lastSeen`**: a stale device could lower mastery and overwrite attempts; it is not order-independent.
- **Summing attempts**: double-counts evidence each time a bundle is re-imported.
