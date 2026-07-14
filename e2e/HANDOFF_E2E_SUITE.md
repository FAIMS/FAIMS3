# Handoff: Comprehensive E2E Test Suite Implementation

**Audience:** Implementing agent (autonomous).  
**Goal:** Integrate with, augment, and upgrade the existing WebdriverIO e2e workflow into a durable, screenshot-rich suite that covers Conductor auth, Control Centre (`web`), and Fieldmark (`app`).  
**Primary browser:** Chromium / Chrome (headed for local debugging, headless for CI and agent self-verification).

This document is the source of truth for the work. Follow it end-to-end. Do not wait for human confirmation between phases unless blocked on secrets, external IdPs, or irreversible data loss.

---

## 0. Operating principles (mandatory)

1. **Work autonomously.** Bring up services if needed, seed data, run Chromium via WDIO, diagnose failures from logs/screenshots, fix tests or product scaffolding, re-run until green.
2. **Prefer headless Chromium** for agent loops: `pnpm --filter e2e test:e2e:headless` (app) and `pnpm --filter e2e test:e2e:headless:web` (Control Centre). Use headed only when debugging a visual flake you cannot diagnose from screenshots.
3. **Self-test every change.** After adding or changing a spec/page object/helper/testid, run the smallest relevant suite and confirm pass before moving on.
4. **Integrate, don’t replace.** Keep page-object style, Mocha + WDIO v9, existing conf files, seed personas, and `SCREENSHOT_DIR` convention. Upgrade in place.
5. **Selectors must be stable.** Prefer `data-testid`. Add them in `app`, `web`, and `api/views` when CSS/text selectors are brittle. Never rely on ephemeral MUI class hashes.
6. **Screenshots are first-class artifacts.** Every meaningful step should be able to emit a named screenshot + manifest entry so later tooling can build docs, reports, and movies.
7. **Don’t commit secrets or screenshot binaries** unless explicitly asked. Keep `e2e/screenshots/` gitignored (already is).
8. **Don’t force-push, amend others’ commits, or skip hooks.** Only commit when the user asks.
9. **Stay scoped.** This handoff is e2e infrastructure + specs + minimal product scaffolding (`data-testid`, small accessibility attributes). No unrelated refactors.

---

## 1. Current state (baseline)

### Stack

| Piece           | Location / notes                                                                    |
| --------------- | ----------------------------------------------------------------------------------- |
| Package         | `e2e/` (`"type": "module"`)                                                         |
| Runner          | WebdriverIO 9 + Mocha                                                               |
| App specs       | `e2e/test/specs/app/**` via `wdio.conf.ts` / `wdio.headless.conf.ts`                |
| Web specs       | `e2e/test/specs/web/**` via `wdio.web.conf.ts` / `wdio.headless.web.conf.ts`        |
| Mobile (Appium) | `wdio.mobile.conf.ts` — out of scope for v1 web Chromium suite unless already green |
| Page objects    | `e2e/test/pageobjects/`                                                             |
| Base helpers    | `e2e/test/pageobjects/page.ts` (viewport + basic `takeScreenshot`)                  |
| Headless Chrome | `e2e/chrome-headless-capabilities.ts` (`--headless=new`, Classic WebDriver)         |
| Env             | `e2e/.env.dist` → copy to `e2e/.env`                                                |
| Seed data       | `cd api && pnpm seed-test-dataset` after `./scripts/clearCouchDb.sh`                |
| Docs            | `e2e/README.md` (outdated in places — update as you go)                             |

### Existing specs (thin coverage)

| Spec                             | Coverage                                                                   |
| -------------------------------- | -------------------------------------------------------------------------- |
| `test/specs/app/login.e2e.ts`    | App sign-in UI, short-code reveal, Conductor redirect, valid/invalid login |
| `test/specs/web/projects.e2e.ts` | Web login + projects list + Create button (team member + ops admin)        |
| `test/specs/web/profile.e2e.ts`  | Profile page smoke                                                         |

### Known gaps / tech debt

- `Page.open()` hardcodes `http://localhost:3000/` — should respect `WEB_APP_PUBLIC_URL` / conf `baseUrl`.
- `wdio.headless.conf.ts` sets `baseUrl` to **web** (`:3001`) while app specs need **app** (`:3000`) — fix config split (see §3).
- Screenshot helper is minimal: no step index, no failure auto-capture, no manifest JSON, no video-friendly naming.
- Few `data-testid`s in `web`/`app` product code; Conductor Handlebars pages already have many.
- Specs use `browser.pause` in places — prefer explicit waits.
- No shared auth helper for the app (web has `web-auth.ts`).
- No artifact reporter / junit / HTML report yet.
- Parallelism: headless already forces `maxInstances: 1` to avoid token-exchange races — keep that for auth-heavy suites.

### Runtime prerequisites (agent must ensure)

From repo root / `AGENTS.md`:

1. Docker daemon up; CouchDB healthy (`curl http://localhost:5984/_up`).
2. Keys + env: `pnpm run generate-local-keys`; copy `.env.dist` → `.env` for root/`api`/`web`/`app`/`e2e` as needed.
3. Shared libs built if needed: `pnpm build` (or rely on `pnpm run dev`).
4. `pnpm run migrate-with-keys` then `./scripts/clearCouchDb.sh` + `cd api && pnpm seed-test-dataset`.
5. Dev stack: `pnpm run dev` (api `:8080`, app `:3000`, web `:3001`) — long-lived.
6. Verify: `curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000` / `3001` / `8080/login`.

Local admin (Control Centre via Conductor): username `admin`, password = `COUCHDB_PASSWORD` in `api/.env` (default documented in `AGENTS.md`). Prefer **seed personas** from `e2e/.env` for role tests.

---

## 2. Target architecture

```
e2e/
  artifacts/                    # gitignored run output (screenshots, manifest, logs)
  screenshots/                  # legacy/docs screenshots (existing); keep compatible
  test/
    helpers/
      env.ts                    # typed env accessors
      auth.ts                   # shared login/logout for app + web + conductor
      wait.ts                   # wait helpers (no arbitrary pause)
      selectors.ts              # byTestId() etc.
      screenshot.ts             # upgraded capture + manifest
      artifacts.ts              # run id, dirs, write manifest
      seed.ts                   # optional API helpers to create/read invites etc.
    pageobjects/
      page.ts                   # thin base; delegates screenshot/viewport to helpers
      api-*.ts                  # Conductor pages (keep/extend)
      app-*.ts                  # Fieldmark pages
      web/                      # Control Centre pages
    specs/
      smoke/                    # Tier 0 — always run in CI
      conductor/                # auth HTML flows
      web/                      # Control Centre
      app/                      # Fieldmark
      journeys/                 # cross-surface paths
  wdio*.conf.ts                 # upgraded hooks + reporters
  HANDOFF_E2E_SUITE.md          # this file
```

### Config upgrades (required)

1. **Split app vs web clearly**
   - `wdio.conf.ts` / `wdio.headless.conf.ts` → app specs only, `baseUrl=http://localhost:3000` (env override `WEB_APP_PUBLIC_URL`).
   - `wdio.web.conf.ts` / `wdio.headless.web.conf.ts` → web specs only, `baseUrl=http://localhost:3001` (env `WEB_URL`).
   - Add `wdio.smoke.conf.ts` + headless variant: only `test/specs/smoke/**`.
2. **Hooks**
   - `before`: load dotenv from `e2e/.env`, set viewport, init artifact run context.
   - `beforeTest`: record test start time; optional step counter reset.
   - `afterTest`: on failure → full-page screenshot + HTML dump + URL/title into artifacts; always append result to manifest.
   - `onComplete`: write `manifest.json` + `summary.md`.
3. **Reporters**
   - Keep `spec`.
   - Add JSON or JUnit reporter for CI (`@wdio/junit-reporter` or similar) writing under `artifacts/<runId>/`.
4. **Capabilities**
   - Keep Classic WebDriver for headless (`wdio:enforceWebDriverClassic: true`).
   - Optionally enable Chrome performance logs later; not required for v1.
5. **Scripts** (add to `e2e/package.json`)
   - `test:e2e:smoke` / `test:e2e:headless:smoke`
   - `test:e2e:app` / `test:e2e:web` (aliases clarifying intent)
   - `test:e2e:headless:ci` → smoke + critical tier 1 suites

---

## 3. Screenshot & artifact system (build first)

Upgrade beyond `Page.takeScreenshot`. Implement `test/helpers/screenshot.ts` + `artifacts.ts`.

### Requirements

| Capability           | Behaviour                                                                                          |
| -------------------- | -------------------------------------------------------------------------------------------------- |
| **Named step shots** | `captureStep({ surface, workflow, step, label })` → deterministic path                             |
| **Docs shots**       | Preserve current docs layout: `{SCREENSHOT_DIR}/{theme}/{category}/{base}-{viewport}.png`          |
| **Run artifacts**    | `{ARTIFACT_DIR}/{runId}/{specPath}/{testTitle}/{seq}-{label}.png`                                  |
| **Failure shots**    | Auto on `afterTest` failure; also save `page.html`, `meta.json` (url, title, viewport, timestamp)  |
| **Manifest**         | Append-only JSONL during run; finalize to `manifest.json`                                          |
| **Stable naming**    | Slugify; zero-pad sequence (`001-login-form.png`) for movie/report ordering                        |
| **Env flags**        | `SCREENSHOT_MODE=off\|on\|docs\|artifacts\|all` (default `all` in CI/headless)                     |
| **Hide noise**       | Optional: hide cookie banners / version snackbars via CSS inject before capture if they flake docs |

### Manifest entry schema (v1)

```json
{
  "runId": "20260714T023000Z-abc123",
  "timestamp": "2026-07-14T02:30:15.123Z",
  "surface": "web|app|conductor",
  "spec": "web/teams.e2e.ts",
  "test": "should create a team",
  "workflowId": "T2",
  "step": 3,
  "label": "create-team-dialog",
  "viewport": "desktop",
  "passed": true,
  "path": "artifacts/.../003-create-team-dialog.png",
  "url": "http://localhost:3001/teams"
}
```

### Helper API (sketch)

```ts
// capture for assertions + future movies/reports
await captureStep({
  surface: 'web',
  workflowId: 'T2',
  label: 'team-created',
});

// docs-oriented (compat with existing Page.takeScreenshot)
await captureDocs({category: 'login', baseName: 'app-signin-page'});

// low-level
await captureRaw(relativePath);
```

Wire `Page.takeScreenshot` to call `captureDocs` so existing specs keep working.

### Later consumers (do not build yet; design for them)

- HTML report gallery from `manifest.json`
- ffmpeg slideshow/movie from ordered PNGs per workflow
- Docs sync into `docs/user/**` screenshot trees

Leave a short `e2e/test/helpers/README.md` describing the contract.

---

## 4. Selector strategy & product scaffolding

### Convention

- Attribute: **`data-testid`** (already used in Conductor + some app/web).
- Naming: `{surface}-{area}-{element}` in kebab-case, e.g.:
  - `web-teams-create-button`
  - `web-team-invite-create-submit`
  - `app-notebook-activate-button`
  - `app-record-delete-btn` (existing `delete-btn` — migrate carefully or alias both)
  - `conductor-login-submit-button` (many already exist without prefix — keep existing Conductor ids; don’t mass-rename)
- Helper: `byTestId('web-teams-create-button')` → `$('[data-testid="web-teams-create-button"]')`.
- Prefer testid **on interactive controls and page landmarks** (`main`, headings, dialogs, tabs, empty states), not every span.

### Where to add scaffolding

| Surface       | Priority targets                                                                                                                                                                 |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **web**       | Sidebar nav items, create buttons, dialog roots/submit/cancel, tab triggers, DataTable empty state, designer Done/Cancel, invite QR dialog, archive actions, profile token forms |
| **app**       | Sign-in CTAs, notebook list tabs/rows/activate, notebook tabs, add-record buttons, sync icon, settings sync dropdown, delete confirm, offline map dialogs                        |
| **api/views** | Already good; fill any missing forgot/reset/verify/change-password controls                                                                                                      |

### Rules for product PRs/changes

- Minimal diff: only attributes (and aria-labels if needed for Testing Library queries).
- Do not change UX copy solely for tests; if you must, update specs in the same change.
- Re-use existing testids when present (`api-login.ts` already documents many).

---

## 5. Shared helpers to implement

| Helper                            | Purpose                                                                                                                                |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `env.ts`                          | Read seed credentials, URLs, screenshot mode; fail fast with clear errors if missing                                                   |
| `auth.ts`                         | `loginWeb(user)`, `loginApp(user)`, `loginConductor(user, {redirect})`, `logoutWeb()`, `logoutApp()`, persona getters                  |
| `wait.ts`                         | `waitForUrl`, `waitForTestId`, `waitForGone`, `waitForNetworkIdle` (lightweight), ban new `browser.pause` except documented animations |
| `selectors.ts`                    | `byTestId`, `byTestIdContaining`                                                                                                       |
| `screenshot.ts` / `artifacts.ts`  | As §3                                                                                                                                  |
| `seed.ts` (optional but valuable) | Authenticated API calls to create invite IDs, fetch project ids — reduces UI setup fragility for journey tests                         |

Reuse and extend existing:

- `web/web-auth.ts` → move core into `helpers/auth.ts`, keep page object as thin wrapper.
- `api-login.ts` / `api-register.ts` / `app-signin.ts` → keep; route through helpers.

---

## 6. Workflow inventory → spec map

IDs match the earlier platform audit. Implement in tiers. Each spec file should list workflow IDs in a header comment.

### Tier 0 — Smoke (CI gate, < ~5–8 min headless)

| Spec file                        | Workflows                                     |
| -------------------------------- | --------------------------------------------- |
| `smoke/conductor-login.e2e.ts`   | C1                                            |
| `smoke/web-login-shell.e2e.ts`   | W1, W3, W5 (partial)                          |
| `smoke/app-login.e2e.ts`         | F1 (migrate/trim existing `app/login.e2e.ts`) |
| `smoke/web-projects-list.e2e.ts` | P1 (keep existing coverage)                   |

### Tier 1 — Core happy paths

| Spec file                            | Workflows                                                  |
| ------------------------------------ | ---------------------------------------------------------- |
| `web/teams.e2e.ts`                   | T1, T2, T3, T4                                             |
| `web/templates-create.e2e.ts`        | TP1, TP2, TP3                                              |
| `web/projects-create.e2e.ts`         | P2, P3, P8                                                 |
| `web/designer-basic.e2e.ts`          | TP5/P9, D1, D5, D8 (minimal: add form + text field + save) |
| `app/notebook-activate.e2e.ts`       | N1, N2, N4                                                 |
| `app/record-crud.e2e.ts`             | N8, N9 (text field), N11, N12                              |
| `journeys/template-to-record.e2e.ts` | Cross: TP2→Designer→P8→F1→N2→N8                            |

### Tier 2 — Lifecycle & invites

| Spec file                                | Workflows     |
| ---------------------------------------- | ------------- |
| `web/team-invites.e2e.ts`                | T7, T8        |
| `web/project-invites.e2e.ts`             | P4            |
| `conductor/register-invite.e2e.ts`       | C3, C4        |
| `web/project-status-archive.e2e.ts`      | P13, P14, A1  |
| `web/template-visibility-archive.e2e.ts` | TP9, TP10, A2 |
| `app/sync-settings.e2e.ts`               | S1, S2, S5    |

### Tier 3 — Admin, permissions, offline, exports

| Spec file                         | Workflows                                                      |
| --------------------------------- | -------------------------------------------------------------- |
| `web/users-admin.e2e.ts`          | U1–U5                                                          |
| `web/profile-tokens.e2e.ts`       | PR1–PR3                                                        |
| `web/exports.e2e.ts`              | P6 (assert download trigger / Content-Disposition if feasible) |
| `web/offline-map-region.e2e.ts`   | P7                                                             |
| `web/permissions-matrix.e2e.ts`   | T11 + guest vs admin button presence                           |
| `app/offline-collect.e2e.ts`      | S4 (CDP offline if Classic allows; else document limitation)   |
| `app/impersonation.e2e.ts`        | F8                                                             |
| `conductor/password-reset.e2e.ts` | C6–C8 (may need mail catcher or admin-generated link via API)  |

### Tier 4 — Depth (after Tier 1–2 green)

Designer conditions, field-type matrix, SSO (mock), map tab, QR, long-lived token admin mode, etc. See full inventory in conversation / keep extending the tables above.

### Personas (from seed)

Use env vars from `e2e/.env.dist`. Map intentionally:

| Persona env prefix                | Typical use                                 |
| --------------------------------- | ------------------------------------------- |
| `TEST_OPERATIONS_ADMIN_*`         | Users admin, global invites, impersonation  |
| `TEST_MANAGER_BLUE_*` / `CROSS_*` | Team/project management                     |
| `TEST_MEMBER_BOTH_*`              | Create within team; existing projects tests |
| `TEST_RED_MEMBER_CREATOR_*`       | Template creation boundaries                |
| `TEST_PROJECT_CONTRIBUTOR_*`      | App record create/edit                      |
| `TEST_PROJECT_GUEST_*`            | Read-only / limited UI                      |
| `TEST_USER_*`                     | Generic member                              |

Ensure seed dataset actually creates notebooks/templates the app can activate for contributor/guest — if not, extend `api/src/scripts/seedTestDataset.ts` as part of this work (preferred over fragile UI setup).

---

## 7. Implementation phases (execute in order)

### Phase A — Foundation (do this first; no new feature specs yet)

1. Fix app/web `baseUrl` split and env loading (dotenv).
2. Implement artifact + screenshot helpers; migrate `Page.takeScreenshot`.
3. Add WDIO hooks for failure artifacts + manifest.
4. Extract `helpers/auth.ts`; refactor `web-auth` + app login helper used by `app/login.e2e.ts`.
5. Add `byTestId` helper.
6. Add smoke conf + scripts.
7. Run existing specs headless until green; update `e2e/README.md` with accurate commands.

**Exit criteria:** Existing three specs pass headless; failure of a deliberate broken assertion produces screenshot + `meta.json`; `manifest.json` written.

### Phase B — Scaffolding pass

1. Audit Tier 0–1 selectors; add `data-testid`s in web/app (and api views if needed).
2. Page objects for: Teams list/detail, Templates list/detail, Project detail tabs, Designer shell, App workspace, Notebook hub, Record view/edit.
3. Prefer one page object per major route/dialog.

**Exit criteria:** Page objects can open each Tier 1 screen without brittle text-only selectors.

### Phase C — Tier 0 + Tier 1 specs

1. Implement smoke specs; wire `test:e2e:headless:ci`.
2. Implement Tier 1 specs one file at a time; **self-test each file** before the next.
3. Implement one cross-surface journey (`template-to-record`).

**Exit criteria:** Smoke + Tier 1 green headless on seeded DB.

### Phase D — Tier 2

Invites, register, archive/status, app sync/deactivate.

### Phase E — Tier 3+

Admin, permissions matrix, exports, offline map, offline collect (best effort), password reset.

### Phase F — Hardening

1. Remove remaining `browser.pause`.
2. Quarantine flaky tests with issue comments; fix root cause.
3. Document CI job sketch in `e2e/README.md` (even if CI YAML is separate).
4. Optional: viewport matrix for smoke only (desktop + mobile app).

---

## 8. Autonomy playbook (how the agent should work day-to-day)

### Loop

```
for each task in current phase:
  implement
  run smallest headless command covering the change
  if fail:
    read WDIO output
    open failure screenshot + meta.json + page.html
    fix test OR add testid OR fix wait
    re-run
  if pass:
    mark done; continue
```

### Preferred commands

```bash
# from e2e/
cp -n .env.dist .env

# Control Centre
pnpm test:e2e:headless:web -- --spec test/specs/web/teams.e2e.ts

# App
pnpm test:e2e:headless -- --spec test/specs/app/record-crud.e2e.ts

# Smoke (after Phase A)
pnpm test:e2e:headless:smoke
```

(Adjust `--spec` path to match WDIO’s expected pattern; if CLI differs, use mocha grep: `--mochaOpts.grep 'Teams'`.)

### Diagnosing common failures

| Symptom                        | Likely cause                                         | Action                                                |
| ------------------------------ | ---------------------------------------------------- | ----------------------------------------------------- |
| Redirect never leaves `/login` | Bad credentials / seed missing / local auth disabled | Check `api/.env`, re-seed                             |
| Stuck on `exchangeToken`       | Client exchange failed / API down                    | Check network tab via logs; curl `/api/auth/exchange` |
| Element not found              | Missing testid / dialog animation / permission       | Add testid; wait for displayed; verify persona        |
| Flaky timing                   | `pause` or race                                      | Explicit `waitUntil` on testid                        |
| Parallel login races           | `maxInstances > 1`                                   | Keep 1 for auth suites                                |
| Empty projects/templates       | Seed incomplete / wrong user                         | Extend seed or switch persona                         |
| CouchDB errors                 | Daemon/DB not up                                     | Start docker + migrate                                |

### Chrome specifics

- Use `chrome-headless-capabilities.ts` as the single source of headless flags.
- If `isDisplayed` BiDi issues return, keep Classic WebDriver flag.
- Window size via existing viewport helper before first assertion.
- For download tests (exports), configure `goog:chromeOptions.prefs` download directory under `artifacts/<runId>/downloads/`.

### Do not block on

- Real SSO IdP (Tier 4; mock or skip with clear `describe.skip` + reason).
- Real email delivery (use admin reset API / extract code from DB or mailhog if present; otherwise skip with reason).
- Native Capacitor QR/camera (mark mobile-only).
- Perfect offline simulation if CDP offline is unavailable under Classic — document and test “pending sync” UI with intercepted network if needed.

---

## 9. Coding standards for this suite

- TypeScript ESM consistent with existing e2e package.
- One concern per spec file; descriptive `it(...)` names including persona when relevant.
- Header comment on each spec listing workflow IDs.
- No hardcoded passwords in specs — env only.
- Prefer:

```ts
await expect(byTestId('web-teams-create-button')).toBeDisplayed();
await captureStep({surface: 'web', workflowId: 'T2', label: 'teams-list'});
```

- Update page objects instead of duplicating selectors in specs.
- When adding testids in app/web, run package typecheck/lint for touched packages if practical (`pnpm --filter @faims3/web exec …` / app equivalent).

---

## 10. Definition of done (overall)

- [ ] Phase A foundation merged/ready: helpers, hooks, config split, existing specs green headless.
- [ ] `data-testid` scaffolding for all Tier 0–1 interactive targets.
- [ ] Tier 0 smoke suite runnable via one script; suitable as CI gate.
- [ ] Tier 1 specs green against seeded dataset.
- [ ] At least one cross-surface journey green.
- [ ] Screenshot/manifest pipeline documented and used in all new specs.
- [ ] `e2e/README.md` updated: setup, commands, artifact layout, personas, troubleshooting.
- [ ] Flaky Tier 2+ items either green or explicitly skipped with reason + follow-up note in this file’s Tier tables.

---

## 11. Reference paths (quick)

| What                   | Path                                              |
| ---------------------- | ------------------------------------------------- |
| App routes             | `app/src/App.tsx`, `app/src/constants/routes.tsx` |
| Web routes             | `web/src/routes/**`                               |
| Conductor views        | `api/views/**`, auth routes under `api/src`       |
| Seed script            | `api/src/scripts/seedTestDataset.ts`              |
| Existing e2e login app | `e2e/test/specs/app/login.e2e.ts`                 |
| Existing e2e web       | `e2e/test/specs/web/*.e2e.ts`                     |
| Headless caps          | `e2e/chrome-headless-capabilities.ts`             |
| Platform startup       | `AGENTS.md` (repo root)                           |

---

## 12. First actions for the implementing agent (checklist)

1. Confirm CouchDB + `pnpm run dev` services respond on `:5984`, `:8080`, `:3000`, `:3001`.
2. Ensure `e2e/.env` exists; re-seed if credentials unknown.
3. Run current suites; record baseline pass/fail.
4. Start **Phase A** (foundation). Do not write large new feature specs until Phase A exit criteria are met.
5. Proceed Phase B → C → … using the autonomy loop in §8.
6. Keep this handoff file updated if you discover wrong assumptions (append a short “Changelog” section at the bottom).

### Changelog

- 2026-07-14: Initial handoff created from platform UI workflow audit + existing `e2e/` inventory.
- 2026-07-14: Phase A foundation landed (helpers, hooks, config split, artifacts/manifest, smoke scripts). Existing specs green headless. Tier 0 smoke green. Tier 1 mostly green (teams/templates/projects/designer/journey/app activate). Tier 2/3 thin coverage added (invites tab, archive nav, users admin, profile tokens). Deferred with reason: full invite register (C3/C4), exports download prefs, CDP offline, password-reset mail, SSO mock, deep record CRUD when contributor has no activated notebook.
- 2026-07-14 (continued): Closed Tier 1 record CRUD gap + Phase D Tier 2 happy paths:
  - Seed Red notebook now defaults to `api/notebooks/e2e-minimal.json` (single required text field) so headless record create is practical; Blue remains `sample_notebook.json`.
  - Seed ops admin gains `TEMPLATE_ADMIN` on Red + `PROJECT_ADMIN` on Blue so visibility/archive Actions are reachable (ops global roles alone cannot READ private team templates).
  - App scaffolding: activate confirm, notebook row, notebook tabs, deactivate, `app-record-field-*`, `app-record-finish-button`.
  - Web scaffolding: team/project invite dialogs + submit, project status/archive, template visibility/archive, expiry select.
  - Specs green headless: `app/record-crud` (N8–N12), `app/sync-settings` (S1/S2/S5), `web/team-invites` (T7/T8), `web/project-invites` (P4), `web/project-status-archive` (P13/P14/A1), `web/template-visibility-archive` (TP9/TP10/A2).
  - Still deferred: `conductor/register-invite` (C3/C4), exports download prefs, CDP offline, password-reset mail, SSO mock, deeper designer field matrix.
- 2026-07-14 (Phase E): Tier 3 happy-path coverage expanded:
  - Specs: `web/profile-tokens` (PR1–PR3), `web/permissions-matrix` (T11), `web/offline-map-region` (P7 UI), `web/exports` (P6 dialog), `app/impersonation` (F8), `conductor/password-reset` (C6–C8 via admin `POST /api/reset`, no mail).
  - Helpers: `test/helpers/seed.ts` (`requestPasswordResetLink`, `completePasswordReset`).
  - WDIO web configs now include `test/specs/conductor/**`.
  - `RATE_LIMITER_ENABLED` now also gates email-code + verification-challenge attempt limits (not only Express HTTP). Local `api/.env` sets `RATE_LIMITER_ENABLED=false` for e2e.
  - Still deferred: `conductor/register-invite` (C3/C4), Chrome download-dir assert for exports, CDP offline collect, SSO mock, OpenLayers draw/save region, deeper users admin (U2–U5).
