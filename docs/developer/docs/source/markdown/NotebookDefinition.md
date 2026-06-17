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

- `library/data-model/src/data_storage/projectsDB/types.ts` — projects DB v4
- `library/data-model/src/data_storage/templatesDB/types.ts` — templates DB v5
- `library/data-model/src/uiSpecification/types.ts` — `NotebookDefinition`, `NotebookUiSpec`, partitions

### Project (survey) root fields

| Field                    | Purpose                                                                                                                                 |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `_id`                    | Stable survey id (also used as `data-{id}` suffix)                                                                                      |
| `name`                   | Display title                                                                                                                           |
| `description` (optional) | Short operational blurb (listings, Control Centre), max **250** characters when set — **not** the long design prose (`purposeMarkdown`) |
| `status`                 | `OPEN` \| `CLOSED` \| `ARCHIVED`                                                                                                        |
| `dataDb`                 | Connection to `data-{id}`                                                                                                               |
| `templateId`             | Source template when created from a template                                                                                            |
| `ownedByTeamId`          | Owning team                                                                                                                             |
| `createdBy`              | People DB user id of whoever created the survey                                                                                         |
| `createdAt`, `updatedAt` | ISO-8601 audit timestamps                                                                                                               |
| `uiSpecification`        | Full design bundle (see below)                                                                                                          |

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
- **`schemaVersion`** — notebook JSON schema version (`CURRENT_NOTEBOOK_UI_SCHEMA_VERSION`); drives `migrateNotebook`. Lives on **`uiSpec`**, not under `metadata.information`.

### `metadata` partition

| Sub-key       | Purpose                                                                                                                                             |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `information` | Non-functional design documentation (`purposeMarkdown`, `projectLeadLabel`, `leadInstitution`, `notebookVersion`, optional `derivedFromTemplateId`) |
| `custom`      | Optional org-specific key/value bag for keys that do not fit the typed core                                                                         |

Dropped from the typed core (not migrated into `custom`): `accesses`, `ispublic`, `isrequest`, `sections`, `filenames`, empty `meta`, `template_id` inside metadata, `project_id`, `project_status`, etc. See `migrateV4.ts` for the authoritative lists.

## Deploying an upgrade

Step-by-step rollout (Couch migrate, validation, deleting `metadata-*` DBs, when notebook JSON migrates on server and clients): [Metadata migration guide](./MetadataMigrationGuide.md).

## API surfaces

| Operation            | Route                                    | Body                                                                                   |
| -------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------- |
| Get full survey      | `GET /api/notebooks/:id`                 | Full `ProjectDocument` (+ optional `recordCount`)                                      |
| List surveys         | `GET /api/notebooks`                     | `ProjectListItem` (no `uiSpecification`)                                               |
| Update title / blurb | `PUT /api/notebooks/:id`                 | `{ name?, description? }` partial; `UPDATE_PROJECT_DETAILS`                            |
| Replace design       | `PUT /api/notebooks/:id/uiSpecification` | Loose JSON; server runs `migrateNotebook` + strict validation; `UPDATE_PROJECT_UISPEC` |
| Create from scratch  | `POST /api/notebooks`                    | `{ name, description?, uiSpecification, teamId? }`                                     |
| Create from template | `POST /api/notebooks`                    | `{ name, description?, template_id, teamId? }`                                         |

Templates mirror this: `PUT /api/templates/:id` for optional `name` / `description`, `PUT /api/templates/:id/uiSpecification` for the design bundle. **Create:** `POST /api/templates` with `{ name, description?, uiSpecification, teamId?, isPublic? }`.

**Root `description` rules** (surveys and templates):

- **Optional** on create and in persisted documents (`ProjectDBFieldsSchema` / `TemplateDBFieldsSchema` via `PersistedRootDescriptionSchema` in `library/data-model/src/data_storage/rootMetadata.ts`).
- When provided: trimmed, max **250** characters (`ROOT_DESCRIPTION_MAX_LENGTH`).
- Omitted or whitespace-only on create → field is not stored (not copied from a template, source survey, or a root `description` key in an uploaded design JSON file).

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

1. **Notebook JSON** (`migrateNotebook` in `notebookMigrations/index.ts`): sequential steps through historical versions until **`CURRENT_NOTEBOOK_UI_SCHEMA_VERSION`**. See the pipeline table in [Notebook migrations](./NotebookMigrations.md).
2. **Projects DB** (`projectsV3toV4Migration`): reads legacy metadata DB + project doc, builds `uiSpecification`, adds root `description` (when derivable from legacy metadata) / audit fields, removes `metadataDb`.
3. **Templates DB** — analogous template v4 → v5 migration.

Optional startup migration: `MIGRATE_NOTEBOOKS_ON_STARTUP` still runs notebook migrations when validating databases.

After all projects are on v4 with inlined specs, operators can remove orphaned Couch databases:

```sh
cd api && pnpm run delete-metadata-databases -- --dry-run
```

See `api/src/scripts/deleteMetadataDatabases.ts`.

## Designer and mobile app

- **Designer** (`web/src/designer`): Redux state is a `NotebookDefinition`; save goes through `PUT …/uiSpecification`. Info panel edits `metadata.information` and `uiSpec.settings`.
- **Mobile app**: loads `uiSpecification` from the synced project document; local Redux persist may run `projectsPersistMigration` for cached legacy shapes.

## Related docs

- [Metadata migration guide](./MetadataMigrationGuide.md) — deployment and cutover
- [Notebook migrations](./NotebookMigrations.md) — version pipeline
- [Couch migrations](./CouchMigrations.md) — projects/templates DB versioning
- [Configuration](./Configuration.md) — where notebook vs app-level config lives
- [Database layout](../../../../../api/doc/DATABASE.md) — CouchDB databases
