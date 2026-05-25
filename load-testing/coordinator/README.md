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

## Environment

Copy [`.env.example`](.env.example) to `.env` in this directory. For Docker Compose, use [`../.env.example`](../.env.example) in the parent folder instead.
