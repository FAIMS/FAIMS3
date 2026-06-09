# Collection profiles

Describe **how** agents fill in records during `online_collection`, `offline_collection`, and `patchy_network` phases.

Profiles are Zod-validated JSON (`@faims3/load-testing-shared` → `collection-profile.ts`). The coordinator resolves filename references at startup and embeds the full profile in `ActiveStep.config` for agents.

## Referencing from a sequence plan

```json
{
  "id": "online_survey",
  "kind": "online_collection",
  "durationMs": 300000,
  "config": {
    "recordIntervalMs": 5000,
    "collectionProfile": "person-survey.json"
  }
}
```

Inline profiles are also supported (useful for small tests).

## Coordinator configuration

| Variable | Purpose |
|----------|---------|
| `COLLECTION_PROFILES_DIR` | Directory containing profile `.json` files |

Default when unset: `../collection-profiles` next to `SEQUENCE_PLAN_FILE`, or `../shared/collection-profiles` from the coordinator working directory.

For S3-delivered plans, `run-load-test.sh` inlines profile references before upload. The coordinator also ships bundled profiles under `@faims3/load-testing-shared/collection-profiles` as a fallback when resolving local or legacy S3 plans that still contain filename references.

## Step actions

| Action | Description |
|--------|-------------|
| `fill` | Text/number input in `#field-{field}` |
| `select` | MUI dropdown — `option` matches label or value |
| `toggle` | Checkbox in field container; use `option` to match a labelled checkbox/radio (e.g. MultiSelect checklist) |
| `navigate_section` | Go to a form section (`match`: `label` or `id`). Uses desktop tabs when visible; on narrow viewports (default agent width 393px) the app shows a mobile Next/Back stepper instead — agents handle both layouts. |
| `scroll_to_field` | Scroll to `#field-{field}` |
| `wait` | Fixed delay (`ms`) |
| `wait_save` | Wait for save indicator |
| `finish` | Finish record (`strategy` defaults to `finish_anyway`) |
| `group` | Run nested steps in order |

Value strings support `{{agentId}}`, `{{sessionId}}`, `{{recordIndex}}`, `{{timestamp}}`, `{{isoTimestamp}}`.

## Bundled examples

| File | Description |
|------|-------------|
| `simple-text.json` | Single field + finish |
| `person-survey.json` | Multi-section Person form (sample notebook) |
| `load-test-survey-site-minimal.json` | Minimal Site workflow for `1780544113233-load-test-survey` |

Use sequence plan `load-test-survey-smoke.json` for a quick local/AWS smoke run against that notebook.

When `collectionProfile` is omitted, agents use the legacy behaviour (first `input`/`textarea` on the page).
