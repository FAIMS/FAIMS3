# Sequence plans

Composable load-test scenarios for the DASS coordinator + agents.

Plans are **Zod-validated JSON** (`@faims3/load-testing-shared` → `sequence-plan.ts`). The coordinator **requires** a plan at startup; there is no legacy fixed-phase mode.

## Env variables

| Variable | Where | Format |
|----------|-------|--------|
| `SEQUENCE_PLAN` | Coordinator | Compact JSON string |
| `SEQUENCE_PLAN_B64` | Coordinator (ECS) | Base64-encoded JSON |
| `SEQUENCE_PLAN_FILE` | Coordinator local dev | Path to `.json` file |
| `SEQUENCE_PLAN_FILE` | `run-load-test.sh` | Path encoded and passed as `SEQUENCE_PLAN_B64` |

```bash
# Encode for manual ECS overrides
export SEQUENCE_PLAN_B64="$(base64 -w0 load-testing/shared/sequence-plans/long-offline-loop.json)"

# AWS run script (reads file → base64 → coordinator task)
SEQUENCE_PLAN_FILE=../shared/sequence-plans/long-offline-loop.json ./run-load-test.sh
```

## Step types

### Phase steps (`kind`)

| Kind | Behaviour |
|------|-----------|
| `onboarding` | Login with coordinator-assigned account, activate notebook. Advances when all agents done. |
| `online_collection` | Stay online; create records every `config.recordIntervalMs`. |
| `offline_collection` | Go offline, create records, reconnect with jitter, wait for sync. |
| `patchy_network` | Toggle offline/online on jittered cycles while surveying. |
| `export_stress` | Optional CSV export via API (`participateFraction` or agent env). |

Each phase supports `durationMs` + `advance` (`timer`, `all_agents_done`, `majority_done`, `timer_or_all_done`).

### Structural steps

| Node | Purpose |
|------|---------|
| `loop` | Repeat nested `steps` `count` times (e.g. online → offline × N). |
| `split` | Run different sub-plans in parallel for agent subsets (50/50 online/offline). |

### Splits

```json
{
  "id": "mixed",
  "split": {
    "assignment": "agent_index_mod",
    "branches": [
      { "id": "online", "weight": 1, "steps": […] },
      { "id": "offline", "weight": 1, "steps": […] }
    ]
  },
  "advance": "all_agents_done"
}
```

- **`agent_index_mod`** — deterministic by registration order (recommended).
- **`hash_agent_id`** — stable hash of `agentId`.
- **`random`** — coordinator assigns at register time (`seed` optional).

`weight` sets branch proportion (two branches with weight `1` → ~50/50).

## Bundled examples

| File | Description |
|------|-------------|
| `legacy-default.json` | Short onboarding → offline+sync → export |
| `online-offline-loops-patchy.json` | Onboarding → 2×(online → offline) → patchy |
| `long-offline-loop.json` | 5min online/offline cycles + 10min patchy |
| `split-online-patchy-loops.json` | 5×(2min 50/50 online vs patchy) + 4min all online |
| `split-online-offline.json` | 50/50 split then patchy |

## Metrics

Prometheus labels use **`stepId`** (plan step `id`) instead of the old phase enum. Coordinator pushes `dass_run_state` and `dass_step_transition_timestamp`.
