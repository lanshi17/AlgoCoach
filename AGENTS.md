# AGENTS.md — AlgoCoach repository authority

AlgoCoach is a local-first algorithm training workbench: React/Vite frontend, Java Gateway, Python Agent, Electron desktop shell, and Remotion compositions. This file is the entry contract for coding agents. Read it before editing.

## 1. Repository layout

| Path | Responsibility | Stack |
|------|----------------|-------|
| `frontend/` | All UI, workspace shell, guided learning, Monaco, local storage | React 18, Vite, TypeScript, Tailwind, Zustand, Vitest |
| `backend/gateway/` | Platform proxies (LeetCode/AcWing/HDU), Cookie storage, agent proxy | Java 21, Maven |
| `backend/agent/` | AI coach, memory, RAG, capability/tool turns | Python 3.12, pytest, ruff, mypy |
| `desktop/` | Electron packaging of the frontend | Electron |
| `remotion-compositions/` | Animated explanations (optional) | Remotion, Bun |
| `data/` | Runtime state (SQLite, Chroma, knowledge, cache) | Not source code |
| `docs/` | Design intent, architecture, module specifications | Markdown |

Module-level behavior specs live in `docs/frontend.md`, `docs/backend-agent.md`, `docs/backend-gateway.md`, `docs/architecture.md`, `docs/memory-system.md`, `docs/remotion.md`. `frontend/src/components/Layout/README.md` is the authoritative spec for the layout/panel subsystem.

## 2. Authority order

1. `AGENTS.md` (this file) — scope, boundaries, workflow.
2. `docs/intent/requirements/SPEC-BTAE.md` — design/evidence layering and state transitions.
3. `docs/architecture/engineering-protocol.md` — how to run each change type.
4. Module docs under `docs/` — current behavior and contracts.
5. Code and tests — implementation and behavior evidence.

If two sources disagree, do not guess. Verify with a read of the implementation or a runnable check and record the resolution in the task record.

## 3. Architecture boundaries (non-negotiable)

- The frontend talks only to the Java Gateway (`/api/*`, `/api/agent/*`). It never calls LeetCode GraphQL or a model provider directly.
- Platform Cookies live only in the Gateway SQLite. Never write Cookie plaintext to `localStorage`, `sessionStorage`, logs, or docs.
- User code and chat text never enter long-term memory; only judge facts, attempts, and metadata do.
- `FOCUS` mode silences every AI surface: chat panel (docked or detached), chat tab, detach control, streaming, and guided-assessment submission. Local Monaco editing stays enabled; AI autocomplete is never added.
- Local drafts, layout state, and practice records stay browser-local and are keyed per workspace with `workspaceStorageKey()`.

## 4. Change workflow

Classify the request, then follow `docs/architecture/engineering-protocol.md`:

| Type | Required before implementation | Required evidence |
|------|-------------------------------|-------------------|
| Feature | Task record with requirements, affected entities, write scope, acceptance conditions | Tests that fail without the feature, plus the commands run |
| Bugfix | Reproduction (failing test or user report quoted) | The failing case passing after the fix |
| Refactor | Baseline (tests green, behavior pinned) | Identical behavior evidence, no contract change |
| Exploration | Hypothesis and discard criteria; label prototypes | Findings, not claims of correctness |

Rules:

- Design first. Update the applicable intent/spec/module doc before or with the implementation.
- Keep the smallest logical entity set. One design record may cover many files; do not create a document per code file.
- Change only what the task requires. Do not widen scope silently; separate unrelated fixes.
- Reproduce bugs before fixing. Never "fix" a symptom by suppressing an error.
- Delete code your change makes obsolete; do not leave shims, aliases, or dead branches.
- For exported symbols, check references (`lsp` or `rg`) before changing the contract.

## 5. Task records

Write feature/bugfix/refactor records to `docs/intent/tasks/YYYY-MM-DD-<slug>.md`. Minimum fields:

```text
Task ID, type, status (draft/reviewed/approved)
Requirements (IDs), affected entities, write scope, protected paths
Design decisions and tradeoffs, dependencies
Acceptance conditions
Implementation state, verification result, evidence (commands, timestamps, fingerprints)
Risks and unknowns
```

Keep these states separate and never infer one from another:

- `draft` / `reviewed` / `approved` — design authority.
- implementation state — what exists in code.
- verification result — what a check observed.
- evidence validity — whether that evidence still matches the current code.

A green test run does not prove design conformity, and an agent's confidence does not make a record `approved`.

## 6. Commands

```bash
# frontend (from frontend/)
npx tsc --noEmit
npm run lint
npm test                 # vitest run
npm test -- src/components/Layout

# python agent (from backend/agent/)
ruff check --isolated app tests
mypy app --ignore-missing-imports --follow-imports=silent
python -m pytest -q

# java gateway (from backend/gateway/)
mvn -B test
```

Run the narrowest check that exercises the change first; run the full suite once before reporting completion. Record the exact command, result, timestamp, and environment in the task record.

## 7. Protected paths

Do not modify or read secrets from these without explicit user authorization:

- `.env`, `.env.local`, `.env.example` (template changes count as contract changes)
- `.secrets-scan-ignore`, `command.log`, `.work_logs.sh`
- `data/**` runtime databases, Chroma indexes, knowledge files, caches
- built artifacts: `frontend/dist/**`, `frontend/node_modules/**`, release bundles
- `.github/workflows/**` and release configuration

Never commit generated data, secrets, or build output.

## 8. Reporting completion

Report:

1. Changed entities and files.
2. The checks run, with real command output and timestamps — never fabricated.
3. Evidence location (task record path).
4. Unresolved risks, unknowns, or missing approvals/capabilities.
5. Any behavior that could not be verified in this environment (for example, real pointer drag or browser overflow).

Do not claim a check passed unless it was run. Do not mark a record `approved`, `passed`, or `valid` on belief alone.
