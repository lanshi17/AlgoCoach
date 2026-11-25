# AlgoCoach Agent Charter

Scope: AlgoCoach is a local-first algorithm training workbench — React/Vite frontend, Java gateway, Python agent, Electron desktop shell, and optional Remotion compositions. This file is the agent entrypoint. Behavior specs live in `docs/*.md`; the protocol lives in [SPEC-BTAE](docs/intent/requirements/SPEC-BTAE.md) and the [engineering protocol](docs/architecture/engineering-protocol.md). It does not grant approval, write isolation, or host trust.

Tooling: `repo-native` — the BTAE MCP server and EPE CLI are not installed here. Use `docs/intent/tasks/` as the planning record and the repository commands below as validation.

## Repository map

| Area | Path | Notes |
|------|------|-------|
| Frontend | `frontend/` | React 18, Vite, TypeScript, Tailwind, Zustand, Monaco, Vitest |
| Gateway | `backend/gateway/` | Java 21, Maven; platform proxies, Cookie storage, agent proxy |
| Agent | `backend/agent/` | Python 3.12; coach, memory, RAG, capability/tool turns |
| Desktop | `desktop/` | Electron packaging of the frontend |
| Animations | `remotion-compositions/` | Optional Remotion videos |
| Runtime data | `data/` | SQLite, Chroma, knowledge, caches — not source |
| Design docs | `docs/` | Architecture and module specifications |
| Layout spec | [frontend/src/components/Layout/README.md](frontend/src/components/Layout/README.md) | Authoritative for the layout subsystem |

## Authoritative commands

Run in the directory named; commands here override ecosystem defaults. If a command is absent, say so instead of inventing one.

| Purpose | Directory | Command |
|---------|-----------|---------|
| Frontend types | `frontend/` | `npx tsc --noEmit` |
| Frontend lint | `frontend/` | `npm run lint` |
| Frontend tests | `frontend/` | `npm test` (narrow: `npx vitest run <file>`) |
| Agent lint | `backend/agent/` | `ruff check --isolated app tests` |
| Agent types | `backend/agent/` | `mypy app --ignore-missing-imports --follow-imports=silent` |
| Agent tests | `backend/agent/` | `python -m pytest -q` |
| Gateway tests | `backend/gateway/` | `mvn -B test` |

Install/run details are in `README.md` and `docker-compose.yml`; do not run installs or services unless the task requires them.

## Boundaries

- The frontend talks only to the Java gateway (`/api/*`, `/api/agent/*`). It never calls LeetCode GraphQL or a model provider directly.
- Platform Cookies live only in gateway SQLite. Never write Cookie plaintext to `localStorage`, `sessionStorage`, logs, or docs.
- User code and chat text never enter long-term memory; only judge facts, attempts, and metadata do.
- `FOCUS` silences every AI surface: chat panel (docked or detached), chat tab, detach control, streaming, and guided assessment submission. Local Monaco editing stays enabled; no AI autocomplete.
- Local drafts, layout state, and practice records stay browser-local and are keyed per workspace with `workspaceStorageKey()`.

Protected paths requiring explicit user authorization: `.env`, `.env.local`, `.env.example`, `.secrets-scan-ignore`, `command.log`, `.work_logs.sh`, `data/**`, `frontend/dist/**`, `frontend/node_modules/**`, release artifacts, `.github/workflows/**`.

Forbidden without authorization: secrets in the tree, destructive git operations, production data access, network side effects outside the task.

## Workflow and evidence

- Classify work as feature / bugfix / refactor / exploration / adoption, and assign tier T1 / T2 / T3 (`docs/architecture/engineering-protocol.md`).
- Design first for T2/T3: update the task record and the applicable spec before editing. T1 needs a reproduction and one check.
- Record the exact command, cwd, UTC start/end, exit code, environment, result, and input fingerprint. `passed` is a recorded fact, not an opinion.
- Never write `approved`, sign an approval, or mark evidence `valid` on the user's behalf. Keep design (`draft/reviewed/approved`), implementation (`not_started/in_progress/implemented`), verification (`pending/passed/failed`), and evidence (`valid/stale/invalid/unknown`) separate.
- A green test count does not prove design conformity. Report "planned", "ran locally", and "CI-enforced" distinctly.
- If fingerprinted inputs change after a run, keep the historical result and mark the evidence `stale`; re-run to produce new evidence.

## Conventions

- Entity IDs: `REQ-<area>-<n>`, `SPEC-<n>`, `MOD-<module>`, `CONTRACT-<name>`, `TASK-YYYY-MM-DD-<slug>`, `EVIDENCE-<n>`, `ADR-<n>`. Stable English strings; titles may be Chinese.
- Plans and task records live in `docs/intent/tasks/`; reuse an existing record before creating one. No scaffolds and no per-file documents.
- Commits contain only declared-scope files. A whole-worktree commit needs explicit user confirmation; never `git add -A`.
- New `*.md` files are ignored by default (`*.md`, with `!README.md`, `!AGENTS.md`, `!docs/**/*.md`). Verify a new authority document is tracked with `git check-ignore -v <path>` before relying on it.
