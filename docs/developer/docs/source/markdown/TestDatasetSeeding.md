# Test Dataset Seeding

## Overview

The `seed-test-dataset` npm script creates a deterministic, permission-testing
dataset in the configured CouchDB instance. It is designed to support:

- **End-to-end testing** — a known set of users and resources that the e2e tests
  can authenticate against.
- **Permission regression testing** — a stable set of personas covering the core
  team and project permission scenarios used by the current test suite.
- **Cross-team visibility testing** — the seeded team memberships are designed
  to exercise the scenarios where a user's visibility of projects differs between
  the two teams they belong to.

> **Idempotent seed.** Re-running the script restores the canonical Red/Blue
> teams, templates, notebooks, and seed personas (stable document IDs under
> `team_seed_*` / `template_seed_*` / `notebook_seed_*`) to the intended state.
> It only creates or updates those seed documents and personas — it does not
> delete other CouchDB data. Prefer not to run it against a production or
> shared staging instance unless you intend to reset those seed entities.

---

## Running the Script

From the `api/` workspace directory:

```bash
pnpm run seed-test-dataset
```

Or from the monorepo root:

```bash
pnpm --filter @faims3/api run seed-test-dataset
```

The script prints a summary of all created entities and exits with code `0` on
success or `1` on failure. It is safe to re-run against an already-seeded
database.

### Environment Variables

| Variable              | Default                                                         | Description                                                                                                                  |
| --------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `TEST_SEED_PASSWORD`  | `TestPassword123!`                                              | Shared local-auth password for all seeded users.                                                                             |
| `TEST_SEED_NOTEBOOKS` | `./notebooks/e2e-minimal.json,./notebooks/sample_notebook.json` | Comma-separated paths to notebook JSON files used to create templates and notebooks. The script requires at least two files. |

Standard CouchDB connection variables (`COUCHDB_INTERNAL_URL`,
`COUCHDB_USER`, `COUCHDB_PASSWORD`) are read from the project `.env` file via
`env-cmd`, the same as all other API scripts.

---

## What Gets Seeded

### Teams

Two teams are upserted (stable IDs `team_seed_red` / `team_seed_blue`), giving
a Red/Blue axis for cross-team visibility tests.

| Internal alias | Document ID      | Name      | Purpose                                           |
| -------------- | ---------------- | --------- | ------------------------------------------------- |
| `redTeamId`    | `team_seed_red`  | Red Team  | Team where cross-team manager has elevated access |
| `blueTeamId`   | `team_seed_blue` | Blue Team | Team where the same user has only member access   |

---

### Templates

One template is upserted per team (stable IDs `template_seed_red` /
`template_seed_blue`), sourced from the first two notebook JSON files resolved
from `TEST_SEED_NOTEBOOKS`.

| Internal alias   | Document ID          | Owner     | Default source file                |
| ---------------- | -------------------- | --------- | ---------------------------------- |
| `redTemplateId`  | `template_seed_red`  | Red Team  | `./notebooks/e2e-minimal.json`     |
| `blueTemplateId` | `template_seed_blue` | Blue Team | `./notebooks/sample_notebook.json` |

The Red default is a single required text field so Fieldmark app record CRUD
e2e stays practical in headless Chromium. Blue keeps the fuller sample survey.

---

### Notebooks (Surveys)

One notebook (project/survey) is upserted per team (stable IDs
`notebook_seed_red` / `notebook_seed_blue`), using the same JSON sources as the
templates above.

| Internal alias   | Document ID          | Owner     | Default source file                |
| ---------------- | -------------------- | --------- | ---------------------------------- |
| `redNotebookId`  | `notebook_seed_red`  | Red Team  | `./notebooks/e2e-minimal.json`     |
| `blueNotebookId` | `notebook_seed_blue` | Blue Team | `./notebooks/sample_notebook.json` |

---

### Users and Roles

All seeded users share the value of `TEST_SEED_PASSWORD`.
Every user receives `GENERAL_USER` by default.

#### seed-admin@faims.test — Seed Administrator

Operations-level administration plus resource roles needed for Control Centre
archive / visibility e2e (ops global roles alone do not grant READ on private
team templates).

| Scope         | Role               |
| ------------- | ------------------ |
| Global        | `OPERATIONS_ADMIN` |
| Red Template  | `TEMPLATE_ADMIN`   |
| Blue Notebook | `PROJECT_ADMIN`    |

**Test use:** Log in to the dashboard as an operations admin; exercise Users
admin, global invites, and Red template / Blue project archive controls.

---

#### seed-manager-blue@faims.test — Blue Team Manager

Single-team manager persona for Blue Team.

| Scope     | Role           |
| --------- | -------------- |
| Blue Team | `TEAM_MANAGER` |

**Test use:** Verify management capabilities for Blue Team and the absence of
manager permissions for Red Team resources.

---

#### seed-manager-cross@faims.test — Cross-Team Manager

Cross-team visibility scenario: manager on Red, only a member on Blue.

| Scope     | Role           |
| --------- | -------------- |
| Red Team  | `TEAM_MANAGER` |
| Blue Team | `TEAM_MEMBER`  |

**Test use:** Verify cross-team differences where the same user has elevated
permissions in Red Team and member-level access in Blue Team.

---

#### seed-member-both@faims.test — Dual Team Member

Plain contributor on both teams. Useful as a baseline "normal user" persona.

| Scope     | Role          |
| --------- | ------------- |
| Red Team  | `TEAM_MEMBER` |
| Blue Team | `TEAM_MEMBER` |

**Test use:** Verify that this user can see projects from both teams but
cannot manage any team settings or create new projects.

---

#### seed-red-member-creator@faims.test — Red Team Member-Creator

Team-level member creator on Red Team only.

| Scope    | Role                  |
| -------- | --------------------- |
| Red Team | `TEAM_MEMBER_CREATOR` |

**Test use:** Verify creator capabilities for Red Team with no equivalent
membership in Blue Team.

---

#### seed-user@faims.test — General User

Lowest-permission baseline persona with no explicit roles beyond default
`GENERAL_USER`.

| Scope  | Role             |
| ------ | ---------------- |
| Global | `GENERAL_USER`\* |

\* `GENERAL_USER` is assigned automatically to created users.

**Test use:** Baseline assertions for restricted visibility and no privileged
management actions.

---

#### seed-project-contributor@faims.test — Project Contributor

Direct project-level contributor on Red Notebook, without any team
membership. Exercises the scenario where project roles are assigned
independently of team membership.

| Scope        | Role                  |
| ------------ | --------------------- |
| Red Notebook | `PROJECT_CONTRIBUTOR` |

**Test use:** Verify that this user can see and contribute to the Red
Notebook but cannot see the Blue Notebook.

---

#### seed-project-guest@faims.test — Project Guest

Read-limited guest on Blue Notebook only. Can only see their own
contributions.

| Scope         | Role            |
| ------------- | --------------- |
| Blue Notebook | `PROJECT_GUEST` |

**Test use:** Verify that this user can view only their own records in the
Blue Notebook and is not shown any other projects.

---

## Current Role Assignment Matrix

The table below maps the roles currently assigned by the seed script to the
seeded users.

| Role                  | User(s)                                                 |
| --------------------- | ------------------------------------------------------- |
| `GENERAL_USER`        | All users (default)                                     |
| `OPERATIONS_ADMIN`    | seed-admin                                              |
| `TEMPLATE_ADMIN`      | seed-admin (Red)                                        |
| `TEAM_MANAGER`        | seed-manager-blue (Blue), seed-manager-cross (Red)      |
| `TEAM_MEMBER`         | seed-manager-cross (Blue), seed-member-both (Red, Blue) |
| `TEAM_MEMBER_CREATOR` | seed-red-member-creator (Red)                           |
| `PROJECT_ADMIN`       | seed-admin (Blue)                                       |
| `PROJECT_CONTRIBUTOR` | seed-project-contributor (Red)                          |
| `PROJECT_GUEST`       | seed-project-guest (Blue)                               |

---

## E2E Test Credentials

After running the seed script, copy `e2e/.env.dist` → `e2e/.env` (defaults
match the seed password and persona emails). Key personas:

```bash
# Operations admin (Users admin, archive/visibility)
TEST_OPERATIONS_ADMIN_USERNAME=seed-admin@faims.test
TEST_OPERATIONS_ADMIN_PASSWORD=TestPassword123!

# Dual team member (projects list / create-within-team)
TEST_MEMBER_BOTH_USERNAME=seed-member-both@faims.test
TEST_MEMBER_BOTH_PASSWORD=TestPassword123!

# Also used as TEST_USER_* in some older specs
TEST_USER_USERNAME=seed-user@faims.test
TEST_USER_PASSWORD=TestPassword123!
```

Role-specific users follow `seed-<persona>@faims.test` and share
`TEST_SEED_PASSWORD`. Full env map and suite commands:
[e2e/README.md](../../../../../e2e/README.md), workflow inventory:
[e2e/SUITE.md](../../../../../e2e/SUITE.md).

---

## Extending the Dataset

To add a new seeded user or role assignment:

1. Add a new `UserSpec` entry to the `USER_SPECS` array in
   `api/src/scripts/seedTestDataset.ts`.
2. Use a stable email address under the `faims.test` domain.
3. Add any resource-role assignments inside the `assignResourceRoles` callback.
4. Run the seed script locally and verify the generated summary output matches
   your expected personas and roles.
5. Update this documentation to include the new persona in the user table and
   role assignment matrix above.

Avoid adding project-level roles without also documenting the expected
permission behaviour so that future e2e test authors know what assertions are
valid for the persona.

---

## Related Documentation

- [Permissions Model](PermissionModel.md) — detailed description of roles,
  actions, resources, and virtual role inheritance.
- [E2E README](../../../../../e2e/README.md) — how to run the browser suite and CI.
- [E2E suite inventory](../../../../../e2e/SUITE.md) — specs by tier.
