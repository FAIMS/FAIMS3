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

Agents prefer these stable selectors when the instrumented app build is deployed.
`src/selectors.ts` also provides **label/role fallbacks** so load tests can run
against older dev stacks (main) that lack the test ids — remove those fallbacks
once dev runs this branch.

| testid | Element | Fallback (main branch) |
|--------|---------|------------------------|
| `notebook-activate-button` | Activate notebook button | `button` named "Activate" |
| `notebook-activate-confirm` | Activation dialog confirm | dialog `button` named "Activate" |
| `add-record-button` | Add new record | `button` matching `/add new/i` |
| `save-record-indicator` | "Saved" after debounced save | text "Saved" |
| `sync-status-icon` | Sync cloud control | first button in `#app-bar` toolbar trailing cluster |
| `sync-status-syncing` / `sync-status-idle` | Sync state markers | sync status popover table |
| `nav-button-finish*` | Finish record | `button` matching `/^Finish /i` |
| `finish-anyway-button` | Incomplete-form confirm | `button` named "Finish anyway" |

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
