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
- `LOCAL_LOGIN_ENABLED` for automated login during onboarding
- Pre-seeded load-test users in CouchDB (see **Account pool** below)

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
# Edit EXPECTED_AGENT_COUNT, LOAD_TEST_ACCOUNTS, sequence plan
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
# Edit NOTEBOOK_PROJECT_ID, URLs, COORDINATOR_URL
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
| ONBOARDING | Login (coordinator-assigned account), activate notebook, initial sync |
| OFFLINE_COLLECTION | Simulated offline record creation |
| SYNC_STORM | Staggered reconnection and sync |
| EXPORT_STRESS | Optional API export (subset of agents) |
| COMPLETE | Test finished |

## Configuration

| File | Variables |
|------|-----------|
| [`load-testing/.env.example`](.env.example) | CouchDB exporter + observability ports |
| [`coordinator/.env.example`](coordinator/.env.example) | Port, agent count, phase timers, pushgateway |
| [`agents/.env.example`](agents/.env.example) | FAIMS URLs, browser, notebook targets |
| [`scripts/.env.example`](scripts/.env.example) | AWS run + `LOAD_TEST_ACCOUNTS` for coordinator |

### Account pool

1. Seed users (no migrations): `./scripts/seed-load-test-accounts.sh` — prints `LOAD_TEST_ACCOUNTS=email::password,...` (requires an already-initialised CouchDB). Use `::` between email and password in `.env` — unquoted `||` breaks when bash sources the file.
2. Set that line on the **coordinator** (and `scripts/.env` for `run-load-test.sh`)
3. Each agent calls `GET /credentials?agentId=` once during onboarding; assignments are sticky per agent (round-robin across the pool)

Use **at most one agent per account** (`AGENT_COUNT` ≤ account count) to avoid concurrent edits on the same user.

Key timing relationship: coordinator `OFFLINE_COLLECTION_DURATION_MS` should be ≥ agent `OFFLINE_DURATION_MS`.

## Limitations

- Collection app (web/PWA) only — not native iOS/Android
- Requires local login or pre-seeded users on SSO-only environments

See also: [coordinator/README.md](coordinator/README.md), [agents/README.md](agents/README.md), [observability/README.md](observability/README.md), [infra/README.md](infra/README.md) (AWS CDK deployment).
