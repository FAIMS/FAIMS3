# Structure of the FAIMS CouchDB Database

FAIMS uses CouchDB for data storage and requires a particular structure to be in
place. This structure is described here.

For the **notebook definition model** (inlined `uiSpecification`, typed metadata, API routes), see [`NotebookDefinition.md`](../../docs/developer/docs/source/markdown/NotebookDefinition.md). For **deploying the metadata overhaul**, see [`MetadataMigrationGuide.md`](../../docs/developer/docs/source/markdown/MetadataMigrationGuide.md).

## Databases

All databases have a default `_security` document that contains empty entries
for admins and members.

### `directory`

The `directory` database holds a default document as follows:

```json
{
  "_id": "default",
  "name": "Default instance",
  "description": "Default FAIMS instance on hostname",
  "people_db": {
    "db_name": "people"
  },
  "projects_db": {
    "db_name": "projects"
  },
  "conductor_url": "https://dev.conductor.faims.edu.au/"
}
```

`conductor_url` is the URL of the Conductor instance we will use for authentication etc.

### `people`

Database referenced in `directory` as `people_db`.

Used to store records of users with the username as the record `_id`.

### `projects`

Database referenced in `directory` as `projects_db` contains one document per survey (notebook).

Document `_design/permissions` implements a permissions check that restricts access to users with the `_admin` role.

**Current shape (projects DB v4+)** — example:

```json
{
  "_id": "blue_mountains_survey",
  "_rev": "1-…",
  "name": "Blue Mountains Survey",
  "description": "Vegetation plot survey",
  "status": "OPEN",
  "dataDb": {
    "db_name": "data-blue_mountains_survey"
  },
  "templateId": "optional-template-id",
  "ownedByTeamId": "optional-team-id",
  "createdBy": "people-user-id",
  "createdAt": "2026-05-01T00:00:00.000Z",
  "updatedAt": "2026-05-01T00:00:00.000Z",
  "uiSpecification": {
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
}
```

- **`dataDb`** points at the per-survey **data** database (`data-{projectId}`).
- **`description`** (optional) — short operational blurb at document root, max 250 characters when present; may be omitted on new surveys. Not the long design prose in `uiSpecification.metadata.information.purposeMarkdown`.
- **`uiSpecification`** holds the former **`metadata-{projectId}`** content: the form definition (legacy `ui-specification`, with `fviews` decoded to **`views`**) plus typed design metadata and **`uiSpec.settings`**.
- **`metadataDb` is not stored** on new or migrated v4 documents.

`auth_mechanisms` appeared on older project documents; it is **not used** by current Conductor code.

### `templates`

Same **`uiSpecification`** pattern as projects, with template-specific root fields (`version`, `archived`, `isPublic`, audit fields). Root **`description`** is likewise optional (max 250 characters when set). See `library/data-model/src/data_storage/templatesDB/types.ts`.

## Per-survey data database

Each survey has a **`data-{projectId}`** database containing user records.

### Legacy `metadata-{project name}` (removed after cutover)

Historically, each survey also had a separate **`metadata-{projectId}`** Couch database containing:

- One document `_id: ui-specification` (wire key; code constant `ui-specification`) with `fields`, `fviews`, `viewsets`, `visible_types`
- Documents `_id: project-metadata-{key}` for loose metadata keys

That database is **deprecated**. Content is migrated into **`Project.uiSpecification`** by `projectsV3toV4Migration`. After migration, operators may delete leftover metadata databases with `api` script `delete-metadata-databases` (see `api/src/scripts/deleteMetadataDatabases.ts`).

**Autoincrement state:** developer docs once suggested autoincrementers lived in the metadata DB. The mobile app persists autoincrement state in **`local_state`** (IndexedDB), not in Couch metadata databases.

### `data-{project name}`

This database contains the actual records created by the user for this notebook.

`_design/attachment_filter` is a Javascript function.

There are then three kinds of records:

#### `rec-{id}`

These documents define a record and point to any revisions of the record that are being stored.

```json
{
  "_id": "rec-59230550-5142-4bde-85a3-b606d2793ebb",
  "_rev": "2-f02e75324d135e836b84a65c1aab91aa",
  "record_format_version": 1,
  "created": "2022-07-11T06:03:21.632Z",
  "created_by": "ksheng",
  "revisions": [
    "frev-f0567880-0f49-4865-aa66-2ada6f8a6922",
    "frev-f588e888-854f-4df9-ae20-662281951fa0"
  ],
  "heads": ["frev-f588e888-854f-4df9-ae20-662281951fa0"],
  "type": "FORM2"
}
```

#### `frev-{id}`

These documents define a revision of a record and point to avp documents that contain the
actual data values. The property `avps` contains the list of field names
from the notebook definition and references their values as avp documents.
The `parents` field denotes the parent version of this revision.

```json
{
  "_id": "frev-f588e888-854f-4df9-ae20-662281951fa0",
  "_rev": "1-d1f208b3a014931e27b06f3f69035138",
  "revision_format_version": 1,
  "avps": {
    "newfield8baedbec": "avp-4a72953f-8078-4faf-aad0-826570e6ff17",
    "newfieldcce6babf": "avp-ba2456a8-c924-4986-a8cd-f253b60f07c8",
    "hridFORM2": "avp-94407027-4d02-4f80-95cb-ecd805f9e441"
  },
  "record_id": "rec-59230550-5142-4bde-85a3-b606d2793ebb",
  "parents": ["frev-f0567880-0f49-4865-aa66-2ada6f8a6922"],
  "created": "2022-08-26T05:19:45.269Z",
  "created_by": "stevecassidy",
  "type": "FORM2"
}
```

#### `avp-{id}`

The avp document contains a single value and any annotations:

```json
{
  "_id": "avp-fd41b132-0942-4167-8aee-06bf5367a2eb",
  "_rev": "1-4dc62da4f0bcf65c2c222ecbd6ed5513",
  "avp_format_version": 1,
  "type": "faims-core::String",
  "data": "αβγ",
  "revision_id": "frev-d8acc814-9e60-4c6b-bf0d-104a2146bd9c",
  "record_id": "rec-53589208-24c6-4f48-9c8f-6ed608762127",
  "annotations": {
    "annotation": "",
    "uncertainty": false
  },
  "created": "2022-07-12T03:32:14.544Z",
  "created_by": "liz.mannering"
}
```

**Note:** `created` / `created_by` on record documents are **per-record** audit fields, not the survey-level `Project.createdBy`.
