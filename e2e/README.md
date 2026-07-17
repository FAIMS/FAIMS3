# FAIMS End-to-End Tests

WebdriverIO 9 + Mocha suite covering Conductor auth, Control Centre (`web`), and
Fieldmark (`app`). Primary browser: Chromium (headed locally, headless in CI).

## Prerequisites

1. Docker + CouchDB healthy (`curl http://localhost:5984/_up`).
2. Keys/env: `pnpm run generate-local-keys`, copy `.env.dist` → `.env` for root /
   `api` / `web` / `app` / `e2e`.
3. `pnpm run migrate-with-keys`, then seed:

```bash
# Seed (idempotent — restores Red/Blue teams, templates, notebooks, personas)
cd api && pnpm seed-test-dataset
```

4. Dev stack: `pnpm run dev` (api `:8080`, app `:3000`, web `:3001`).

For repeated local password-reset / invite e2e, set in `api/.env`:

```bash
RATE_LIMITER_ENABLED=false
AUTH_ATTEMPT_LIMITER_ENABLED=false
```

`RATE_LIMITER_ENABLED` is the Express HTTP IP limiter;
`AUTH_ATTEMPT_LIMITER_ENABLED` is the CouchDB-backed email-code /
verification-challenge attempt limits (see `api/.env.dist`). Restart the API
after changing them.

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

Viewport: `VIEWPORT=mobile|tablet|desktop|wide` (default `desktop`). Mobile /
tablet scripts (`test:e2e:mobile`, `test:e2e:headless:all`, etc.) target the
**app** conf only; web is desktop/wide. Details: [SUITE.md](./SUITE.md)
(“Scripts & viewport scope”).

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

Each run writes `artifacts/<runId>/` where `runId` is
`{utcStamp}-{suite}-{hex}` (e.g. `20260714T053007Z-app-4d403d`):

| Suite   | Conf / CI stage                                          |
| ------- | -------------------------------------------------------- |
| `smoke` | `wdio.headless.smoke.conf.ts`                            |
| `web`   | `wdio.headless.web.conf.ts` (web + conductor + journeys) |
| `app`   | `wdio.headless.conf.ts` / `wdio.conf.ts`                 |

Contents:

- `index.html` — failure-first HTML gallery + step screenshot thumbs
- `manifest.jsonl` / `manifest.json` / `summary.md`
- `junit/` — JUnit XML for CI
- `<spec>/<test>/001-….png` — step shots
- `failures/<spec>/<test>/{failure.png,page.html,meta.json}`

`artifacts/index.html` lists all runs. Regenerate galleries anytime:

```bash
cd e2e && pnpm report
cd e2e && pnpm report -- <runId>
```

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
  conductor/   # Auth HTML
  journeys/    # Cross-surface
```

Spec inventory (tiers, deferred work, manifest schema):
[SUITE.md](./SUITE.md).

## CI (GitHub Actions)

Workflow: [`.github/workflows/e2e.yml`](../.github/workflows/e2e.yml).

Runs on PRs / pushes to `main` when `e2e`, `app`, `web`, `api`, `library`, or
lockfile/workflow files change (`workflow_dispatch` always available). The job:

1. Installs deps (Node 24 / pnpm, same as Build & Lint)
2. Copies `.env.dist` → `.env`, sets `FAIMS_COOKIE_SECRET`,
   `RATE_LIMITER_ENABLED=false`, and `AUTH_ATTEMPT_LIMITER_ENABLED=false`
3. Generates signing keys + CouchDB `local.ini`, starts CouchDB via Compose
4. `pnpm build`, `migrate-with-keys`, `seed-test-dataset`
5. Starts `pnpm run dev` (api `:8080`, app `:3000`, web `:3001`)
6. Installs pinned Chrome + ChromeDriver (`browser-actions/setup-chrome`)
7. Runs `pnpm test:e2e:headless:ci` (smoke → web/conductor/journeys → app)
8. Stages and uploads a flat zip: `artifacts/` (HTML galleries), `screenshots/`,
   and `faims-dev.log`

Reviewers: download the `e2e-artifacts-*` Action artifact and open
`artifacts/index.html` (or the latest `artifacts/<runId>/index.html`).
Failures are listed first with screenshot, error, and `page.html` / `meta.json`
links; the gallery groups step shots by spec/test.

Keep `maxInstances: 1` for auth-heavy suites (token-exchange races). Optional
Chrome override env vars: `CHROME_BIN` / `CHROMEDRIVER_PATH`.

Local equivalent after the stack is up:

```bash
pnpm --filter=@faims3/e2e test:e2e:headless:ci
# or filter one describe:
cd e2e && pnpm exec wdio run wdio.headless.web.conf.ts --mochaOpts.grep 'Users admin'
```

## Troubleshooting

| Symptom                  | Action                                                                                               |
| ------------------------ | ---------------------------------------------------------------------------------------------------- |
| Stuck on `/login`        | Re-seed; check `api/.env` local auth                                                                 |
| Stuck on `exchangeToken` | API down / exchange failed                                                                           |
| Element not found        | Add/wait for `data-testid`                                                                           |
| Empty lists              | Wrong persona or seed incomplete                                                                     |
| Users search no results  | Email column must be a string (Users tab maps `emails[0].email`)                                     |
| HTTP 429 / flaky auth    | Set `RATE_LIMITER_ENABLED=false` and `AUTH_ATTEMPT_LIMITER_ENABLED=false` in `api/.env`; restart API |
| CI Chrome session fails  | Check Actions artifact `e2e-artifacts-*` + pinned Chrome setup                                       |
