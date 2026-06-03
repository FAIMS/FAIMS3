# Load Test Coordinator

Hono HTTP server that registers agents, sequences test phases, and forwards metrics to Prometheus Pushgateway.

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness probe |
| POST | `/register` | Register agent `{ agentId, sessionCount, workerId }` |
| POST | `/ready` | Agent ready `{ agentId }` |
| GET | `/phase` | Current phase `{ phase, advancedAt, testRunId }` |
| POST | `/report` | Metric report (see `@faims3/load-testing-shared`) |
| POST | `/phase-complete` | Phase done `{ agentId, phase, sessionCount }` |
| GET | `/status` | Human-readable run status |
| GET | `/metrics` | Prometheus metrics (coordinator gauges) |

## Phase advance strategies

Set `PHASE_ADVANCE_STRATEGY`:

- `all_ready` (default) — all agents must report ready/complete
- `majority` — >50% of agents
- `timeout` — advance after `PHASE_TIMEOUT_MS`

Timer-based phases (`OFFLINE_COLLECTION`, `EXPORT_STRESS`) advance on configured durations regardless of agent reports.

## Development

```bash
cd load-testing/coordinator
cp .env.example .env
pnpm run dev
```

## Docker

Build from the monorepo root:

```bash
docker build -f load-testing/coordinator/Dockerfile -t load-test-coordinator .
docker run --env-file load-testing/coordinator/.env -p 4000:4000 \
  -e PROMETHEUS_PUSHGATEWAY_URL=http://host.docker.internal:9091 \
  --add-host=host.docker.internal:host-gateway \
  load-test-coordinator
```

## Environment

All coordinator settings live in [`.env.example`](.env.example). Parsed by `src/config.ts` (`CoordinatorEnvSchema`).

When running with the observability stack, set `PROMETHEUS_PUSHGATEWAY_URL=http://localhost:9091` (or `host.docker.internal` from inside Docker).
