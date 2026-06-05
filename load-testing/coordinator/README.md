# Load Test Coordinator

Hono HTTP server that registers agents, executes a **sequence plan**, and forwards metrics to Prometheus Pushgateway.

## Plan loading

The coordinator must load a validated sequence plan at startup. Configure **one** source:

| Variable | Format | Typical use |
|----------|--------|-------------|
| `SEQUENCE_PLAN_S3_URI` | `s3://bucket/plans/name.json` | AWS ECS (via `run-load-test.sh`) |
| `SEQUENCE_PLAN_FILE` | Filesystem path | Local `pnpm run dev` |
| `SEQUENCE_PLAN` | Compact JSON string | Tests / tiny plans |
| `SEQUENCE_PLAN_B64` | Base64-encoded JSON | Legacy ECS override (size-limited) |

Precedence: S3 URI → inline/base64 → file. On AWS, the coordinator task role has `s3:GetObject` on the stack’s sequence-plans bucket.

Also requires `LOAD_TEST_ACCOUNTS` (pre-seeded user pool).

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness probe |
| POST | `/register` | Register agent `{ agentId, sessionCount, workerId }` |
| GET | `/credentials?agentId=` | Assign pre-seeded `username` / `password` (sticky per agent) |
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
