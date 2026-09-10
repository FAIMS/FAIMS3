# Notebook migrations

`library/data-model/src/data_storage/migrations/notebookMigrations` migrates **notebook definition JSON** (the design bundle) between schema versions. This is separate from **Couch document migrations** for the `projects` and `templates` databases (see [Couch migrations](./CouchMigrations.md)) and from the map-tile IndexedDB migrations in `@faims3/forms`, although all three now share the same harness shape.

**Deploying the metadata overhaul?** Use the step-by-step operator guide: [Metadata migration guide](./MetadataMigrationGuide.md).

## Schema version: strict semver, new epoch

`uiSpec.schemaVersion` is the **platform format version** of a notebook. Since the epoch reset it **must** be a strict `MAJOR.MINOR.PATCH` string (`^\d+\.\d+\.\d+$`; no `v`, no pre-release, no implicit patch). The active version is **`CURRENT_NOTEBOOK_UI_SCHEMA_VERSION`** in `notebookMigrations/registry.ts` (alias `NOTEBOOK_UI_SCHEMA_TARGET_VERSION`). The epoch started at **`1.0.0`**.

The former two-part ladder `1.0` → `2.0` → … → `7.0` is **deprecated**. It is not a public sequence any more: every pre-epoch value (missing, `null`, `1.0`…`7.0`, or anything that is not strict semver) is classified as the `legacy` sentinel and collapsed by a single step. `'1.0'` (legacy) is **not** `'1.0.0'` (epoch).

Do not confuse `uiSpec.schemaVersion` with `metadata.information.notebookVersion`, which is a free-text label managed by the notebook author and never used for compatibility.

Version is read from, in order:

1. Current wire: `uiSpec.schemaVersion`
2. Legacy wire: `metadata.schema_version` (only when `uiSpec.schemaVersion` is absent)

### Compatibility tiers

The app compares a notebook's `schemaVersion` with its own `CURRENT` via `assessNotebookSchemaCompatibility` (`uiSpecification/schemaCompatibility.ts`):

| Notebook vs app `CURRENT`          | Tier           | App behaviour                                                |
| ---------------------------------- | -------------- | ------------------------------------------------------------ |
| legacy (non semver) or older epoch | `compatible`   | migrate on read, strict Zod                                  |
| equal, or same major.minor / patch | `compatible`   | strict Zod, render normally (patch differences are silent)   |
| same major, **newer minor**        | `degraded`     | relaxed parse, render with a warning banner                  |
| **newer major**                    | `incompatible` | form graph not parsed; skeleton + copyable diagnostic report |
| migration or validation failure    | `incompatible` | skeleton + report                                            |

For `incompatible`, the app is **field-friendly rather than all-or-nothing**: the notebook stays listed (with a chip), the last good design already on the device is kept so existing records can be listed and viewed read-only, and **creating, editing or deleting** records is blocked everywhere (`isNotebookDesignLocked`). A notebook that was never readable holds an empty placeholder design and shows the skeleton only. First activation of that never-readable design is blocked (`isNotebookActivationBlocked`); a `degraded` (newer minor) notebook still activates after a warning. Patch differences do not change activation.

The tier is persisted per project but re-evaluated against the running build on **every startup** (`reassessSchemaCompatibility`, before `compileSpecs`), so an offline upgrade or downgrade never shows a stale chip. A previously `incompatible` notebook is not promoted until its design has actually been re-downloaded.

Bump guidance when changing the schema:

- **patch** — additive / safe; an older app must render the notebook correctly without noticing.
- **minor** — significant but non mission-critical; an older app can still render, possibly imperfectly, and should warn.
- **major** — an older app can no longer safely interpret the form graph.

The **first release** of the epoch requires API, app and designer to ship together (lockstep): older apps hard-fail on `1.0.0` because they only accepted exact `7.0`.

## Harness

| Module           | Role                                                                                                                                                              |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `types.ts`       | `NotebookSchemaMigrationDetails` (`from`, `to`, `description`, `migrationFunction`, `validateFunction`), `NOTEBOOK_SCHEMA_LEGACY`, `NotebookSchemaMigrationError` |
| `registry.ts`    | `CURRENT_NOTEBOOK_UI_SCHEMA_VERSION` and `NOTEBOOK_UI_SCHEMA_MIGRATIONS` (all steps)                                                                              |
| `identify.ts`    | `identifyNotebookSchemaMigrations({from, to})` path finder; `resolveNotebookSchemaMigrationStart`                                                                 |
| `runner.ts`      | `migrateNotebook(raw)` → `{changed, migrated, applied}`; applies migrate then validate per step                                                                   |
| `steps/`         | one module per step; `legacyToV1.ts` is the collapse of the deprecated ladder                                                                                     |
| `testHarness.ts` | `findNotebookSchemaMigration`, `runNotebookSchemaMigrationForTest`, `NotebookSchemaMigrationTestCase`                                                             |

Path finding rules match the Couch harness: `from === to` → no steps; `from > to` → error (no downgrades); each hop must match exactly one step; overshoot or cycles are errors.

### Registered steps

| From     | To      | Step                  | Effect                                                                                   |
| -------- | ------- | --------------------- | ---------------------------------------------------------------------------------------- |
| `legacy` | `1.0.0` | `steps/legacyToV1.ts` | Collapse any pre-semver shape (missing / `1.0`…`7.0`) to the epoch layout; stamp `1.0.0` |

`legacyToV1.ts` is intentionally dense. The historical v2–v7 transforms (label normalisation, `project_status` removal, canonical field renames, wire → `{uiSpec, metadata}` restructure with `fviews` → `views`, `ComputedField` → `ComputedNumber`, `displayParent` removal) live inside it as **commented stages** on a fall-through cascade, so a notebook at any historical point ends at `1.0.0`. They are not a living pipeline and are not exported.

## Zod models

`uiSpecification/types.ts` holds the notebook JSON Zod schemas in versioned blocks with paired inferred types (`NotebookDefinitionV1Schema` / `NotebookDefinitionV1`, `NotebookUiSpecV1Schema`, `TemplateDefinitionV1Schema`, compiled variants, …), following `projectsDB/types.ts` and `templatesDB/types.ts`. The unversioned names (`NotebookDefinitionSchema`, `NotebookUiSpec`, `TemplateDefinition`, …) are **aliases of the latest block**. `schemaVersion` is validated by `NotebookSchemaSemverSchema` (`uiSpecification/schemaVersion.ts`).

## When migrations run

- **API (write path)** — `PUT /api/notebooks/:id/uiSpecification`, template equivalents and notebook creation normalise the body via `normalizeNotebookUiSpecification` (`uiSpecification/normalize.ts`): migrate when `notebookUiSpecificationNeedsMigration` (legacy or older than `CURRENT`; never for newer semver), then **strict** Zod, then assert the stored version equals `CURRENT`. A newer-than-current document is rejected on write.
- **App (read path)** — `ingestNotebookUiSpecification` never throws for a version mismatch; it returns `{ok, definition?, compatibility, error?}` and the app persists `compatibility` on the project (`Project.schemaCompatibility`) to drive the tiered UI and Bugsnag reporting.
- **Optional startup** — `MIGRATE_NOTEBOOKS_ON_STARTUP` still triggers notebook migration during `validateDatabases` when enabled.
- **Designer** — `web/src/designer/integration/legacyNotebook.ts` migrates on load and warns; a newer stamp that still parses the current Zod model is opened (with a warning) rather than rejected. New designs are created at `CURRENT`.

## Projects / templates DB migrations

Inlining the former per-project metadata database into `Project.uiSpecification` is **`projectsV3toV4Migration`** (projects DB v4). It builds the legacy wire shape and runs `migrateNotebook` (i.e. the collapse). Templates have an analogous v5 migration.

Do not run `delete-metadata-databases` until projects are migrated and verified.

## Adding a future notebook schema version

1. Decide the bump (patch / minor / major) using the tier guidance above. Every bump, including patch, needs a registry step so the path finder can reach the new target (a patch step may be an identity transform that restamps the version).
2. If the shape changes, add a `V<n+1>` block in `uiSpecification/types.ts` (extend / omit from `V<n>`) and re-point the current aliases. Patch bumps that do not change the model can keep the existing block.
3. Add `steps/<from>To<to>.ts` exporting a pure `migrationFunction(input)` (deep-clone, never mutate) and a `validateFunction(output)` that parses with the new version's Zod schema and checks the stamp.
4. Append `{from, to, description, migrationFunction, validateFunction}` to `NOTEBOOK_UI_SCHEMA_MIGRATIONS` and bump `CURRENT_NOTEBOOK_UI_SCHEMA_VERSION`.
5. Add table-driven cases to `steps/<step>.test.ts` via `findNotebookSchemaMigration` + `runNotebookSchemaMigrationForTest`; `harness.test.ts` checks completeness (unique path from `legacy` and from every registered `from`) automatically.
6. Update sample notebooks under `api/notebooks/` and the designer default if the shape changed.

See also [Notebook definition](./NotebookDefinition.md).
