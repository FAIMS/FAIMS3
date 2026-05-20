# FAIMS metadata redesign — design doc (draft)

## Summary

FAIMS metadata is spread across JSON notebook files, a dedicated metadata database, and project/template/survey entities in other databases. The current setup mixes **design/spec documentation** with **runtime survey instantiation**, uses loosely typed or untyped key value pairs, and has known data-quality gaps (for example, survey ownership cannot be trusted because values were inherited from free-text project fields rather than real user records).

This initiative aims to: **fully type and validate** metadata where possible; **separate** “what the design is” from “who instantiated what and when”; remove redundant storage (notably removing the metadata DB in favour of nested, typed structures on first-class entities); **document** project and template properties consistently.

Near-term emphasis is **structural cleanup, typing, and code quality** rather than expanding into full standards like RAID immediately; the shape should remain **extensible** so RAID-aligned project metadata and archive publishing can follow.

## Goals

### Product and data

- Clarify and fully type the **`metadata` portion of notebook JSON** so it describes the **design/spec** (forms, purpose, scope, bundled design documentation)—not the live survey instance.
- Ensure **survey (and template) database objects** carry **instantiation and ownership** fields (`createdBy`, timestamps, name, description, etc.) with **real database references** where the domain requires them—not free-text stand-ins.
- **Remove the metadata database** entirely after data is migrated or duplicated where still relevant; prefer **nested JSON** on project/template (and related) objects, **fully typed** in application and persistence layers.
- **Standardised, documented** properties for projects and templates (naming, descriptions, audit fields)—used **consistently** across the app and APIs.
- **Clear update workflows** in `/web` for non-consequential properties (name, description, etc.) versus operations that imply design or data integrity constraints.

### Engineering

- **Fully typed interfaces** end-to-end; only **sandboxed untyped** regions where user-defined custom metadata cannot be predicted.
- **Categorised** metadata where it helps (e.g. settings, display, user, system)—exact groupings to follow a **stocktake** of current fields.
- **Migrations** for all affected entities: project DB, metadata DB (move then remove), template DB, and **notebook JSON** (designer + batch/custom migration to the new spec).

## Current state (inventory — codebase, May 2026)

This section documents **what exists today** in CouchDB-shaped stores, API payloads, designer state, and app usage. Types are generally **`z.record(z.any())` / `{[key: string]: any}`** for notebook `metadata` unless noted.

**Column legend (where tables include sourcing):**

- **Sourced from (initial)** — how the value first appears (API body, server-generated, copied from template, etc.).
- **Changed by** — how it is updated later (specific HTTP routes, designer save, server jobs, manual Couch edit, or **immutable** / **not written by current server paths**).

Unless stated otherwise, **Control Centre** means the `/web` app; **designer save** means `PUT` JSON to `/api/notebooks/:id` or `/api/templates/:id` (see `web/src/designer/integration/useDesignerSaveMutation.ts`).

### Terminology in this repo

| User language        | Typical storage / code name                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------- |
| Survey / notebook    | **Project**: document in **`projects`** DB (`ProjectDocument`); API routes under `/api/notebooks/…`.    |
| Template             | Document in **templates** DB (`TemplateDocument`).                                                      |
| Design / JSON export | Object with top-level **`metadata`** + **`ui-specification`** (same keys as API PUT/GET notebook body). |

---

### 1. Projects database (`projects` DB)

**Type:** `ProjectDocument` — `library/data-model/src/data_storage/projectsDB/types.ts` (`ProjectV3Fields`).

| Property        | Type / notes                                                                            | Used for                                                                                                                                      | Sourced from (initial)                                                                                               | Changed by                                                                                                                                                                                                                        |
| --------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_id`           | Couch id; **also the system project / notebook id** (`ProjectID`).                      | Routing, DB naming, permissions `resourceId`.                                                                                                 | **Server-generated** in `createNotebook` (`api/src/couchdb/notebooks.ts`): timestamp + slugified name.               | **Immutable** for the life of the survey; deleting the survey removes the project doc and destroys DBs.                                                                                                                           |
| `_rev`          | Couch revision.                                                                         | Sync / updates.                                                                                                                               | Couch on first `put`.                                                                                                | Updated automatically on every successful `put` to this document.                                                                                                                                                                 |
| `name`          | `string` — human-readable survey name.                                                  | Directory listing, `createNotebook` / `changeNotebookName` keeps this in sync with `metadata.name`.                                           | **POST `/api/notebooks`** `name` when creating; also overwritten to `metadata.name.trim()` inside `createNotebook`.  | **`changeNotebookName`** after **`PUT /api/notebooks/:id`** if `metadata.name` differs; otherwise only via the same PUT (metadata + project name stay aligned in `updateNotebook`).** Not** exposed as its own PATCH field today. |
| `status`        | `ProjectStatus`: `OPEN`, `CLOSED`, `ARCHIVED`.                                          | Lifecycle, filters (e.g. hide archived from default lists).                                                                                   | Defaults to **`OPEN`** in `createNotebook` project doc.                                                              | **`PUT /api/notebooks/:id/status`** (`web` / `project-hooks.ts`). Logic in `applyNotebookLifecycleStatus` (`notebooks.ts`).                                                                                                       |
| `dataDb`        | `PossibleConnectionInfo` (`db_name`, optional `base_url`, …).                           | Resolves **data** DB for records.                                                                                                             | **`createNotebook`**: sets `db_name: data-${projectId}`; `base_url` filled when listing (`getAllProjectsDirectory`). | **Not changed** by normal notebook update APIs; creation-time only unless ops/migrations edit Couch.                                                                                                                              |
| `metadataDb`    | `PossibleConnectionInfo`. Legacy alias **`metadata_db`** still read in `getMetadataDb`. | Resolves **metadata** DB for UI spec + notebook metadata docs.                                                                                | Same pattern: **`metadata-${projectId}`** at `createNotebook`.                                                       | **Not changed** by normal APIs after creation.                                                                                                                                                                                    |
| `ownedByTeamId` | `string \| undefined`.                                                                  | Team ownership; Couch view `PROJECTS_BY_TEAM_ID`.                                                                                             | Optional **`teamId`** on **POST `/api/notebooks`** (from scratch or template).                                       | **`PUT /api/notebooks/:projectId/team`** with body `{ teamId }` (`changeNotebookTeam` in `notebooks.ts`).                                                                                                                         |
| `templateId`    | `string \| undefined` — survey created from template.                                   | Web tables, “template used”; cleared when template deleted. **Distinct** from optional `metadata.template_id` inside metadata DB (see below). | Set when **POST `/api/notebooks`** with **`template_id`** (from-template branch). Omitted for from-scratch.          | **Cleared** by `clearTemplateIdFromProjectsReferencingTemplate` when a template is permanently deleted (`notebooks.ts`). **Not** updated by `PUT /api/notebooks/:id` body today (no field in `PutUpdateNotebookInputSchema`).     |

**Removed from current project shape (v2+):** V1-only fields such as `description`, `last_updated`, `created` on the project document — see migrations in `library/data-model/src/data_storage/migrations/migrations.ts`.

**Not on project document today:** `createdBy`, rich description, RAID fields — those live elsewhere or not at all.

---

### 2. Per-project metadata database (`metadata-{projectId}`)

**Naming:** Default `metadata-${projectId}` at creation (`api/src/couchdb/notebooks.ts`); actual connection comes from **`project.metadataDb`** (or legacy `metadata_db`).

**Security:** `_security` from `MetadataDBSecurityDocument` — `library/data-model/src/data_storage/metadataDB/security.ts` (members get roles derived from `Action.READ_PROJECT_METADATA` for that `projectId`).

**Initialisation:** `initMetadataDB` only sets security (no design docs): `library/data-model/src/data_storage/metadataDB/init.ts`.

#### 2.1 Document types stored in this database

| Role                             | Couch `_id` pattern             | Shape (conceptual)                                                                                                                                                        | Notes                                                                                                                                        | Sourced from (initial)                                                                                                             | Changed by                                                                                                                                                                                                                     |
| -------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **UI specification**             | `ui-specification`              | `EncodedProjectUIModel`: `fields`, `fviews`, `viewsets`, `visible_types` (+ `_id` / `_rev` on read).                                                                      | Single doc; **not** under `project-metadata-*`. `decodeUiSpec` maps `fviews` → runtime `views` (`library/data-model/src/datamodel/core.ts`). | **POST `/api/notebooks`** supplies `ui-specification` (from scratch) or copies from **template**; `createNotebook` writes one doc. | **`PUT /api/notebooks/:id`** replaces whole doc (`updateNotebook`). Optional **`migrateNotebook`** on server startup (`validateDatabases` + `MIGRATE_NOTEBOOKS_ON_STARTUP`). Designer save uses same PUT.                      |
| **Per-key metadata**             | `project-metadata-<key>`        | `EncodedProjectMetadata`: `{ is_attachment, metadata }` where the **value** for that key is in `.metadata`.                                                               | Prefix constant `PROJECT_METADATA_PREFIX = 'project-metadata'` (`library/data-model/src/datamodel/database.ts`).                             | **`writeProjectMetadata`** after create/update: one doc per enumerable key on the **`metadata`** object passed from API.           | Any **`PUT /api/notebooks/:id`** that includes a new `metadata` object rewrites all keys present in that object (missing keys are **not** deleted unless absent from the loop’s input — see `writeProjectMetadata` iteration). |
| **Aggregated blob (write path)** | `project-metadata-projectvalue` | **Entire** metadata object written as the document body (with `_id` / `_rev`).                                                                                            | See **quirk** below.                                                                                                                         | Same **`writeProjectMetadata`** call as per-key docs.                                                                              | Same as per-key (every PUT that calls `writeProjectMetadata`).                                                                                                                                                                 |
| **Optional / legacy types**      | Other ids                       | `ProjectMetaObject` union in `types.ts` also allows `ProjectSchema` (`namespace`, `constants`, `types`) — not created by current `createNotebook` path in `notebooks.ts`. | May exist in old deployments; not part of standard create flow reviewed here.                                                                | Historical / manual / other tooling.                                                                                               | Not defined by current API surface.                                                                                                                                                                                            |

**`writeProjectMetadata` behaviour** (`api/src/couchdb/notebooks.ts`):

1. For each enumerable key `field` on the incoming `metadata` object, upserts `project-metadata-<field>` with `{ metadata: metadata[field] }`.
2. Then mutates the same object to set `_id` to `project-metadata-projectvalue` and upserts that as a **second** representation of the full bag.

**`getNotebookMetadata` behaviour (read path):** Iterates all docs whose id starts with `project-metadata-`; for each, sets `result[key] = doc.doc.metadata` where `key` is the substring after the prefix. **Quirk:** the `project-metadata-projectvalue` document is stored as a **flat** document (not wrapped in `.metadata`), so **`result.projectvalue` is typically `undefined`** and the blob doc is **not** a reliable round-trip for consumers of the merged object. Consumers rely on the per-field docs.

After merge, **`result.project_id`** is set to the queried id (not necessarily stored as a Couch doc).

#### 2.2 Metadata keys — designer defaults and migrations

**Designer initial `metadata`** (`web/src/designer/state/initial.ts`): `notebook_version`, `schema_version`, `name`, `filenames`, `lead_institution`, `showQRCodeButton`, `pre_description`, `project_lead`, `sections` (object).

**Notebook migration pipeline** (`library/data-model/src/data_storage/migrations/notebookMigrations/index.ts`):

- Driven by **`metadata.schema_version`**: missing / `null` / `'1.0'` → `migrateToV2`; `'2.0'` → `migrateToV3`.
- **V2** (`migrateV2.ts`): large normalisation of `ui-specification` (labels, components, conditions, etc.); sets `schema_version` to **`'2.0'`**; can move legacy form descriptions from **`metadata.sections`** into **`fviews[].description`**.
- **V3** (`migrateV3.ts`): removes **`metadata.project_status`**; sets **`schema_version`** to **`'3.0'`** (template archive moves to template DB `archived` flag).

**Example file** `library/forms/src/sample-notebook.json` metadata includes: `filenames`, `lead_institution`, `meta`, `name`, `pre_description`, `project_id`, `project_lead`, `project_status`, `sections` — shows drift vs current v3 expectations (`project_status` legacy).

**Historical / doc-listed keys** (`api/doc/DATABASE.md` lists examples): `access`, `accesses`, `behavious` (typo in doc), `filenames`, `forms`, `ispublic`, `isrequest`, `lead_institution`, `meta`, `pre_description`, `project_lead`, `project_status`, `projectvalue`, `sections`. Several appear only in old UI or designer tests, not in active field app paths.

#### 2.3 Metadata keys — where the app reads them

| Key / pattern                                | Where used                                                                                                                                                                 | Notes                                                                                                                                                                                                                                         | Sourced from (initial)                                                                                                                                                          | Changed by                                                                                                                                                                                                                                                                        |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`name`**                                   | Project doc + metadata; designer; API overwrites project name from `metadata.name` on update.                                                                              | Canonical display often `project.name` with fallback `metadata.name` (e.g. `app/.../workspace/notebooks.tsx`).                                                                                                                                | **POST `/api/notebooks`** body `metadata.name` (from scratch) or **template `metadata.name`** copy; **server forces** `metadata.name = projectName.trim()` in `createNotebook`. | **Designer save** or **PUT `/api/notebooks/:id`** or **Control Centre “Update project” JSON upload** — any path that calls `updateNotebook` → `writeProjectMetadata` + `changeNotebookName`.                                                                                      |
| **`pre_description`**                        | Designer info panel (markdown); web Control Centre project/template **details** tables; app `MetadataDisplay` / `MetadataRenderer` (rich text).                            | Primary “long description” for humans.                                                                                                                                                                                                        | Client **POST** / template copy / designer defaults (`''`).                                                                                                                     | **Designer** (`propertyUpdated` / MDX editor) then **PUT** notebook; or JSON file PUT from Control Centre.                                                                                                                                                                        |
| **`project_lead`**                           | Designer; web tables (labelled “Created by” — **misleading** vs DB user); app metadata display.                                                                            | Free text, not a user id.                                                                                                                                                                                                                     | Same as other metadata keys: request body at create or template copy.                                                                                                           | **Designer** or **PUT** notebook / JSON upload.                                                                                                                                                                                                                                   |
| **`lead_institution`**                       | Designer; app metadata display.                                                                                                                                            |                                                                                                                                                                                                                                               | Create / template / defaults.                                                                                                                                                   | **Designer** or **PUT** notebook / JSON upload.                                                                                                                                                                                                                                   |
| **`showQRCodeButton`**                       | Designer (stored as string `'true'`/`'false'` in test notebooks); **`app/.../add_record_by_type.tsx`**: `!!metadata['showQRCodeButton']`.                                  | **Bug / quirk:** boolean `false` in JSON is still truthy for `!!`; string `'false'` is also truthy. Only empty / `undefined` / `null` / `0` disable. Legacy notebooks use string `'true'`.                                                    | Designer default `false` or template copy; tests use string `'true'`.                                                                                                           | **Designer** checkbox writes string via `setProp`; persisted on **PUT** notebook.                                                                                                                                                                                                 |
| **`notebook_version`**, **`schema_version`** | Designer info panel; migration engine.                                                                                                                                     | `schema_version` gates `migrateNotebook`.                                                                                                                                                                                                     | Defaults in designer (`web/.../initial.ts`) or inherited JSON.                                                                                                                  | **Manual** in designer fields; **`migrateNotebook`** may set **`schema_version`** to `2.0` / `3.0` on server when migration runs; then **`updateNotebook`** persists.                                                                                                             |
| **`template_id`**                            | Inside **metadata** when supplied from **template** payloads (`api/.../templates.ts` injects on create/update); optional duplicate of linkage vs **`project.templateId`**. | Web “template used” uses **`template_id`** from **list** API (`project.templateId`). App `notebook/index.tsx` also reads `metadata['template_id']`. Metadata doc removed by `removeTemplateIdFromNotebookMetadata` when clearing reference.   | **Copied from template** `metadata` on survey create; template CRUD **re-injects** `metadata.template_id` on server.                                                            | For **surveys**: doc removed when template reference cleared from projects (`removeTemplateIdFromNotebookMetadata`). Otherwise changes only if **PUT** sends a new `metadata` object containing it. **Project** `templateId` is the authoritative link for list UI, not this key. |
| **`accesses`**                               | Designer `rolesUpdated` reducer; protected from casual `propertyUpdated`.                                                                                                  | **Not found** in permission middleware as the source of truth — **Couch roles** come from people / token / `resourceRoles`; this is designer-local role labels unless wired elsewhere. Treat as **legacy / UI-only** unless proven otherwise. | Test fixtures / optional client payload on create.                                                                                                                              | **Designer** role UI → Redux → saved with notebook **PUT**. **No** known server-side consumer for auth decisions.                                                                                                                                                                 |
| **`filenames`**                              | Protected in designer reducer; API export flows use a **local** `filenames` **array variable** for attachments — not the same as persisting this metadata key.             | Unclear that `metadata.filenames` is read for runtime behaviour.                                                                                                                                                                              | Designer default `[]`.                                                                                                                                                          | Not meaningfully updated by server; could appear via **PUT** if client sends it.                                                                                                                                                                                                  |
| **`sections`**                               | Legacy; V2 migration reads **`metadata.sections`** for descriptions then removes key. Designer still initialises `{}`.                                                     |                                                                                                                                                                                                                                               | Legacy notebooks; designer `{}`.                                                                                                                                                | **`migrateToV2`** may **delete** key after moving content to `fviews`; otherwise **PUT** overwrites if still present.                                                                                                                                                             |
| **`meta`**                                   | Protected in designer; sample JSON `{}`.                                                                                                                                   |                                                                                                                                                                                                                                               | Defaults / imports.                                                                                                                                                             | Typically untouched; could be updated via **PUT** if included in payload.                                                                                                                                                                                                         |
| **`ispublic`**, **`isrequest`**              | Present in designer test notebook / V1 test fixtures.                                                                                                                      | **No grep hits** in app or API business logic beyond metadata reducer / info-panel “extra fields”. Likely **unused** for current conductor stack.                                                                                             | Fixtures / old JSON.                                                                                                                                                            | Only via **PUT** if ever sent; **no** dedicated API.                                                                                                                                                                                                                              |
| **`derived-from`**                           | Designer: when `VITE_TEMPLATE_PROTECTIONS`, shows provenance; `field-editor` blocks edits if set.                                                                          | Template / copy workflow only; **loose metadata key** (kebab-case). Target: typed **`metadata.information.derivedFromTemplateId`** (see proposed state).                                                                                      | Set by whatever workflow seeds the notebook (not standard server create path in isolation).                                                                                     | Persists with **PUT**; designer treats as read-only signal when protections on.                                                                                                                                                                                                   |
| **`description`**                            | `app/.../workspace/notebooks.tsx` shows `row.metadata.description` under name.                                                                                             | **Not** in designer default metadata; likely **legacy** or manually added; often empty.                                                                                                                                                       | Manual JSON / old exports.                                                                                                                                                      | **PUT** notebook if client adds the key.                                                                                                                                                                                                                                          |
| **`last_updated`**                           | `MetadataDisplay` “Last Updated” row reads **`metadata.last_updated`**.                                                                                                    | **Not** set by current `createNotebook` / `writeProjectMetadata` flow reviewed; often blank. Project **v1** had `last_updated` on **project doc** — different field, also gone in v3.                                                         | Would only appear if client or migration wrote it into `metadata`.                                                                                                              | **Not** maintained automatically today; only **PUT** or manual Couch.                                                                                                                                                                                                             |
| **`project_id`**                             | Injected on **read** by `getNotebookMetadata`; may also appear inside stored JSON in samples.                                                                              | Informational.                                                                                                                                                                                                                                | **Not stored** as a normal per-key write from `writeProjectMetadata` merge (added in code on read).                                                                             | N/A on write path from server; could exist in JSON from samples / **PUT** if someone includes it.                                                                                                                                                                                 |
| **Ad-hoc keys**                              | Designer “extra fields” panel for keys outside the known list (`info-panel.tsx`).                                                                                          | Arbitrary `metadata` keys allowed by schema (`z.record(z.any())`).                                                                                                                                                                            | **POST** / template / designer user-added pairs.                                                                                                                                | **Designer** custom field UI + **PUT**; or **Control Centre** JSON upload.                                                                                                                                                                                                        |

**Short-code / QR “add notebook” UI** (`notebooks.tsx`): uses **`allowQr` from build config**, **not** `metadata.showQRCodeButton`. Separate from record-list QR behaviour.

**Other code paths touching merged metadata:**

- **`validateDatabases`** (`api/src/couchdb/notebooks.ts`): loads metadata + UI spec per project; optional `migrateNotebook` when `MIGRATE_NOTEBOOKS_ON_STARTUP`.
- **POST notebook user role** (`api/src/api/notebooks.ts`): calls `getNotebookMetadata` mainly to assert the notebook exists and to read **`project_id`** for `removeProjectRole` — redundant with route `id` but documents coupling to metadata fetch.
- **Designer `info-panel.tsx`**: renders a fixed set of fields, then dumps any **other** metadata keys (not in an exclude list) as “extra” read-only properties for debugging / ad-hoc data.

**`DATABASE.md` note on `local_autoincrementers`:** the developer doc suggests autoincrement state may live in the **metadata** Couch DB. In the **mobile app**, autoincrementer persistence uses **`local_state`** (IndexedDB / `local-autoincrement-state-*` doc ids in `app/src/local-data/autoincrement.ts`) — **not** the per-project metadata database. Treat the doc statement as **historical or inaccurate** unless server-side incrementers are found elsewhere.

---

### 3. Templates database (`templates` DB)

**Type:** `TemplateDocument` / `TemplateDBFields` — `library/data-model/src/data_storage/templatesDB/types.ts` (current **v4**).

| Property           | Schema                                                | Purpose                                                                                                                                                         | Sourced from (initial)                                                         | Changed by                                                                                                                                                                                                                                                                       |
| ------------------ | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_id`              | string                                                | Template id (time-based slug).                                                                                                                                  | **Server-generated** in `createTemplate` (`generateTemplateId`).               | **Immutable.**                                                                                                                                                                                                                                                                   |
| `_rev`             | Couch                                                 |                                                                                                                                                                 | Couch on first `put`.                                                          | Auto-updated on each successful document `put`.                                                                                                                                                                                                                                  |
| `version`          | number ≥ 1                                            | Incremented on each update.                                                                                                                                     | **`1`** on **POST `/api/templates`**.                                          | **Server**: `existingTemplate.version + 1` on every **`updateExistingTemplate`** (any **PUT `/api/templates/:id`** that persists a change).                                                                                                                                      |
| `name`             | string (required from v2)                             | Template title (distinct from `metadata.name` if both exist).                                                                                                   | **POST `/api/templates`** body **`name`** (required by create flow).           | **PUT `/api/templates/:id`** optional **`name`** (`PutUpdateTemplateInputSchema` — partial). Omitted fields keep previous values (`updateExistingTemplate`). **Not** changed by **PUT `/api/templates/:id/visibility`** (visibility only).                                       |
| `metadata`         | `z.record(z.any())` **required**                      | Same open-ended bag as notebook metadata; **always** gets **`metadata.template_id`** injected to match `_id` on create/update (`api/src/couchdb/templates.ts`). | **POST** body `metadata`; server sets **`metadata.template_id`** to new `_id`. | **PUT `/api/templates/:id`** optional **`metadata`** — if omitted, existing metadata retained; if sent, merged server-side and **`template_id` re-injected**. Designer save sends full JSON file = full replace of `metadata` + `ui-specification` when user exports that way.   |
| `ui-specification` | Encoded UI spec (Zod `EncodedUISpecificationSchema`). | Full design.                                                                                                                                                    | **POST** body.                                                                 | **PUT `/api/templates/:id`** optional; designer **PUT** same as notebooks. **Not** updated by visibility-only endpoint.                                                                                                                                                          |
| `ownedByTeamId`    | optional string                                       | Team ownership.                                                                                                                                                 | **POST** optional **`teamId`** → stored as `ownedByTeamId`.                    | **`PUT /api/templates/:id/team`** with body `{ teamId }` (`changeTemplateTeam` in `templates.ts`).                                                                                                                                                                             |
| `archived`         | boolean (v3+, default false)                          | Replaces old **`metadata.project_status`** for archive.                                                                                                         | **`false`** on create.                                                         | **POST `/api/templates/:id/archive`** with `{ archive: boolean }` (`archiveTemplate`). **POST `/api/templates/:id/restore`** clears archive. **Not** in normal PUT template body schema.                                                                                         |
| `isPublic`         | boolean (v4+, default false)                          | Visibility API.                                                                                                                                                 | **POST** optional **`isPublic`** (defaults **false** in `createTemplate`).     | **Only** **`PUT /api/templates/:id/visibility`**. Generic **`PUT /api/templates/:id`** (`updateExistingTemplate`) **always copies** `existingTemplate.isPublic` — it is **not** in `PutUpdateTemplateInputSchema`, so content updates **cannot** flip visibility via that route. |

**Web Control Centre** template tables / details iterate **`metadata`** keys like `pre_description`, `project_lead`, `notebook_version` for display — same loose convention as surveys.

---

### 4. Notebook JSON / `ui-specification` (wire + designer)

**Wire format (API, files, Couch `ui-specification` doc):** keys **`fields`**, **`fviews`**, **`viewsets`**, **`visible_types`**.

**Designer internal state** (`web/src/designer/state/initial.ts`): same logical layout; undo history wraps **`ui-specification`** only.

**Per-field object** (`FieldType` in `initial.ts`): includes **`component-namespace`**, **`component-name`**, **`type-returned`**, **`component-parameters`**, optional **`condition`**, **`access`**, **`meta`** (annotation/uncertainty), **`humanReadableName`**, **`category`**, etc. — largely **`any`**-friendly in `ProjectUIFields` in `types.ts`.

**Sections (“views”):** each **`fviews[id]`** may have `label`, `fields`, `uidesign`, `description`, `condition`, `next_label`, `is_logic`, …

**Forms (“viewsets”):** `viewsets[id]` has `views`, `label`, optional `summary_fields`, `layout` (`inline` \| `tabs`), `hridField`, `submit_label`, `is_visible`, etc. (see `ProjectUIViewset` in `types.ts`).

**`QRCodeFormField`:** defined in designer `fields.tsx` as a **form field** component — separate from **`metadata.showQRCodeButton`** (which toggles **record search by QR** on the record list).

| Part of `ui-specification`                                       | Sourced from (initial)                                                                            | Changed by                                                                                                                                                                                                                                                                                               |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Whole document (`fields`, `fviews`, `viewsets`, `visible_types`) | **POST `/api/notebooks`** (scratch payload or template copy); same for **POST `/api/templates`**. | **PUT** survey or template with full **`ui-specification`** body; **designer** export file; optional **`migrateNotebook`** + **`updateNotebook`** on server when `MIGRATE_NOTEBOOKS_ON_STARTUP`. **Control Centre** survey update: JSON file → **PUT `/api/notebooks/:id`** (`update-project-form.tsx`). |
| Individual field / section / form definitions                    | Authored in **designer** (Redux), then serialised into the JSON sent on PUT.                      | Same as row above; no granular PATCH — typically **replace whole spec** with each save.                                                                                                                                                                                                                  |

---

### 5. API contracts (notebook)

Relevant schemas in `library/data-model/src/api.ts`:

- **GET `/api/notebooks/:id`** → `GetNotebookResponse`: `name`, `metadata` (record), `ui-specification`, `ownedByTeamId`, `status`, optional `recordCount`.
- **PUT `/api/notebooks/:id`** → body `NotebookEditableDetailsSchema`: `ui-specification` + `metadata` (any record). **Both are required** by the schema; server **`updateNotebook`** rewrites the **`ui-specification`** doc and calls **`writeProjectMetadata`** with the **entire** `metadata` object — keys **not** present in the payload are **not** iterated for per-field doc updates (so stale keys can **remain** in Couch unless overwritten by a key in the new object; deletions are not modelled as explicit tombstones).
- **POST `/api/notebooks`** → from scratch: `name`, `metadata`, `ui-specification`, optional `teamId`; from template: `name`, `template_id`, optional `teamId` (metadata/ui spec copied from template).
- **GET list** (`getUserProjectsDetailed`): each item includes `metadata: projectMeta` from **`getNotebookMetadata`**, plus **`template_id: project.templateId`** from **project document** (not from metadata bag).

---

### 6. Data database (`data-{projectId}`)

Record docs (`EncodedRecord`), revisions, AVPs include **`created_by`**, **`created`** as **strings** (usernames from auth at write time). This is **per-record**, not the survey’s “created by”.

---

### 7. Summary: likely unused or legacy today

| Item                                                               | Assessment                                                                                                   |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| **`metadataDb` → `project-metadata-projectvalue`** merged read     | **Broken / useless** for `projectvalue` key due to missing nested `.metadata` on that doc shape.             |
| **`metadata.accesses` / `ispublic` / `isrequest`**                 | Present in fixtures; **no** current server enforcement path found in grep.                                   |
| **`metadata.description`**                                         | Used in one app list caption; **not** part of typed defaults; often empty.                                   |
| **`metadata.last_updated`**                                        | Shown in UI if present; **not** populated by standard server writes reviewed.                                |
| **API list `last_updated` / `created`** on `APINotebookListSchema` | **Optional**; **`getUserProjectsDetailed`** does **not** populate them — likely **unused** on that response. |
| **`ProjectSchema` in metadata DB**                                 | Allowed by type union; **not** created in current `createNotebook` path.                                     |
| **`api/doc/DATABASE.md` `auth_mechanisms` on project**             | Doc notes **not used**.                                                                                      |
| **Doc typo `behavious`**                                           | Listed in DATABASE.md; **no code references**.                                                               |
| **`DATABASE.md` id `ui_specification` vs underscore**              | Doc says `ui_specification`; code uses **`ui-specification`**.                                               |

---

## Proposed state

### Design principles

1. **Surveys (`Project` in the `projects` DB) and templates (`Template`)** are Couch documents with **two layers**: (a) **resource / lifecycle / instantiation** at the root (ids, status, data DB pointer, team, template link, **audit user ids**), and (b) a nested **`uiSpecification`** object shaped as **`{ uiSpec, metadata }`**: **`uiSpec`** is **today’s encoded UI body** (`fields`, `fviews`, `viewsets`, `visible_types`, and all legacy inner keys) **plus** a new **`settings`** object; **`metadata`** holds **`information`** (typed non-functional design prose) and optional **`custom`**.
2. **No per-project metadata database** — former `ui-specification` + `project-metadata-*` docs are **inlined** into that **`uiSpecification`** value on the parent document.
3. **camelCase** only for **new** persistence/API keys (`uiSpec`, `metadata`, `settings`, `information`, `showQrCodeButton`, root `createdAt`, etc.). **Do not** rename legacy keys inside the form graph (`fviews`, `visible_types`, `component-namespace`, `type-returned`, …) in this pass — avoids a massive designer/forms rewrite. Couch **`_id`**, **`_rev`**, **`_deleted`** stay as-is.
4. **Intentionally removed** from the typed core: `accesses`, `ispublic`, `isrequest`, legacy `sections` bag, unused `filenames`, empty `meta`, `project_status` in arbitrary metadata, duplicate `template_id` inside nested bags, `projectvalue` aggregate pattern, ad hoc `last_updated` strings, typo keys (`behavious`). **Survey/template `description`** is a **single typed root field** (what this survey or template _is_ for operators), distinct from **`metadata.information.purposeMarkdown`** (design documentation inside the UI spec bundle). **No** denormalised display names on audit fields (privacy).

---

### Shared primitives

```typescript
/** ISO-8601 timestamp string, UTC recommended */
type Timestamp = string;
```

**Project connection and lifecycle** — reuse existing types unchanged: **`PossibleConnectionInfo`** (with `db_name`, `base_url`, etc.) and **`ProjectStatus`** (`OPEN`, `CLOSED`, `ARCHIVED`) from `library/data-model` (`ProjectDocument` / `projectsDB/types.ts`). **No** renaming of connection fields or status enum values.

---

### `uiSpecification` — `{ uiSpec, metadata }`

| Partition                  | Responsibility                                                                                                                                                                                                                                                                                                                           |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`uiSpec`**               | **Same top-level structure as today’s** Couch `ui-specification` / `EncodedProjectUIModel`: **`fields`**, **`fviews`**, **`viewsets`**, **`visible_types`**. Inner field definitions keep existing keys (`component-namespace`, `type-returned`, `component-parameters`, …). **Only addition:** sibling **`settings`** (camelCase, new). |
| **`uiSpec.settings`**      | Typed toggles / numbers that affect **how** the app renders or behaves (e.g. QR on record list).                                                                                                                                                                                                                                         |
| **`metadata.information`** | Human-facing **design documentation** only — no user ids, no auth. Optional **`derivedFromTemplateId`** records design provenance (source template id), distinct from survey root **`templateId`** when both apply.                                                                                                                      |
| **`metadata.custom`**      | Optional org-specific bag, **untyped** by design.                                                                                                                                                                                                                                                                                        |

```typescript
/**
 * UI behaviour toggles (moved out of the old loose metadata bag).
 * Only **new** keys here use camelCase; the rest of `uiSpec` stays legacy-shaped.
 */
interface NotebookUiSettings {
  /** When true, show “search by QR” on the record list for this survey */
  showQrCodeButton: boolean;
}

/**
 * Non-functional **design** documentation bundled with the form definition.
 * Not the same as the survey/template root **`description`** (operational blurb).
 */
interface NotebookInformation {
  /** Notebook / designer semver or similar */
  notebookVersion: string;
  /** Drives notebook migration / compatibility */
  schemaVersion: string;
  /** Long-form design intent — former `pre_description` */
  purposeMarkdown: string;
  /** Responsible person label for the design — former `project_lead`; not a user id */
  projectLeadLabel: string;
  leadInstitution: string;
  /**
   * Source template id when this definition was derived or copied from another template design.
   * Former loose metadata key **`derived-from`**. Omitted when not applicable.
   * Not a substitute for survey root **`templateId`** (instantiation link on **`Project`**).
   */
  derivedFromTemplateId?: string;
}

/** Typed design metadata + optional org extensions */
interface NotebookMetadataPartition {
  information: NotebookInformation;
  /** Optional key/value bag for org-specific tagging; not for settings or user ids */
  custom?: Record<string, unknown>;
}

/**
 * Inlined former notebook JSON + metadata DB merge.
 * `uiSpec` base type = existing **`EncodedProjectUIModel`** (`fields`, `fviews`, `viewsets`, `visible_types`; legacy keys inside `fields` unchanged) + **`settings`**.
 */
interface SurveyNotebookDefinition {
  uiSpec: EncodedProjectUIModel & {settings: NotebookUiSettings};
  metadata: NotebookMetadataPartition;
}
```

_In implementation, import **`EncodedProjectUIModel`** from `@faims3/data-model` / `library/data-model`._

---

### Survey document — `Project` (`projects` DB)

Instantiation + lifecycle at **root**; **definition** nested under **`uiSpecification: SurveyNotebookDefinition`**. **`metadataDb` removed** once migration completes.

**`description`** (root) is the **short description of this survey** (listing, admin UI, “what we are collecting”). **`metadata.information.purposeMarkdown`** remains the **design / notebook purpose** inside the bundled UI spec.

```typescript
/** One Couch document in the `projects` database — a deployed project */
interface Project {
  /** Stable survey id (also Couch `_id`) */
  _id: string;
  _rev?: string;

  /** Display title of this survey */
  name: string;
  /** Survey description — **not** the same as `uiSpecification.metadata.information.purposeMarkdown` */
  description: string;
  /** Same values as today: `ProjectStatus` (`OPEN`, `CLOSED`, `ARCHIVED`) */
  status: ProjectStatus;

  /** Same shape as today’s `ProjectDocument.dataDb` (`PossibleConnectionInfo`, e.g. `db_name`) */
  dataDb: PossibleConnectionInfo;
  /** Owning team, if any */
  ownedByTeamId?: string;
  /** Source template id when created from a template */
  templateId?: string;

  /** Who instantiated this survey — people/auth user id only */
  createdByUserId: string;
  /** Creation time */
  createdAt: Timestamp;
  /** Last updated */
  updatedAt: Timestamp;

  /** Inlined former metadata DB + `ui-specification` Couch doc */
  uiSpecification: SurveyNotebookDefinition;
}
```

_Import **`ProjectStatus`**, **`PossibleConnectionInfo`** from `@faims3/data-model` / `library/data-model`._

---

### Template document — `Template` (`templates` DB)

Same pattern as **`Project`**: root holds **identity, description, audit, flags**; **`uiSpecification`** uses the same **`SurveyNotebookDefinition`** shape. **`description`** is what this **template** is for in listings and admin UI; design prose stays under **`metadata.information`**.

```typescript
/** One Couch document in the `templates` database */
interface Template {
  /** Stable template id */
  _id: string;
  _rev?: string;

  /** Bumped on each persisted content change */
  version: number;
  /** Listing / editor title */
  name: string;
  /** Short description of this template — **not** `purposeMarkdown` on the design side */
  description: string;

  /** section same as survey */
  createdByUserId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  ownedByTeamId?: string;

  /** Lifecycle and permission (same) */
  archived: boolean;
  isPublic: boolean;

  /** Inlined spec and design metadata */
  uiSpecification: SurveyNotebookDefinition;
}
```

---

### Metadata DB (target)

All former Couch **`metadata-{projectId}`** documents are **replaced** by **`Project.uiSpecification`** (the **`metadata`** partition + **`uiSpec`** other than former per-key docs) plus root audit fields. **`data-{projectId}`** is unchanged conceptually.

---

## Mapping of fields

Maps **legacy** locations (projects row, metadata DB, merged notebook `metadata`, `ui-specification` doc, template document) to the **proposed** shapes: **`Project`** / **`Template`** root and **`uiSpecification: { uiSpec, metadata }`**. Paths use **`Project`** / **`Template`** as the persisted document root.

### Project (`projects` DB) — top-level

| Legacy source | Legacy field / path                                           | New location              | Migration / typing notes                                                                                                                                             |
| ------------- | ------------------------------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Project doc   | `_id`                                                         | `Project._id`             | Unchanged Couch id.                                                                                                                                                  |
| Project doc   | `_rev`                                                        | `Project._rev`            | Unchanged.                                                                                                                                                           |
| Project doc   | `name`                                                        | `Project.name`            | Prefer **`project.name`**; if only **`metadata.name`** existed historically, copy that string.                                                                       |
| Project doc   | `status` (`ProjectStatus`: `OPEN` / `CLOSED` / `ARCHIVED`)    | `Project.status`          | **Unchanged** enum values and type — no casing migration.                                                                                                            |
| Project doc   | `dataDb` (`PossibleConnectionInfo`, `db_name`, `base_url`, …) | `Project.dataDb`          | **Unchanged** shape and property name.                                                                                                                               |
| Project doc   | `metadataDb`                                                  | _removed_                 | No pointer after inline spec; metadata Couch DB destroyed after cutover.                                                                                             |
| Project doc   | `ownedByTeamId`                                               | `Project.ownedByTeamId`   | Same semantics.                                                                                                                                                      |
| Project doc   | `templateId`                                                  | `Project.templateId`      | Same; drop duplicate **`metadata.template_id`** inside inlined bundle.                                                                                               |
| —             | _(missing today)_                                             | `Project.description`     | **New required field:** derive from first non-empty of legacy **`metadata.description`**, truncated **`metadata.pre_description`**, or `''` then prompt ops to fill. |
| —             | _(missing today)_                                             | `Project.createdByUserId` | **New required field:** no trustworthy legacy value — use migration policy (e.g. creating admin JWT `user_id`, or sentinel) — see gap note below.                    |
| —             | _(missing today)_                                             | `Project.createdAt`       | Use first-write timestamp from Couch, export audit, or migration run time if unknown.                                                                                |
| —             | _(missing today)_                                             | `Project.updatedAt`       | Use `Project._rev` history, last PUT audit, or migration run time.                                                                                                   |

### Notebook / metadata DB → `Project.uiSpecification`

| Legacy source                              | Legacy field / path                                                         | New location                                                         | Migration / typing notes                                                                                                                                                       |
| ------------------------------------------ | --------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Metadata DB doc `_id` = `ui-specification` | whole `EncodedProjectUIModel`                                               | `Project.uiSpecification.uiSpec` (minus `settings`)                  | Copy **`fields`**, **`fviews`**, **`viewsets`**, **`visible_types`** verbatim; run existing **`migrateNotebook`** first if needed.                                             |
| Metadata DB / merged `metadata`            | `showQRCodeButton`                                                          | `Project.uiSpecification.uiSpec.settings.showQrCodeButton`           | Coerce string **`'true'`** / **`'false'`** and legacy boolean to **boolean**; treat any other non-empty string as **`true`** only if product agrees, else default **`false`**. |
| Merged `metadata`                          | `pre_description`                                                           | `Project.uiSpecification.metadata.information.purposeMarkdown`       | Rename key; content unchanged.                                                                                                                                                 |
| Merged `metadata`                          | `project_lead`                                                              | `Project.uiSpecification.metadata.information.projectLeadLabel`      | Free text preserved; not a user id.                                                                                                                                            |
| Merged `metadata`                          | `lead_institution`                                                          | `Project.uiSpecification.metadata.information.leadInstitution`       | Same.                                                                                                                                                                          |
| Merged `metadata`                          | `notebook_version`                                                          | `Project.uiSpecification.metadata.information.notebookVersion`       | Rename to camelCase.                                                                                                                                                           |
| Merged `metadata`                          | `schema_version`                                                            | `Project.uiSpecification.metadata.information.schemaVersion`         | After **`migrateNotebook`**, expect **`3.0`** (or current target).                                                                                                             |
| Merged `metadata`                          | `name`                                                                      | _see `Project.name`_                                                 | Do not duplicate as canonical title; optional copy into **`metadata.custom.legacyMetadataName`** only if audits need it.                                                       |
| Merged `metadata`                          | `template_id`                                                               | _drop_                                                               | Authoritative link is **`Project.templateId`**; remove per-key doc / merged key.                                                                                               |
| Merged `metadata`                          | `project_id`                                                                | _drop_                                                               | Same as **`Project._id`**; remove from stored payload.                                                                                                                         |
| Merged `metadata`                          | `derived-from`                                                              | `Project.uiSpecification.metadata.information.derivedFromTemplateId` | Parse to a single template id string when present; **optional** — omit if empty. Distinct from **`Project.templateId`** (instantiation).                                       |
| Merged `metadata`                          | arbitrary extra keys (designer “extra fields”)                              | `Project.uiSpecification.metadata.custom.<key>`                      | Preserve unknown keys under **`custom`** for forward compatibility.                                                                                                            |
| Merged `metadata`                          | `accesses`, `ispublic`, `isrequest`, `filenames`, `meta`, `forms`, `access` | _drop_                                                               | No typed home; not used by server auth path today.                                                                                                                             |
| Merged `metadata`                          | `sections`                                                                  | _drop_ (after V2)                                                    | **`migrateToV2`** already moved content into **`fviews`**; if still present, run V2 then strip.                                                                                |
| Merged `metadata`                          | `project_status`                                                            | _drop_                                                               | Use **`Project.status`**; removed from metadata in V3 for surveys.                                                                                                             |
| Merged `metadata`                          | `last_updated`                                                              | _drop_                                                               | Prefer **`Project.updatedAt`** instead of a parallel string.                                                                                                                   |
| Merged `metadata`                          | `description`                                                               | `Project.description`                                                | Move to **root** survey description (not design `purposeMarkdown`).                                                                                                            |
| Metadata DB                                | `project-metadata-projectvalue` blob doc                                    | _ignore on read_                                                     | Rebuild from per-key docs + `ui-specification` merge; blob shape is unreliable today.                                                                                          |

### Template (`templates` DB)

| Legacy source               | Legacy field / path                                                       | New location                                                             | Migration / typing notes                                                                                                                                                           |
| --------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Template doc                | `_id`, `_rev`, `version`, `name`, `ownedByTeamId`, `archived`, `isPublic` | `Template.*` same names                                                  | **`description`** new: from first non-empty legacy **`metadata.description`**, truncated **`metadata.pre_description`**, or `''`.                                                  |
| Template doc                | `metadata.*` (informational keys)                                         | `Template.uiSpecification.metadata.information.*`                        | Same key mapping as **`Project`** table above (`pre_description` → **`purposeMarkdown`**, etc.).                                                                                   |
| Template doc                | `metadata.template_id`                                                    | _drop_                                                                   | Always equals **`Template._id`**; server injection removed in new model.                                                                                                           |
| Template doc                | `ui-specification`                                                        | `Template.uiSpecification.uiSpec`                                        | Same as survey: copy body then attach **`settings`**.                                                                                                                              |
| —                           | _(missing today)_                                                         | `Template.createdByUserId`, `createdAt`, `updatedAt`, `updatedByUserId?` | Same migration policy as surveys for **`createdByUserId`**; timestamps from Couch or migration run.                                                                                |
| Loose `metadata` / designer | `derived-from`                                                            | `Template.uiSpecification.metadata.information.derivedFromTemplateId`    | Same mapping as surveys: optional typed field; parse id when value is a single template id, else omit or preserve via **`metadata.custom`** only if audits require the raw string. |

### Cross-cutting

| Legacy concept                                            | New location                     | Notes                                                                                                                                                                      |
| --------------------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| “Notebook JSON” export `{ metadata, 'ui-specification' }` | `Project` or `Template` document | Split: wire **`ui-specification`** → **`uiSpecification.uiSpec`**; metadata bag → **`information`** + **`settings`** + **`custom`** + root **`description`** / **`name`**. |
| Record `created_by` / `created` (data DB)                 | _unchanged_                      | Still **per-record**; do not map to **`Project.createdByUserId`**.                                                                                                         |

**Known gap (unchanged):** historical surveys have **no** trustworthy **creator** in DB — **`Project.createdByUserId`** must come from an explicit migration policy (e.g. conductor admin, first project admin role holder, or sentinel), not from **`project_lead`** text.

---

## Migration approach

**Entity migrations**

- **Project DB**: new properties populated from old sources.
- **Template DB**: same.
- **Metadata DB**: read-only migration path → new stores → decommission.
- **Notebook JSON**: update structure to meet new spec; support **designer** migration and a **batch migrator**.

## Other issues / notes
