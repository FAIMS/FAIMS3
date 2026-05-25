# Load Test Agents

Playwright-based browser workers. Each Docker container runs a supervisor (`worker.ts`) that forks N child processes (`browser-session.ts`), one Chromium instance each.

## Scenarios

| File | Phase |
|------|-------|
| `scenarios/onboarding.ts` | Registration, notebook activation |
| `scenarios/offline-collection.ts` | Offline record creation loop |
| `scenarios/sync-storm.ts` | Staggered reconnect + sync wait |
| `scenarios/export-stress.ts` | API export (when `PARTICIPATE_IN_EXPORT=true`) |

## data-testid contract

Agents rely on these stable selectors in the collection app:

| testid | Element |
|--------|---------|
| `notebook-activate-button` | Activate notebook button |
| `notebook-activate-confirm` | Activation dialog confirm |
| `add-record-button` | Add new record |
| `save-record-indicator` | "Saved" indicator after debounced save |
| `sync-status-icon` | Sync status cloud button |
| `sync-status-syncing` | Present while sync in progress |
| `sync-status-idle` | Present when sync idle |

## Run single agent locally

```bash
cd load-testing/agents
cp .env.example .env
# Edit INVITE_CODE, NOTEBOOK_PROJECT_ID, and URLs

pnpm run install-browsers   # first time only
pnpm run dev
```

## Environment

Copy [`.env.example`](.env.example) to `.env` in this directory. For Docker Compose, use [`../.env.example`](../.env.example) in the parent folder instead.
