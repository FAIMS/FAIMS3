# Notebook migrations

`library/data-model/src/data_storage/migrations/notebookMigrations` migrates **notebook definition JSON** (the design bundle) through schema versions. This is separate from **Couch document migrations** for the `projects` and `templates` databases (see [Couch migrations](./CouchMigrations.md)).

**Deploying this metadata overhaul?** Use the step-by-step operator guide: [Metadata migration guide](./MetadataMigrationGuide.md).

## Schema version

The active version is **`CURRENT_NOTEBOOK_UI_SCHEMA_VERSION`** in `notebookMigrations/index.ts` (single source of truth for the latest notebook schema).

Version is read from, in order:

1. Legacy wire: `metadata.schema_version`
2. Current wire: `uiSpec.schemaVersion`

After migration, **`schemaVersion` is stored on `uiSpec`** (not under `metadata.information`).

## Pipeline

| From                     | Migration     | Main effect                                                                                                                                                                      |
| ------------------------ | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| missing / `null` / `1.0` | `migrateToV2` | Normalise legacy `ui-specification` structures; set `schema_version` to `2.0`                                                                                                    |
| `2.0`                    | `migrateToV3` | Remove `metadata.project_status`; set `3.0`                                                                                                                                      |
| `3.0`                    | `migrateToV4` | Rewrite legacy field component names to canonical registry names; set `schema_version` to `4.0`                                                                                  |
| `4.0`                    | `migrateToV5` | Split wire `{ metadata, 'ui-specification' }` into `{ uiSpec, metadata }` with typed `information` / `settings` / `custom`; decode `fviews` → `views`; set `schemaVersion` `5.0` |

`migrateNotebook` runs the chain until the document reaches the current schema version.

## When migrations run

- **API** — `PUT /api/notebooks/:id/uiSpecification` and template equivalent: body is normalised via `normalizeNotebookUiSpecification` (`library/data-model/src/uiSpecification/normalize.ts`), which calls `migrateNotebook` when the version is behind.
- **Optional startup** — `MIGRATE_NOTEBOOKS_ON_STARTUP` still triggers notebook migration during `validateDatabases` when enabled.
- **Designer** — saves through the uiSpecification PUT path; exported JSON should use the current schema version.

## Projects / templates DB migrations

Inlining the former per-project metadata database into `Project.uiSpecification` is **`projectsV3toV4Migration`** (projects DB v4). It reads the legacy metadata Couch DB and merges with the project document. Templates have an analogous v5 migration.

Do not run `delete-metadata-databases` until projects are migrated and verified.

## Adding a future notebook schema version

1. Add `migrateToV6` (or next) in `notebookMigrations/`, keeping migration output types self-contained in that file (see comment in `migrateV5.ts`).
2. Extend `migrateNotebook` in `index.ts`.
3. Bump `CURRENT_NOTEBOOK_UI_SCHEMA_VERSION` and Zod schemas in `uiSpecification/types.ts`.
4. Update designer defaults and tests under `library/data-model/tests/`.

See also [Notebook definition](./NotebookDefinition.md).
