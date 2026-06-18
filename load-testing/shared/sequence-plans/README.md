# Sequence plans

Composable load-test scenarios for the FAIMS coordinator + agents.

Plans are **Zod-validated JSON** (`@faims3/load-testing-shared` → `sequence-plan.ts`). The coordinator **requires** a plan at startup; there is no legacy fixed-phase mode. Agents receive individual steps over HTTP and do not read these files directly.

## Delivering a plan to the coordinator

| Variable | Where | Format |
|----------|-------|--------|
| `SEQUENCE_PLAN_S3_URI` | Coordinator (AWS ECS) | `s3://bucket/plans/name.json` — **default for remote runs** |
| `SEQUENCE_PLAN_FILE` | Coordinator (local dev) | Path to `.json` on disk |
| `SEQUENCE_PLAN` | Coordinator | Compact JSON string |
| `SEQUENCE_PLAN_B64` | Coordinator (legacy ECS) | Base64-encoded JSON (8192-byte ECS env limit) |

Precedence: S3 URI → inline/base64 → file path.

### Local development

```bash
# coordinator/.env
SEQUENCE_PLAN_FILE=../shared/sequence-plans/long-offline-loop.json
```

### AWS (`run-load-test.sh`)

By default the script uploads your local file to the stack S3 bucket and passes the URI:

```bash
# scripts/.env
SEQUENCE_PLAN_FILE=../shared/sequence-plans/sixty-agent-30min-triple-split.json
./run-load-test.sh
# → uploads s3://<SequencePlansBucketName>/plans/sixty-agent-30min-triple-split.json
# → coordinator gets SEQUENCE_PLAN_S3_URI
```

Overrides:

```bash
# Use a plan already in S3 (skip upload)
SEQUENCE_PLAN_S3_URI=s3://my-bucket/plans/custom.json ./run-load-test.sh

# Legacy: pass base64 in ECS env (small plans only)
SEQUENCE_PLAN_DELIVERY=env ./run-load-test.sh
```

Your AWS credentials need `s3:PutObject` on the plans bucket. The coordinator ECS task role has `s3:GetObject`.

## Step types

### Phase steps (`kind`)

| Kind | Behaviour |
|------|-----------|
| `onboarding` | Login with coordinator-assigned account, activate notebook. Advances when all agents done. |
| `online_collection` | Stay online; create records every `config.recordIntervalMs`. |
| `offline_collection` | Go offline, create records, reconnect with jitter, wait for sync. |
| `patchy_network` | Toggle offline/online on jittered cycles while surveying. |
| `export_stress` | Optional CSV export via API (`participateFraction` or agent env). |

Collection phases (`online_collection`, `offline_collection`, `patchy_network`) accept optional `config.collectionProfile` — a filename in `shared/collection-profiles/` or an inline profile object. See [collection-profiles/README.md](../collection-profiles/README.md).

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
| `sixty-agent-30min-triple-split.json` | 60 agents: baseline + peak + rotating 3-way splits (~30 min) |
| `person-survey-online.json` | Onboarding → online collection with `person-survey` profile |
| `load-test-survey-smoke.json` | Smoke test for `1780544113233-load-test-survey` notebook (~2 min) |

## Metrics

Prometheus labels use **`stepId`** (plan step `id`) instead of the old phase enum. Coordinator pushes `faims_run_state` and `faims_step_transition_timestamp`.
