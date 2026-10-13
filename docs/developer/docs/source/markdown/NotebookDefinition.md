# Notebook definition and project metadata

This document describes the storage model for surveys (projects) and templates, including how legacy notebook JSON and the former per-project metadata database map into the current shape.

## Terminology

| Term              | Storage                                                             |
| ----------------- | ------------------------------------------------------------------- |
| Survey / notebook | Couch document in the **`projects`** database (`ProjectDocument`)   |
| Template          | Couch document in the **`templates`** database (`TemplateDocument`) |
| Design bundle     | Nested **`uiSpecification`** on the project or template document    |

There is **no per-project `metadata-{id}` Couch database** in the current model. Former `ui-specification` and `project-metadata-*` documents are inlined into **`uiSpecification`** on the parent document.

## Document layers

Each **project** or **template** document has two layers:

1. **Root (resource / lifecycle / instantiation)** — `name`, optional `description`, `status`, `dataDb`, team and template linkage, audit timestamps and creator.
2. **`uiSpecification`** — the form design: decoded UI graph plus typed design metadata and settings.

Types live in `@faims3/data-model`:

- `library/data-model/src/data_storage/projectsDB/types.ts` — projects DB v5
- `library/data-model/src/data_storage/templatesDB/types.ts` — templates DB v6
- `library/data-model/src/uiSpecification/types.ts` — `NotebookDefinition`, `NotebookUiSpec`, partitions
- `library/data-model/src/uiSpecification/uiSpecProperties.ts` — listing digest (`schemaVersion` + hash)

### Project (survey) root fields

| Field                    | Purpose                                                                                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_id`                    | Stable survey id (also used as `data-{id}` suffix)                                                                                                       |
| `name`                   | Display title                                                                                                                                            |
| `description` (optional) | Short operational blurb (listings, Control Centre), max **250** characters when set — **not** the long design prose (`purposeMarkdown`)                  |
| `status`                 | `OPEN` \| `CLOSED` \| `ARCHIVED`                                                                                                                         |
| `dataDb`                 | Connection to `data-{id}`                                                                                                                                |
| `templateId`             | Source template when created from a template                                                                                                             |
| `ownedByTeamId`          | Owning team                                                                                                                                              |
| `createdBy`              | People DB user id of whoever created the survey                                                                                                          |
| `createdAt`, `updatedAt` | ISO-8601 audit timestamps                                                                                                                                |
| `disableQuickShare`      | Optional. When `true`, the field app hides Quick Share and creation is refused. Omitted or `false` leaves it available. See [Quick share](#quick-share). |
| `uiSpecification`        | Full design bundle (see below)                                                                                                                           |
| `uiSpecProperties`       | Digest of the stored design (`schemaVersion` + SHA-256 hash) so listings can omit `uiSpecification`                                                      |

**Removed from the project document:** `metadataDb` (projects DB v4 migration inlines the former metadata database).

### Template root fields

Same pattern as projects (including optional root `description`, max 250 characters when set), plus `version`, `archived`, `isPublic`. Templates do not have `status` or `dataDb`.

## `uiSpecification` shape

```typescript
interface NotebookDefinition {
  uiSpec: NotebookUiSpec;
  metadata: NotebookMetadata;
}
```

### `uiSpec` (form graph + settings)

- **`fields`**, **`views`**, **`viewsets`**, **`visible_types`** — same logical content as the legacy Couch `ui-specification` document, but **`fviews` is decoded to `views`** when persisted (current schema).
- Inner field keys remain **legacy-shaped** (`component-namespace`, `type-returned`, …) — not renamed in this pass.
- **`settings`** — functional toggles (camelCase), e.g. `showQrCodeButton` (former loose `metadata.showQRCodeButton`).
- **`schemaVersion`** — the **platform format version** of the notebook JSON. Strict semver `MAJOR.MINOR.PATCH` (epoch starts at `1.0.0`; current value is `CURRENT_NOTEBOOK_UI_SCHEMA_VERSION`). Drives `migrateNotebook` on write and the app's compatibility tier on read (patch = silent, newer minor = degraded render with a warning, newer major = rejected form with a skeleton). Lives on **`uiSpec`**, not under `metadata.information`. The deprecated two-part values (`1.0`…`7.0`) are collapsed to `1.0.0` on migration. This is **not** the author-managed `metadata.information.notebookVersion` label.

### `metadata` partition

| Sub-key       | Purpose                                                                                                                                                                                                               |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `information` | Non-functional design documentation (`purposeMarkdown`, `projectLeadLabel`, `leadInstitution`, `notebookVersion` — a free-text author label, not the platform `schemaVersion` — and optional `derivedFromTemplateId`) |
| `custom`      | Optional org-specific key/value bag for keys that do not fit the typed core                                                                                                                                           |

Dropped from the typed core (not migrated into `custom`): `accesses`, `ispublic`, `isrequest`, `sections`, `filenames`, empty `meta`, `template_id` inside metadata, `project_id`, `project_status`, etc. See the `V5_KEYS_MAPPED` / `V5_KEYS_DROPPED` sets in `notebookMigrations/steps/legacyToV1.ts` for the authoritative lists.

### Zod models and versioned types

`library/data-model/src/uiSpecification/types.ts` defines the notebook JSON model in **versioned blocks** with paired inferred types — `NotebookDefinitionV1Schema` / `NotebookDefinitionV1`, `NotebookUiSpecV1Schema`, `NotebookMetadataV1Schema`, `TemplateDefinitionV1Schema`, `CompiledNotebookDefinitionV1Schema`, … — following the `projectsDB/types.ts` / `templatesDB/types.ts` convention. The unversioned names (`NotebookDefinitionSchema`, `NotebookDefinition`, `TemplateDefinition`, …) are **aliases of the latest block**; import those unless you are writing a migration step. `schemaVersion` is validated by `NotebookSchemaSemverSchema` (`uiSpecification/schemaVersion.ts`).

## Deploying an upgrade

Step-by-step rollout (Couch migrate, validation, deleting `metadata-*` DBs, when notebook JSON migrates on server and clients): [Metadata migration guide](./MetadataMigrationGuide.md).

## API surfaces

| Operation            | Route                                    | Body                                                                                           |
| -------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Get full survey      | `GET /api/notebooks/:id`                 | Full `ProjectDocument` (+ optional `recordCount`)                                              |
| List surveys         | `GET /api/notebooks`                     | Lean `ProjectListItem` (no `uiSpecification`). Pass `includeByteCount=true` for storage sizes. |
| Device directory     | `GET /api/directory`                     | Cheap alias of the notebooks list (no `byteCount`)                                             |
| Update title / blurb | `PUT /api/notebooks/:id`                 | `{ name?, description?, disableQuickShare? }` partial; `UPDATE_PROJECT_DETAILS`                |
| Replace design       | `PUT /api/notebooks/:id/uiSpecification` | Loose JSON; server runs `migrateNotebook` + strict validation; `UPDATE_PROJECT_UISPEC`         |
| Create from scratch  | `POST /api/notebooks`                    | `{ name, description?, uiSpecification, teamId? }`                                             |
| Create from template | `POST /api/notebooks`                    | `{ name, description?, template_id, teamId? }`                                                 |

Templates mirror this: `PUT /api/templates/:id` for optional `name` / `description`, `PUT /api/templates/:id/uiSpecification` for the design bundle. **Create:** `POST /api/templates` with `{ name, description?, uiSpecification, teamId?, isPublic? }`.

**Root `description` rules** (surveys and templates):

- **Optional** on create and in persisted documents (`ProjectDBFieldsSchema` / `TemplateDBFieldsSchema` via `PersistedRootDescriptionSchema` in `library/data-model/src/data_storage/rootMetadata.ts`).
- When provided: trimmed, max **250** characters (`ROOT_DESCRIPTION_MAX_LENGTH`).
- Omitted or whitespace-only on create → field is not stored (not copied from a template, source survey, or a root `description` key in an uploaded design JSON file).

## Quick share

`POST /api/invites/notebook/:projectId/quick-share` creates one survey invite from the field app. The caller must be authenticated. The body is `{ role }`.

- **`role`** — a survey role. Permission matches creating a notebook invite for that same role.

The code always lasts one hour (`DEFAULT_QUICK_SHARE_LIFETIME_MS` in `library/data-model/src/inviteCode.ts`). The request body cannot choose a duration. The document is a normal project invite (`kind: 'quick-share'`, name `Quick share`) with unlimited uses until `expiry`. Scanning and redemption use the existing invite path. The request has to reach the server.

One live Quick Share per person per survey. A second create returns that code when the caller can still create its role, and does not mint another beside it.

**`disableQuickShare`** is the admin switch. It is an optional boolean on the project root, not part of `uiSpecification`, so it does not travel with a design JSON upload. Set it with `PUT /api/notebooks/:id` and `{ "disableQuickShare": true }` (`UPDATE_PROJECT_DETAILS`). That request does not migrate the notebook schema. `true` makes this POST return 403 and the field app hides Share. Omitted or `false` leaves Quick Share available. Turning the flag on does not delete a code that already exists. Remove one with `DELETE /api/invites/notebook/:projectId/:inviteId`.

### JSON file upload / export

Downloaded and uploaded definition files use a **flat** wire shape at the JSON root (not a nested `uiSpecification` property):

```json
{
  "uiSpec": {
    "fields": {},
    "views": {},
    "viewsets": {},
    "visible_types": [],
    "settings": {"showQrCodeButton": false},
    "schemaVersion": "<CURRENT_NOTEBOOK_UI_SCHEMA_VERSION>"
  },
  "metadata": {
    "information": {
      "notebookVersion": "1.0",
      "purposeMarkdown": "",
      "projectLeadLabel": "",
      "leadInstitution": ""
    }
  }
}
```

Validated by `NotebookDefinitionUploadSchema` in `library/data-model/src/uiSpecification/types.ts`.

Legacy exports with top-level `metadata` + `ui-specification` (kebab-case, `fviews`) are accepted on **`PUT …/uiSpecification`** and migrated server-side.

## Migrations

1. **Notebook JSON** (`migrateNotebook` in `notebookMigrations/runner.ts`): a typed harness (registry + path finder + per-step migrate/validate) that brings any document up to **`CURRENT_NOTEBOOK_UI_SCHEMA_VERSION`**. All pre-semver shapes collapse in one `legacy → 1.0.0` step. See [Notebook migrations](./NotebookMigrations.md).
2. **Projects DB** (`projectsV3toV4Migration`): reads legacy metadata DB + project doc, builds `uiSpecification`, adds root `description` (when derivable from legacy metadata) / audit fields, removes `metadataDb`.
3. **Templates DB** — analogous template v4 → v5 migration.
4. **Listing digest** (`projectsV4toV5Migration` / `templatesV5toV6Migration`): adds mandatory `uiSpecProperties` so listings can omit `uiSpecification`.

API startup always runs notebook migrations when validating databases (projects and templates).

After all projects are on v4 with inlined specs, operators can remove orphaned Couch databases:

```sh
cd api && pnpm run delete-metadata-databases --dry-run
```

See `api/src/scripts/deleteMetadataDatabases.ts`.

## Designer and mobile app

- **Designer** (`web/src/designer`): Redux state is a `NotebookDefinition`; save goes through `PUT …/uiSpecification`. Info panel edits `metadata.information` and `uiSpec.settings`.
- **Mobile app**: listing uses `uiSpecProperties` from `GET /api/directory`; the full `uiSpecification` is fetched on activation or when the directory hash changes. Local Redux persist may run `projectsPersistMigration` for cached legacy shapes.

## Related docs

- [Metadata migration guide](./MetadataMigrationGuide.md) — deployment and cutover
- [Notebook migrations](./NotebookMigrations.md) — version pipeline
- [Couch migrations](./CouchMigrations.md) — projects/templates DB versioning
- [Configuration](./Configuration.md) — where notebook vs app-level config lives
- [Database layout](../../../../../api/doc/DATABASE.md) — CouchDB databases
