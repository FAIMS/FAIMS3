# Project lifecycle

Surveys (projects / notebooks) move through a set of server-side statuses,
then optionally through **permanent deletion**. This page documents that lifecycle
and the tombstone safety system that protects Fieldmark devices from wiping local
data when the server is merely glitched or the user has lost access.

Related code:

- Status enum: `ProjectStatus` in `library/data-model` (`projectsDB/types.ts`)
- Status / delete API: `api/src/api/notebooks.ts`
- Tombstone DB + API: `library/data-model/.../tombstoneDB`, `api/src/api/tombstones.ts`
- App cleanup: `initialiseProjects` in `app/src/context/slices/projectSlice.ts`
  (see also [App initialisation](./AppInitialisation.md))

## Statuses

| Status     | Meaning                                           | Typical visibility                   |
| ---------- | ------------------------------------------------- | ------------------------------------ |
| `OPEN`     | Survey is active for field work                   | In default directory / project lists |
| `CLOSED`   | Survey is closed; not accepting normal field work | Still listed; can be reopened        |
| `ARCHIVED` | Soft-retired; hidden from default lists           | Archive UI / `includeArchived=true`  |

Transitions use `PUT /api/notebooks/:id/status` with `{ status }`.

Permissions (see [Permission model](./PermissionModel.md)):

- **Open ↔ closed** — `CHANGE_PROJECT_STATUS` (project managers and above).
- **Archive / restore from archive** — `CHANGE_PROJECT_ARCHIVE_STATUS` (project
  administrators). Restore from archive returns the survey to `CLOSED`, not
  `OPEN`.
- You cannot open an archived survey in one step; restore to closed first.

Archived surveys are excluded from `GET /api/directory` unless
`includeArchived=true`. That absence from the active directory is what causes the
Fieldmark app to notice them during refresh.

## Permanent deletion

Permanent destroy is **not** a `ProjectStatus` value. It removes server data:

1. `POST /api/notebooks/:id/delete` with `{ confirmName }` matching the survey
   name (trimmed).
2. Requires `DELETE_PROJECT` (project admin for that survey, or operations
   staff).
3. Before destroying Couch data, the API writes a **tombstone** document.
4. Invites and people-DB project roles for that survey are stripped; the project
   document and per-project data DB are destroyed.

After deletion there is no project document left to query, only the tombstone.

## Tombstones

### Purpose

A tombstone is durable proof that a survey ID was **intentionally** deleted.
Fieldmark uses that proof before removing local PouchDB data. Without it, a
transient 404/403 (server blip, access revoked, directory lag) must not erase a
device’s offline records.

### Database

- CouchDB name: `tombstone` (`DatabaseType.TOMBSTONE`)
- Document `_id`: the deleted survey / project ID
- Fields: `name`, `deletedAt` (ms), `deletedBy` (user id), optional
  `ownedByTeamId`, `dataDbName`
- Admin-only Couch security (server-side API access only)
- Initialised like other global DBs; target schema version 1 (no data migrations)

### API

`GET /api/tombstones/:id`

- Auth required; action `READ_PROJECT_TOMBSTONE` (global; granted to
  `GENERAL_USER` alongside `LIST_PROJECTS`)
- **200** — tombstone document (survey was permanently deleted)
- **404** — no tombstone for that id

Swagger: `api/public/swagger.json` under `/tombstones/{id}`.

## App safety model

When the app refreshes the project list (`initialiseProjects` / workspace
Refresh):

```text
Local survey absent from GET /api/directory?
  ├─ GET /api/notebooks/:id → ARCHIVED     → remove local project immediately
  ├─ GET /api/notebooks/:id → active         → keep local (unexpected listing gap)
  ├─ GET /api/notebooks/:id → unreachable    → keep local
  └─ GET /api/notebooks/:id → missing (401/403/404)
        ├─ GET /api/tombstones/:id → 200     → remove local project
        └─ 404 or error                      → keep local (no proof of delete)
```

Local removal respects `forceRemoteDeletion` (`allow` destroys local storage;
`never` detaches the project from the store but retains local DB files).

### Why archive is immediate

An `ARCHIVED` response from `GET /api/notebooks/:id` means the survey still
exists and the server explicitly marked it archived. That is an unambiguous
lifecycle signal, so the app cleans up local activation without needing a
tombstone.

### Why delete needs a tombstone

`missing` only means “this token cannot read that notebook.” Causes include
permanent delete, revoked roles, or temporary failures. Only a tombstone
distinguishes intentional destruction from those other cases.

## E2E coverage

- Web / API: `e2e/test/specs/web/project-delete-tombstone.e2e.ts`
- App cleanup: `e2e/test/specs/app/survey-remote-cleanup.e2e.ts`
  (tombstoned → removed; access revoked without tombstone → kept)
