# ADR-3 — review schedules travel with the mastery bundle using last-writer-wins

Status: draft (proposed 2026-11-26; a human owner must approve before this is `approved`)
Related: `TASK-2026-11-26-review-schedule-sync`, `ADR-2-cross-device-mastery`, `docs/memory-system.md`, `docs/backend-agent.md`

## Context

ADR-2 added a portable `algocoach-mastery-v1` bundle containing only topic aggregates. Review schedules stayed device-local, so two devices could agree on mastery while disagreeing on what is due, which items are scheduled, and when. The review state is not monotonic: a learner can pass a review and push `dueAt` forward, or fail and pull it back. A max-based merge would be wrong.

## Decision

1. Export a `algocoach-mastery-v2` bundle that adds `reviewSchedules: [{problemId, dueAt, intervalDays, mastery, attempts, topics, updatedAt}]` beside the existing topics.
2. Import per `problemId` with last-writer-wins by `updatedAt`: the newer state replaces `dueAt`, `intervalDays`, `mastery`, `attempts`, and `topics`. Equal timestamps keep the local state.
3. Keep notification fields (`notified_on`, `last_notified_at`) local on update. They are device-specific push state; importing them could suppress a legitimate reminder or duplicate one.
4. Clear `source_episode_id` on imported/updated rows. A remote episode id has no local row.
5. Accept `algocoach-mastery-v1` bundles for backward compatibility (topics only); export always writes v2.
6. Return separate counts for imported/updated/unchanged topics and schedules so the Settings message can distinguish them.
7. Validate schedule timestamps as ISO-8601, interval days 1–3650, mastery 0–1, attempts 0–1e6, and at most 50 topics per schedule in both the browser and Pydantic.

## Consequences

- The latest review state wins, including a later `dueAt` that moves backward. This is intentional; the alternative (monotonic due dates) would prevent failures from rescheduling.
- Clock skew between devices can make a stale state look newer. Timestamps come from the Agent's UTC clock; the manual workflow has no trusted time source.
- Imported schedules may refer to problems absent from local episodic history, so the graph has no co-occurrence edge; the due queue and mastery path still use the schedule's topics.
- A local episode refresh after import can overwrite the imported state with newer local evidence, which is correct for this device and will be exported next time.
- The bundle grows with schedule count; both sides bound it at 5000 entries.

## Alternatives rejected

- **Keep schedules device-local**: leaves the daily review queue inconsistent across devices, the gap this task closes.
- **Merge by max `dueAt`**: a failed review could never pull the schedule forward; it also cannot arbitrate interval/mastery.
- **Merge by due date or mastery**: conflates scheduling with evidence and is not order-independent.
- **Import remote notification state**: risks suppressing or duplicating pushes on the receiving device.
- **Import `source_episode_id`**: remote episode ids do not exist in the local database.
