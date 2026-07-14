# FAIMS End-to-End Tests

WebdriverIO 9 + Mocha suite covering Conductor auth, Control Centre (`web`), and
Fieldmark (`app`). Primary browser: Chromium (headed locally, headless in CI).

## Prerequisites

1. Docker + CouchDB healthy (`curl http://localhost:5984/_up`).
2. Keys/env: `pnpm run generate-local-keys`, copy `.env.dist` → `.env` for root /
   `api` / `web` / `app` / `e2e`.
3. `pnpm run migrate-with-keys`, then seed:

```bash
# Non-interactive clear (scripts/clearCouchDb.sh prompts interactively)
sudo docker compose restart couchdb   # or reset volume if you need a blank DB
cd api && pnpm seed-test-dataset
```

4. Dev stack: `pnpm run dev` (api `:8080`, app `:3000`, web `:3001`).

Copy `e2e/.env.dist` → `e2e/.env` (seed passwords match the dist defaults).

## Commands

```bash
cd e2e

# Tier 0 smoke (CI gate)
pnpm test:e2e:headless:smoke

# Control Centre
pnpm test:e2e:headless:web
pnpm test:e2e:headless:web -- --spec test/specs/web/teams.e2e.ts

# Fieldmark app
pnpm test:e2e:headless
pnpm test:e2e:headless -- --spec test/specs/app/notebook-activate.e2e.ts

# CI-style: smoke + web (+journeys) + app
pnpm test:e2e:headless:ci
```

Headed variants: `pnpm test:e2e:web`, `pnpm test:e2e:app`, `pnpm test:e2e:smoke`.

Viewport: `VIEWPORT=mobile|tablet|desktop|wide` (default `desktop`).

Screenshots use CSS pixels at `deviceScaleFactor=1` (Chrome CDP
`Emulation.setDeviceMetricsOverride` under Classic WebDriver) so images are not
horizontally stretched. Headless configs set `autoXvfb: false` because Xvfb is
unnecessary with `--headless=new` and can distort shots.

## Artifacts & screenshots

| Env               | Purpose                                                                        |
| ----------------- | ------------------------------------------------------------------------------ |
| `SCREENSHOT_MODE` | `off` \| `on` \| `docs` \| `artifacts` \| `all` (default `all`)                |
| `SCREENSHOT_DIR`  | Docs screenshots (default `./screenshots`)                                     |
| `ARTIFACT_DIR`    | Run artifacts (default `./artifacts`)                                          |
| `WDIO_LOG_LEVEL`  | `silent` \| `error` \| `warn` \| `info` \| `debug` \| `trace` (default `warn`) |

Each run writes `artifacts/<runId>/`:

- `manifest.jsonl` / `manifest.json` / `summary.md`
- `junit/` — JUnit XML for CI
- `<spec>/<test>/001-….png` — step shots
- `failures/<spec>/<test>/{failure.png,page.html,meta.json}`

Helpers live in `test/helpers/` (see `test/helpers/README.md`). Prefer
`byTestId`, `captureStep`, and `waitForTestId` over CSS hashes or `browser.pause`.

## Personas (seed)

| Env prefix                        | Typical use                                                                                                      |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `TEST_OPERATIONS_ADMIN_*`         | Users admin, global ops; also seeded with Red `TEMPLATE_ADMIN` + Blue `PROJECT_ADMIN` for archive/visibility e2e |
| `TEST_MANAGER_BLUE_*` / `CROSS_*` | Team/project management                                                                                          |
| `TEST_MEMBER_BOTH_*`              | Create within team; projects list                                                                                |
| `TEST_RED_MEMBER_CREATOR_*`       | Template creation                                                                                                |
| `TEST_PROJECT_CONTRIBUTOR_*`      | App record create/edit (Red `e2e-minimal` notebook)                                                              |
| `TEST_PROJECT_GUEST_*`            | Read-only / limited UI                                                                                           |

Default seed notebooks: Red = `api/notebooks/e2e-minimal.json`, Blue =
`api/notebooks/sample_notebook.json` (override via `TEST_SEED_NOTEBOOKS`).

## Spec layout

```
test/specs/
  smoke/       # Tier 0 CI gate
  web/         # Control Centre
  app/         # Fieldmark
  conductor/   # Auth HTML (expand Tier 2+)
  journeys/    # Cross-surface
```

See `HANDOFF_E2E_SUITE.md` for the full workflow inventory and tiers.

## CI sketch

```yaml
# pseudo
- pnpm --filter e2e test:e2e:headless:ci
- upload-artifact: e2e/artifacts/
```

Keep `maxInstances: 1` for auth-heavy suites (token exchange races).

## Troubleshooting

| Symptom                  | Action                                                          |
| ------------------------ | --------------------------------------------------------------- |
| Stuck on `/login`        | Re-seed; check `api/.env` local auth                            |
| Stuck on `exchangeToken` | API down / exchange failed                                      |
| Element not found        | Add/wait for `data-testid`                                      |
| Empty lists              | Wrong persona or seed incomplete                                |
| HTTP 429 / flaky auth    | API rate limit from many logins — pause between full suite runs |
