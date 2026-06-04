# Load Test Coordinator

Hono HTTP server that registers agents, executes a **sequence plan**, and forwards metrics to Prometheus Pushgateway.

Requires `SEQUENCE_PLAN`, `SEQUENCE_PLAN_B64`, or `SEQUENCE_PLAN_FILE` at startup.

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness probe |
| POST | `/register` | Register agent `{ agentId, sessionCount, workerId }` |
| POST | `/ready` | Agent ready `{ agentId }` |
| GET | `/step?agentId=` | Current plan step for agent |
| POST | `/step-complete` | Step done `{ agentId, stepId, sessionCount }` |
| POST | `/report` | Metric report (includes `stepId` label) |
| POST | `/agent-done` | Agent finished all steps |
| GET | `/status` | Run status + active steps per agent |
| GET | `/metrics` | Coordinator Prometheus metrics |

## Development

```bash
cd load-testing/coordinator
cp .env.example .env
pnpm run dev
```

See `../shared/sequence-plans/` for example plans.
