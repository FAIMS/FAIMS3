# DASS Load Testing Framework

Distributed browser-based load testing for the FAIMS3 collection app (`app/`). Coordinates Playwright agents, collects browser and CouchDB metrics, and surfaces results in Grafana.

## Prerequisites

- Docker and Docker Compose
- Node.js 22 and pnpm (for local development)
- FAIMS stack running (local or staging)
- `LOCAL_LOGIN_ENABLED` for automated registration scenarios
- Multi-use project invite (`usesOriginal >= AGENT_COUNT * SESSIONS_PER_AGENT`)

## Quick start (local)

1. Start FAIMS: `./localdev.sh` or `docker compose up -d` (couchdb, api, app).
2. Migrate and load a demo notebook; create a multi-use invite in web admin.
3. Configure load test:

```bash
cd load-testing
cp .env.example .env
# Edit INVITE_CODE, NOTEBOOK_PROJECT_ID, URLs
```

For local dev without Docker, use package-specific env files instead:

```bash
cp coordinator/.env.example coordinator/.env
cp agents/.env.example agents/.env
```

4. Run:

```bash
make test
```

5. Open Grafana: http://localhost:3030 (anonymous admin enabled).

## Quick start (staging)

Point `.env` at staging `DASS_APP_URL`, `DASS_API_URL`, and `COUCH_URL`. Run the compose stack on a load-generator host with sufficient RAM (32GB+ for ~150 concurrent sessions).

## Phase model

| Phase | Behaviour |
|-------|-----------|
| WAITING_FOR_AGENTS | Agents register and signal ready |
| ONBOARDING | Register/login, activate notebook, initial sync |
| OFFLINE_COLLECTION | Simulated offline record creation |
| SYNC_STORM | Staggered reconnection and sync |
| EXPORT_STRESS | Optional API export (subset of agents) |
| COMPLETE | Test finished |

## Configuration

| File | Use |
|------|-----|
| [`.env.example`](.env.example) | Docker Compose / `make test` |
| [`coordinator/.env.example`](coordinator/.env.example) | Local coordinator dev |
| [`agents/.env.example`](agents/.env.example) | Local agent dev |

Key variables:

- `AGENT_COUNT` / `SESSIONS_PER_AGENT` — scale via `make test AGENT_COUNT=5`
- `INVITE_CODE` — project invite short code
- `NOTEBOOK_PROJECT_ID` — notebook to activate
- `OFFLINE_DURATION_MS` — agent offline record loop (agents package)
- `OFFLINE_COLLECTION_DURATION_MS` — coordinator timer before SYNC_STORM

## Local dev without Docker

```bash
pnpm install
pnpm build-load-testing

# Terminal 1 — coordinator
cd load-testing/coordinator && cp .env.example .env && pnpm run dev

# Terminal 2 — agent
cd load-testing/agents && cp .env.example .env && pnpm run install-browsers && pnpm run dev
```

## Limitations

- Collection app (web/PWA) only — not native iOS/Android
- Requires local login or pre-seeded users on SSO-only environments

## Package layout

| Package | Purpose |
|---------|---------|
| `@faims3/instrumentation` | Shared `dass.*` performance marks |
| `@faims3/load-testing-shared` | API schemas, coordinator client |
| `@faims3/load-testing-coordinator` | Hono coordinator + Prometheus |
| `@faims3/load-testing-agents` | Playwright workers |

See also: [coordinator/README.md](coordinator/README.md), [agents/README.md](agents/README.md), [observability/README.md](observability/README.md).
