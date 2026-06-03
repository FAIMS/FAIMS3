# DASS Load Testing Framework

Distributed browser-based load testing for the FAIMS3 collection app. Two self-contained packages — coordinator and agents — plus a shared observability stack.

## Layout

| Path | Purpose |
|------|---------|
| [`coordinator/`](coordinator/) | Phase sequencer, agent registry, metrics push |
| [`agents/`](agents/) | Playwright browser workers |
| [`shared/`](shared/) | HTTP API schemas and coordinator client (no env config) |
| [`observability/`](observability/) | Prometheus, Grafana, Pushgateway configs |
| [`docker-compose.yml`](docker-compose.yml) | Observability stack only |

Each package has its own `.env.example`, config parser (Zod), and `Dockerfile`.

## Prerequisites

- Docker and Docker Compose (for observability)
- Node.js 22 and pnpm (for local development)
- FAIMS stack running (local or staging)
- `LOCAL_LOGIN_ENABLED` for automated registration scenarios
- Multi-use project invite (`usesOriginal >= agent count × sessions per agent`)

## Quick start

### 1. Observability stack

```bash
cd load-testing
cp .env.example .env
make observability
```

Grafana: http://localhost:3030 (anonymous admin enabled).

### 2. Coordinator

```bash
cd load-testing/coordinator
cp .env.example .env
# Edit EXPECTED_AGENT_COUNT, phase timers
pnpm run dev
```

Or with Docker (from monorepo root):

```bash
make -C load-testing build-coordinator
docker run --env-file load-testing/coordinator/.env -p 4000:4000 \
  -e PROMETHEUS_PUSHGATEWAY_URL=http://host.docker.internal:9091 \
  --add-host=host.docker.internal:host-gateway \
  load-test-coordinator
```

### 3. Agents

```bash
cd load-testing/agents
cp .env.example .env
# Edit INVITE_CODE, NOTEBOOK_PROJECT_ID, URLs
pnpm run install-browsers   # first time only
pnpm run dev
```

Or with Docker (from monorepo root):

```bash
make -C load-testing build-agent
docker run --env-file load-testing/agents/.env \
  --shm-size=2g --add-host=host.docker.internal:host-gateway \
  load-test-agent
```

Set `EXPECTED_AGENT_COUNT` on the coordinator to match how many agent containers you run.

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

| File | Variables |
|------|-----------|
| [`load-testing/.env.example`](.env.example) | CouchDB exporter + observability ports |
| [`coordinator/.env.example`](coordinator/.env.example) | Port, agent count, phase timers, pushgateway |
| [`agents/.env.example`](agents/.env.example) | FAIMS URLs, invite, browser, scenario timing |

Key timing relationship: coordinator `OFFLINE_COLLECTION_DURATION_MS` should be ≥ agent `OFFLINE_DURATION_MS`.

## Limitations

- Collection app (web/PWA) only — not native iOS/Android
- Requires local login or pre-seeded users on SSO-only environments

See also: [coordinator/README.md](coordinator/README.md), [agents/README.md](agents/README.md), [observability/README.md](observability/README.md), [infra/README.md](infra/README.md) (AWS CDK deployment).
