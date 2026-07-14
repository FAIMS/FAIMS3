# E2E suite inventory

Durable map of workflow IDs → specs for the WebdriverIO suite. How to run the
suite, configure env, and read CI artifacts: see [README.md](./README.md).
Helper contracts: [test/helpers/README.md](./test/helpers/README.md).

## Spec layout → WDIO conf

| Directory               | Conf (headless)               | CI stage (`test:e2e:headless:ci`) |
| ----------------------- | ----------------------------- | --------------------------------- |
| `test/specs/smoke/`     | `wdio.headless.smoke.conf.ts` | 1 — smoke                         |
| `test/specs/web/`       | `wdio.headless.web.conf.ts`   | 2 — web                           |
| `test/specs/conductor/` | `wdio.headless.web.conf.ts`   | 2 — web                           |
| `test/specs/journeys/`  | `wdio.headless.web.conf.ts`   | 2 — web                           |
| `test/specs/app/`       | `wdio.headless.conf.ts`       | 3 — app                           |

Headed counterparts: `wdio.smoke.conf.ts`, `wdio.web.conf.ts`, `wdio.conf.ts`.

## Tiers

### Tier 0 — Smoke (CI gate)

| Spec                             | Workflows            |
| -------------------------------- | -------------------- |
| `smoke/conductor-login.e2e.ts`   | C1                   |
| `smoke/web-login-shell.e2e.ts`   | W1, W3, W5 (partial) |
| `smoke/app-login.e2e.ts`         | F1                   |
| `smoke/web-projects-list.e2e.ts` | P1                   |

### Tier 1 — Core happy paths

| Spec                                 | Workflows                                       |
| ------------------------------------ | ----------------------------------------------- |
| `web/teams.e2e.ts`                   | T1–T4                                           |
| `web/templates-create.e2e.ts`        | TP1–TP3                                         |
| `web/projects-create.e2e.ts`         | P2, P3, P8                                      |
| `web/designer-basic.e2e.ts`          | TP5/P9, D1, D5, D8 (minimal form + text + save) |
| `app/notebook-activate.e2e.ts`       | N1, N2, N4                                      |
| `app/record-crud.e2e.ts`             | N8, N9, N11, N12                                |
| `journeys/template-to-record.e2e.ts` | Cross: TP2 → Designer → P8 → F1 → N2 → N8       |

### Tier 2 — Lifecycle & invites

| Spec                                     | Workflows     |
| ---------------------------------------- | ------------- |
| `web/team-invites.e2e.ts`                | T7, T8        |
| `web/project-invites.e2e.ts`             | P4            |
| `conductor/register-invite.e2e.ts`       | C3, C4        |
| `web/project-status-archive.e2e.ts`      | P13, P14, A1  |
| `web/template-visibility-archive.e2e.ts` | TP9, TP10, A2 |
| `app/sync-settings.e2e.ts`               | S1, S2, S5    |

### Tier 3 — Admin, permissions, offline UI, exports

| Spec                              | Workflows                                        |
| --------------------------------- | ------------------------------------------------ |
| `web/users-admin.e2e.ts`          | U1–U3, U5 (U4 covered by app F8)                 |
| `web/profile-tokens.e2e.ts`       | PR1–PR3                                          |
| `web/exports.e2e.ts`              | P6 (dialog; download-dir assert deferred)        |
| `web/offline-map-region.e2e.ts`   | P7 (UI; OpenLayers draw/save deferred)           |
| `web/permissions-matrix.e2e.ts`   | T11                                              |
| `app/impersonation.e2e.ts`        | F8                                               |
| `conductor/password-reset.e2e.ts` | C6–C8 (admin `POST /api/reset`; no mail catcher) |

### Tier 4 — Deferred / not yet automated

| Area                          | Notes                                              |
| ----------------------------- | -------------------------------------------------- |
| CDP offline collect (S4)      | Classic WebDriver limitation; no `offline-collect` |
| Chrome download assert (P6)   | Export dialog covered; file download not asserted  |
| OpenLayers draw/save (P7)     | Region UI only                                     |
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
  "test": "T2: should open create team dialog",
  "workflowId": "T2",
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
- Each new spec should list workflow IDs in a header comment.
- Keep `maxInstances: 1` for auth-heavy suites (token-exchange races).
- Product scaffolding for tests belongs in `app` / `web` / `api/views` as
  stable `data-testid`s, not brittle text selectors.
