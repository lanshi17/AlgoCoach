# ADR-4 — automatic device sync through an optional authenticated hub

Status: draft (proposed 2026-11-26; a human owner must approve before this is `approved`)
Related: `TASK-2026-11-26-automatic-device-sync`, `ADR-2-cross-device-mastery`, `ADR-3-review-schedule-sync`, `docs/memory-system.md`, `docs/backend-agent.md`

## Context

ADR-2 and ADR-3 made mastery and review schedules portable as a v2 JSON bundle, but the learner had to move the file between devices. There is no account service, device identity, or hosted backend. Automatic sync therefore needs a shared endpoint that both installs can reach, plus a way to keep strangers on the network out.

## Decision

1. Add `POST /memory/sync` on the Agent. It accepts the same v2 bundle, merges it into the target workspace with the existing mastery/schedule rules, and returns the merged full bundle.
2. Disable the endpoint unless `ALGOCOACH_SYNC_TOKEN` is set. Requests must present `X-AlgoCoach-Sync-Token`; a missing token returns 503, a wrong token 403. Compare with `hmac.compare_digest`; never echo the token.
3. Proxy the route through the Gateway and forward only the sync token header in addition to the existing content type/authorization. Cross-origin browser calls require the hub Gateway to include the page origin in `ALGOCOACH_ALLOWED_ORIGINS`.
4. The frontend stores `enabled`, `hubUrl`, and `token` in localStorage. When enabled, it exports the local v2 bundle, posts it to the hub, validates the returned bundle, and imports it into the local Agent. The same merge rules apply, so push/pull converges without cursors.
5. Run automatically on mount, every 60 seconds while the page is visible, when visibility returns, and on `online`. Requests time out after 12 seconds; overlapping runs share one in-flight promise. Background failures are silent; the Settings page exposes the last manual result.
6. A device and the hub may be the same Agent. In that case the local export already equals the hub state and the exchange is a no-op; devices that point at another hub still converge.
7. Keep the manual bundle path unchanged. Automatic sync is an optional transport, not a replacement for offline export/import.

## Consequences

- Both devices must reach the same hub and use the same workspace ID. The token is a shared secret; there is no per-device identity or revocation.
- The hub exposes only mastery and review aggregates through this endpoint, not chat, code, cookies, or the full memory archive. The token still grants read/write access to those aggregates to anyone who has it.
- Polling creates background traffic every minute while the app is open; there is no push channel. A long offline period simply retries later.
- Conflict behavior is unchanged: topics max-merge, schedules last-writer-wins by `updatedAt`. Clock skew remains a risk.
- A compromised or malicious hub can return an arbitrary valid bundle and change local mastery/due dates; this is the same local trust model as importing a file, narrowed to authenticated sync.
- The endpoint is not a cloud service. Hosting, TLS, network exposure, backups, and token rotation remain the operator's job.

## Alternatives rejected

- **Hosted cloud with accounts**: requires identity, authorization, data hosting, and a conflict service the product does not have.
- **Peer-to-peer discovery**: needs LAN discovery, pairing, and per-peer authentication; a shared hub is simpler and works across subnets.
- **Watching a shared folder**: browser support is limited to Chromium's File System Access API and requires a desktop-specific implementation.
- **Point every device at one remote Agent for all APIs**: would expose chat, knowledge uploads, and settings, not only sync aggregates.
- **Unauthenticated hub**: would let any host on the LAN read or rewrite mastery and due dates.
