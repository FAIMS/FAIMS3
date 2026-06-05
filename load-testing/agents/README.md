# Load Test Agents

Playwright-based browser workers. Each container runs a supervisor (`worker.ts`) that forks N child processes (`browser-session.ts`), one Chromium instance each.

Agents execute the coordinator **sequence plan** by polling `GET /step?agentId=` and reporting `POST /step-complete`.

## Scenarios

| File | Step kind |
|------|-----------|
| `scenarios/onboarding.ts` | `onboarding` (login via coordinator `/credentials`) |
| `scenarios/online-collection.ts` | `online_collection` |
| `scenarios/offline-collection.ts` | `offline_collection` (includes reconnect + sync) |
| `scenarios/patchy-network.ts` | `patchy_network` |
| `scenarios/export-stress.ts` | `export_stress` |
| `scenarios/record-collection.ts` | Shared record-creation loop |

Timing and loops are defined in the sequence plan JSON — see `../shared/sequence-plans/`.

## Development

```bash
cd load-testing/coordinator
cp .env.example .env   # includes SEQUENCE_PLAN_FILE
pnpm run dev

cd load-testing/agents
cp .env.example .env
pnpm run install-browsers
pnpm run dev
```
