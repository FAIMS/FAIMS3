# E2E suite inventory

Map of specs for the WebdriverIO suite. How to run the suite, configure env,
and read CI artifacts: see [README.md](./README.md). Helper contracts:
[test/helpers/README.md](./test/helpers/README.md).

## Spec layout → WDIO conf

| Directory               | Conf (headless)               | CI stage (`test:e2e:headless:ci`) |
| ----------------------- | ----------------------------- | --------------------------------- |
| `test/specs/smoke/`     | `wdio.headless.smoke.conf.ts` | 1 — smoke                         |
| `test/specs/web/`       | `wdio.headless.web.conf.ts`   | 2 — web                           |
| `test/specs/conductor/` | `wdio.headless.web.conf.ts`   | 2 — web                           |
| `test/specs/journeys/`  | `wdio.headless.web.conf.ts`   | 2 — web                           |
| `test/specs/app/`       | `wdio.headless.conf.ts`       | 3 — app                           |

Headed counterparts: `wdio.smoke.conf.ts`, `wdio.web.conf.ts`, `wdio.conf.ts`.

## Scripts & viewport scope

Preferred entry points: `test:e2e:smoke`, `test:e2e:web`, `test:e2e:app`
(and their `headless:` twins), or `test:e2e:headless:ci` for the full CI chain.

`wdio.conf.ts` / `wdio.headless.conf.ts` default to **Fieldmark app** specs
(`test/specs/app/**`). Legacy aliases that shell into those confs are therefore
**app-only**, including:

- `test:e2e`, `test:e2e:headless`
- viewport variants (`:mobile`, `:tablet`, `:desktop`, `:wide`)
- multi-viewport aggregators (`test:e2e:all`, `test:e2e:headless:all`)

Prefer `test:e2e:app` / `test:e2e:headless:app` when the intent is explicit.

Web / conductor / journeys run via `test:e2e:web` (and headless). Viewport
scripts for that surface are **desktop and wide only**
(`test:e2e:web:desktop`, `:wide`, `:all`). **Mobile and tablet coverage for
Control Centre / Conductor is out of scope** for this suite; those viewports
apply to the Fieldmark app path above. Appium (`test:e2e:android` /
`test:e2e:ios`) is a separate path (see Tier 4).

## Tiers

### Tier 0 — Smoke (CI gate)

| Spec                             | Covers                                          |
| -------------------------------- | ----------------------------------------------- |
| `smoke/conductor-login.e2e.ts`   | Conductor local login                           |
| `smoke/web-login-shell.e2e.ts`   | Control Centre shell, sidebar, profile landmark |
| `smoke/app-login.e2e.ts`         | Fieldmark sign-in                               |
| `smoke/web-projects-list.e2e.ts` | Projects list after login                       |

### Tier 1 — Core happy paths

| Spec                                 | Covers                                                                  |
| ------------------------------------ | ----------------------------------------------------------------------- |
| `web/teams.e2e.ts`                   | Teams list, create team, team detail tabs                               |
| `web/templates-create.e2e.ts`        | Templates list, create template from team                               |
| `web/projects-create.e2e.ts`         | Create project dialog                                                   |
| `web/designer-basic.e2e.ts`          | Open designer from template (minimal form + text + save when available) |
| `app/notebook-activate.e2e.ts`       | Notebook workspace, Active / Not Active tabs, activate control          |
| `app/record-crud.e2e.ts`             | Open notebook, add record, create text record, list/search              |
| `journeys/template-to-record.e2e.ts` | Cross-surface: templates in Control Centre → Fieldmark workspace        |

### Tier 2 — Lifecycle & invites

| Spec                                     | Covers                                                      |
| ---------------------------------------- | ----------------------------------------------------------- |
| `web/team-invites.e2e.ts`                | Team Invites tab, create team invite                        |
| `web/project-invites.e2e.ts`             | Project Invites tab, create project invite                  |
| `conductor/register-invite.e2e.ts`       | Register via team invite (new account + existing seed-user) |
| `web/project-status-archive.e2e.ts`      | Close/reopen project, archive control, archive nav          |
| `web/template-visibility-archive.e2e.ts` | Template visibility dialog, archive template, archive nav   |
| `app/sync-settings.e2e.ts`               | Notebook Settings tab, sync mode select, deactivate control |

### Tier 3 — Admin, permissions, offline UI, exports

| Spec                              | Covers                                                               |
| --------------------------------- | -------------------------------------------------------------------- |
| `web/users-admin.e2e.ts`          | Users admin list, password-reset link, disable dialog, global invite |
| `web/profile-tokens.e2e.ts`       | Long-lived API tokens: list, create, revoke                          |
| `web/exports.e2e.ts`              | Export tab / Data Export dialog (download-dir assert deferred)       |
| `web/offline-map-region.e2e.ts`   | Offline Map UI; OpenLayers draw/save deferred                        |
| `web/permissions-matrix.e2e.ts`   | Invite role options and create controls by persona                   |
| `app/impersonation.e2e.ts`        | Ops admin impersonates seed user; guest has no impersonate menu      |
| `conductor/password-reset.e2e.ts` | Forgot-password form + admin-generated reset link (no mail catcher)  |

### Tier 4 — Deferred / not yet automated

| Area                          | Notes                                              |
| ----------------------------- | -------------------------------------------------- |
| CDP offline collect           | Classic WebDriver limitation; no `offline-collect` |
| Chrome download assert        | Export dialog covered; file download not asserted  |
| OpenLayers draw/save          | Region UI only                                     |
| SSO mock                      | External IdP                                       |
| Designer field-type matrix    | Beyond minimal text field                          |
| Appium mobile (`wdio.mobile`) | Separate path; not in CI Chromium job              |

## Personas (seed)

Credentials live in `e2e/.env.dist` (copy to `e2e/.env`). Dataset:
[Test Dataset Seeding](../docs/developer/docs/source/markdown/TestDatasetSeeding.md).

| Env prefix                        | Typical use                                                          |
| --------------------------------- | -------------------------------------------------------------------- |
| `TEST_OPERATIONS_ADMIN_*`         | Users admin, global ops; Red `TEMPLATE_ADMIN` + Blue `PROJECT_ADMIN` |
| `TEST_MANAGER_BLUE_*` / `CROSS_*` | Team/project management                                              |
| `TEST_MEMBER_BOTH_*`              | Create within team; projects list                                    |
| `TEST_RED_MEMBER_CREATOR_*`       | Template creation                                                    |
| `TEST_PROJECT_CONTRIBUTOR_*`      | App record create/edit (Red `e2e-minimal` notebook)                  |
| `TEST_PROJECT_GUEST_*`            | Read-only / limited UI                                               |
| `TEST_USER_*`                     | Generic member (`seed-user@faims.test`)                              |

Default seed notebooks: Red = `api/notebooks/e2e-minimal.json`, Blue =
`api/notebooks/sample_notebook.json` (`TEST_SEED_NOTEBOOKS` override).

## Manifest entry (v1)

Appended as JSONL during a run; finalized to `manifest.json` on complete.
`runId` is `{utcStamp}-{suite}-{hex}` (e.g. `20260714T053007Z-web-a1b2c3`).

```json
{
  "runId": "20260714T053007Z-web-a1b2c3",
  "timestamp": "2026-07-14T05:30:15.123Z",
  "surface": "web",
  "spec": "web/teams.e2e.ts",
  "test": "should open the create team dialog",
  "step": 3,
  "label": "create-team-dialog",
  "viewport": "desktop",
  "passed": true,
  "path": "artifacts/.../003-create-team-dialog.png",
  "url": "http://localhost:3001/teams",
  "kind": "step"
}
```

`kind` is one of `step` | `docs` | `failure` | `result`. Failure / result rows
may include `error` and `durationMs`.

## Conventions

- Prefer `data-testid` + `byTestId` / `waitForTestId` over CSS hashes or
  `browser.pause`.
- Name tests with a short description (e.g. `should create a team and show it
in the list`); avoid opaque handover IDs.
- Keep `maxInstances: 1` for auth-heavy suites (token-exchange races).
- Product scaffolding for tests belongs in `app` / `web` / `api/views` as
  stable `data-testid`s, not brittle text selectors.
