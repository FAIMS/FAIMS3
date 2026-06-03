# Load Test Agents

Playwright-based browser workers. Each container runs a supervisor (`worker.ts`) that forks N child processes (`browser-session.ts`), one Chromium instance each.

## Scenarios

| File | Phase |
|------|-------|
| `scenarios/onboarding.ts` | Registration, notebook activation |
| `scenarios/offline-collection.ts` | Offline record creation loop |
| `scenarios/sync-storm.ts` | Staggered reconnect + sync wait |
| `scenarios/export-stress.ts` | API export (when `PARTICIPATE_IN_EXPORT=true`) |

## data-testid contract

Agents rely on these stable selectors in the collection app:

| testid | Element |
|--------|---------|
| `notebook-activate-button` | Activate notebook button |
| `notebook-activate-confirm` | Activation dialog confirm |
| `add-record-button` | Add new record |
| `save-record-indicator` | "Saved" indicator after debounced save |
| `sync-status-icon` | Sync status cloud button |
| `sync-status-syncing` | Present while sync in progress |
| `sync-status-idle` | Present when sync idle |

## Development

```bash
cd load-testing/agents
cp .env.example .env
# Edit INVITE_CODE, NOTEBOOK_PROJECT_ID, and URLs

pnpm run install-browsers   # first time only
pnpm run dev
```

## Docker

Build from the monorepo root:

```bash
docker build -f load-testing/agents/Dockerfile -t load-test-agent .
docker run --env-file load-testing/agents/.env \
  --shm-size=2g --add-host=host.docker.internal:host-gateway \
  load-test-agent
```

When running in Docker, point URLs at the host machine (`host.docker.internal`).

## Environment

All agent settings live in [`.env.example`](.env.example). Parsed by `src/config.ts` (`AgentEnvSchema`).

Runtime identity (`WORKER_ID`, `AGENT_ID`, `SESSION_INDEX`) is set by the worker process — not in `.env`.
