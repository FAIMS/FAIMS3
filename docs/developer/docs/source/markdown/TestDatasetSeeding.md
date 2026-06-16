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

> **Warning: This is a destructive operation.**
> Running the seed script calls `initialiseAndMigrateDBs` with `force: true`,
> which re-creates CouchDB design documents and wipes all existing data.
> **Never run this against a production or shared staging instance.**

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
success or `1` on failure.

### Environment Variables

| Variable              | Default                                                           | Description                                                                                                                  |
| --------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `TEST_SEED_PASSWORD`  | `TestPassword123!`                                                | Shared local-auth password for all seeded users.                                                                             |
| `TEST_SEED_NOTEBOOKS` | `./notebooks/Field-Sampler.json,./notebooks/sample_notebook.json` | Comma-separated paths to notebook JSON files used to create templates and notebooks. The script requires at least two files. |

Standard CouchDB connection variables (`COUCHDB_INTERNAL_URL`,
`LOCAL_COUCHDB_AUTH_*`) are read from the project `.env` file via `env-cmd`,
the same as all other API scripts.

---

## What Gets Seeded

### Teams

Two teams are created, giving a Red/Blue axis for cross-team visibility tests.

| Internal alias | Name      | Purpose                                           |
| -------------- | --------- | ------------------------------------------------- |
| `redTeamId`    | Red Team  | Team where cross-team manager has elevated access |
| `blueTeamId`   | Blue Team | Team where the same user has only member access   |

---

### Templates

One template is created per team, sourced from the first two notebook JSON
files resolved from `TEST_SEED_NOTEBOOKS`.

| Internal alias   | Owner     | Source file               |
| ---------------- | --------- | ------------------------- |
| `redTemplateId`  | Red Team  | First notebook JSON file  |
| `blueTemplateId` | Blue Team | Second notebook JSON file |

---

### Notebooks (Surveys)

One notebook (project/survey) is created per team, using the same JSON
sources as the templates above.

| Internal alias   | Owner     | Source file               |
| ---------------- | --------- | ------------------------- |
| `redNotebookId`  | Red Team  | First notebook JSON file  |
| `blueNotebookId` | Blue Team | Second notebook JSON file |

---

### Users and Roles

All seeded users share the value of `TEST_SEED_PASSWORD`.
Every user receives `GENERAL_USER` by default.

#### seed-admin@faims.test — Seed Administrator

Covers operations-level administration without team, template, or project
memberships.

| Scope  | Role               |
| ------ | ------------------ |
| Global | `OPERATIONS_ADMIN` |

**Test use:** Log in to the dashboard as an operations admin and verify
administrative features that are controlled by global admin roles.

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
| `TEAM_MANAGER`        | seed-manager-blue (Blue), seed-manager-cross (Red)      |
| `TEAM_MEMBER`         | seed-manager-cross (Blue), seed-member-both (Red, Blue) |
| `TEAM_MEMBER_CREATOR` | seed-red-member-creator (Red)                           |
| `PROJECT_CONTRIBUTOR` | seed-project-contributor (Red)                          |
| `PROJECT_GUEST`       | seed-project-guest (Blue)                               |

---

## E2E Test Credentials

After running the seed script, set these environment variables before running
the e2e test suite:

```bash
export TEST_ADMIN_USERNAME="seed-admin@faims.test"
export TEST_ADMIN_PASSWORD="TestPassword123!"   # or value of TEST_SEED_PASSWORD

export TEST_USER_USERNAME="seed-member-both@faims.test"
export TEST_USER_PASSWORD="TestPassword123!"
```

Role-specific test users follow the naming convention
`seed-<persona>@faims.test` and all share the same password.

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
