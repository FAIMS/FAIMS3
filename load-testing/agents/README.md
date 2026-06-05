# Load Test Agents

Playwright-based browser workers. Each container runs a supervisor (`worker.ts`) that forks N child processes (`browser-session.ts`), one Chromium instance each.

Agents execute the coordinator **sequence plan** by polling `GET /step?agentId=` and reporting `POST /step-complete`. They do **not** load plan JSON — all sequencing is coordinator-side.

## Configuration

Agents only need FAIMS URLs, notebook targets, and `COORDINATOR_URL`. Timing, loops, and splits are defined in the coordinator’s sequence plan.

| Variable | Purpose |
|----------|---------|
| `COORDINATOR_URL` | Base URL for register / step / report APIs |
| `DASS_APP_URL`, `DASS_API_URL`, `COUCH_URL` | Target environment |
| `NOTEBOOK_PROJECT_ID`, `NOTEBOOK_SERVER_ID`, `NOTEBOOK_NAME` | Survey notebook |
| `PARTICIPATE_IN_EXPORT` | Opt-in for `export_stress` steps |
| `SESSIONS_PER_AGENT` | Browser sessions per worker process |

Plan source variables (`SEQUENCE_PLAN_*`) belong on the **coordinator**, not agents.

## Scenarios

| File | Step kind |
|------|-----------|
| `scenarios/onboarding.ts` | `onboarding` (login via coordinator `/credentials`) |
| `scenarios/online-collection.ts` | `online_collection` |
| `scenarios/offline-collection.ts` | `offline_collection` (includes reconnect + sync) |
| `scenarios/patchy-network.ts` | `patchy_network` |
| `scenarios/export-stress.ts` | `export_stress` |
| `scenarios/record-collection.ts` | Shared record-creation loop |

Step kinds and durations are declared in plan JSON — see `../shared/sequence-plans/`.

## Development

```bash
cd load-testing/coordinator
cp .env.example .env   # SEQUENCE_PLAN_FILE for local plan
pnpm run dev

cd load-testing/agents
cp .env.example .env
pnpm run install-browsers
pnpm run dev
```
