# Records CRUD API

> **Current availability:** The running Conductor API exposes **read-only** record routes: **GET** `/api/notebooks/:id/records/metadata` (list metadata) and **GET** `/api/notebooks/:id/records/:recordId` (single record). **Create** (POST), **fork revision** (POST `…/revisions`), **update** (PUT), and **delete** are **not enabled** until `ENABLE_RECORDS_CRUD_MUTATIONS` is set to `true` in `api/src/api/records.ts`. They are gated off while we finish design work so modification operations are **safe and well-defined at the API boundary** (validation, conflicts, attachments, and related semantics). The sections below describe the intended contract once those routes are turned on.

## Overview

The Records CRUD API provides a **stateless REST interface** for reading and writing notebook (project) record data. It is an alternative to the default architecture where mobile and desktop apps replicate the remote database via the PouchDB/CouchDB sync protocol. Use this API when you need:

- **Online-only or server-driven workflows** (e.g. web back-office, scripts, integrations)
- **Record-level or field-level updates** without syncing the full dataset
- **The same authorization rules** as sync: project roles and "my records" vs "all records" are enforced per request (including fork and update)

The API is **stateless**: each request is authenticated with a Bearer JWT and authorized against the project and, for read/update/delete, the specific record. No session state is kept on the server.

## Base URL and authentication

All endpoints are under:

```
/api/notebooks/:id/records
```

- **:id** is the **project (notebook) ID**.
- **Authentication**: every request must include a short-lived access token (see [Long-lived-tokens](Long-lived-tokens.md) for obtaining one):

```
Authorization: Bearer <access_token>
```

- **Content-Type**: send `Content-Type: application/json` for request bodies.

Authorization is enforced in two layers:

1. **Project-level**: the user must have at least the action required for the operation on that project (e.g. `READ_MY_PROJECT_RECORDS` for list/get, `CREATE_PROJECT_RECORD` for create, `EDIT_MY_PROJECT_RECORDS` to pass the gate for update/fork/delete — see below). See [PermissionModel](PermissionModel.md) for actions and roles.
2. **Record-level**: for get/update/fork/delete, the server checks whether the record is "yours" (`created_by` equals your user id) or someone else's, and requires `READ_MY_PROJECT_RECORDS` / `EDIT_MY_PROJECT_RECORDS` / `DELETE_MY_PROJECT_RECORDS` for your own records, or `READ_ALL_PROJECT_RECORDS` / `EDIT_ALL_PROJECT_RECORDS` / `DELETE_ALL_PROJECT_RECORDS` for others.

## Data model (brief)

- A **record** is the top-level entity; it has a unique **record ID** (e.g. `rec-<uuid>`) and a **type** equal to the form/viewset ID (e.g. `FORM1`, `FORM2`).
- Each record has one or more **revisions**. The current state is given by a **head** revision; each revision has a **revision ID** (e.g. `frev-<uuid>`). Revisions can reference a **parent** revision (for history and for update `mode: "parent"` in the data engine).
- You can **fork** a revision: create a **new** revision document that copies the same AVP map as an existing revision, sets that revision as its single parent, and moves the record head to the new revision. This matches how the form app prepares a working copy before editing with parent-mode AVP semantics.
- Field values are stored as **AVPs** (attribute–value pairs). When you **get** a record, you receive **form data**: a map of field IDs to `{ data, annotation?, attachments? }`. When you **update**, you send the same shape for the fields you want to change (partial updates are supported).

## Attachments

**Disclaimer:** The Records CRUD API does **not** provide full attachment workflows. There are no dedicated endpoints to upload files or to download a single attachment by ID.

- **GET** responses may include an `attachments` array per field, but each entry is **metadata only** (`attachmentId`, `filename`, `fileType`). File bytes are **not** returned in JSON.
- **PUT** accepts the same metadata shape on fields you update. The server writes **references** (`faims_attachments`) on AVPs; it does **not** create new attachment documents or accept raw file data (no multipart, base64 payload, or equivalent in this API). Pointing at attachment IDs that already exist in the project data store may be possible, but **uploading new files through this REST surface is not supported** at present.
- The FAIMS app stores binaries via the data model’s attachment services and sync; that path is separate from these routes.

To obtain attachment **files** in bulk, use the notebook **export** API (for example ZIP or full export) under `/api/notebooks/...`, not the per-record CRUD paths documented here.

## Endpoints

### List record metadata

**GET** `/api/notebooks/:id/records/metadata`

Returns a permission-filtered list of minimal record metadata (no field values). Only records the user is allowed to read (according to "my" vs "all" and project role) are included.

**Note:** **GET** `/api/notebooks/:id/records/` (trailing slash) remains the **legacy** endpoint that returns full export-shaped records and requires `EXPORT_PROJECT_DATA`. Use `/records/metadata` for the lightweight listing above.

**Required permission**: at least `READ_MY_PROJECT_RECORDS` on the project.

**Query parameters**:

| Parameter       | Type    | Required | Description                                                                 |
|----------------|--------|----------|-----------------------------------------------------------------------------|
| `formId`       | string | No       | Filter by record type (form/viewset ID).                                   |
| `limit`        | number | No       | Max number of records (1–500).                                             |
| `startKey`     | string | No       | Pagination cursor from a previous response.                                |
| `filterDeleted`| string | No       | `"true"` (default) or `"false"`. If `"false"`, soft-deleted records are included. |

**Response** (200 OK):

```json
{
  "records": [
    {
      "projectId": "1693291182736-campus-survey-demo",
      "recordId": "rec-abc123-...",
      "revisionId": "frev-def456-...",
      "created": "2024-01-15T10:00:00.000Z",
      "createdBy": "admin",
      "updated": "2024-01-15T11:00:00.000Z",
      "updatedBy": "admin",
      "conflicts": false,
      "deleted": false,
      "type": "FORM2",
      "relationship": null
    }
  ]
}
```

---

### Create record

**POST** `/api/notebooks/:id/records`

Creates a new record and its first (empty) revision. You can then update that revision with field data via the update endpoint.

**Required permission**: `CREATE_PROJECT_RECORD` on the project.

**Request body**:

| Field        | Type   | Required | Description                                              |
|-------------|--------|----------|----------------------------------------------------------|
| `formId`    | string | Yes      | Form/viewset ID (e.g. `FORM1`, `FORM2`).                 |
| `createdBy`| string | No       | User ID for the record creator. Defaults to the token user. |
| `relationship` | object | No    | Optional parent/linked relationship (see below).         |

**Example**:

```json
{
  "formId": "FORM2",
  "createdBy": "admin"
}
```

With optional relationship:

```json
{
  "formId": "FORM2",
  "createdBy": "admin",
  "relationship": {
    "parent": [
      {
        "recordId": "rec-parent-...",
        "fieldId": "survey-area",
        "relationTypeVocabPair": ["is child of", "is parent of"]
      }
    ]
  }
}
```

**Response** (201 Created):

```json
{
  "recordId": "rec-<uuid>",
  "revisionId": "frev-<uuid>"
}
```

---

### Get one record

**GET** `/api/notebooks/:id/records/:recordId`

Returns the full form data for a single record (the current head revision, or a specific revision if requested).

**Required permission**: `READ_MY_PROJECT_RECORDS` or `READ_ALL_PROJECT_RECORDS` on the project, and record-level read access (see Overview).

**Query parameters**:

| Parameter   | Type   | Required | Description                                  |
|------------|--------|----------|----------------------------------------------|
| `revisionId` | string | No     | If provided, return this revision; otherwise the head is used. |

**Response** (200 OK):

```json
{
  "formId": "FORM2",
  "revisionId": "frev-<uuid>",
  "data": {
    "hridFORM2": {
      "data": "Element: Test-00001",
      "attachments": []
    },
    "autoincrementer": {
      "data": "00001",
      "annotation": { "annotation": "", "uncertainty": false },
      "attachments": []
    }
  },
  "context": {
    "record": { ... },
    "revision": { ... },
    "hrid": "Element: Test-00001"
  }
}
```

- **data**: map of field ID to `{ data, annotation?, attachments? }`. `data` is the field value (type depends on the field). `attachments` is an array of `{ attachmentId, filename, fileType }` (metadata only; see [Attachments](#attachments)).

---

### Fork revision (new head from an existing revision)

**POST** `/api/notebooks/:id/records/:recordId/revisions`

Creates a **new** revision that reuses the same AVP references as the revision you specify, sets that revision as the **parent** of the new one, and updates the record so the new revision is the **head**. No field values are changed by this call alone — use the update endpoint afterward.

This is the same operation as `FormOperations.createRevision` in the data model: use it when you want default **`mode: "parent"`** updates (the updated revision must have exactly one parent) but the current head has **no** parent yet (e.g. first revision after create).

**Required permission**: project-level `EDIT_MY_PROJECT_RECORDS` (same gate as update), plus record-level edit (`EDIT_MY_PROJECT_RECORDS` or `EDIT_ALL_PROJECT_RECORDS` depending on who created the record).

**Request body**:

| Field        | Type   | Required | Description |
|-------------|--------|----------|-------------|
| `revisionId`| string | Yes      | Existing revision to fork from (must belong to `:recordId`). |
| `createdBy`| string | No       | User ID stored on the new revision. Defaults to the token user. |

**Example**:

```json
{
  "revisionId": "frev-<uuid>"
}
```

**Response** (201 Created):

```json
{
  "revisionId": "frev-<new-uuid>"
}
```

The new `revisionId` is the record’s new head. The previous revision remains in history and is the parent of the new revision (`context.revision.parents` on a subsequent GET will include it).

**Errors**: `400` if `revisionId` belongs to a different record (revision mismatch), or other invalid input; `404` if the record or revision does not exist.

---

### Update record (record-level or field-level)

**PUT** `/api/notebooks/:id/records/:recordId`

Updates the given revision by applying the provided field data. You can send **all** fields (record-level) or **only the fields that change** (field-level); omitted fields keep their current values.

**Required permission**: record-level edit (your record → `EDIT_MY_PROJECT_RECORDS`, others → `EDIT_ALL_PROJECT_RECORDS`).

**Request body**:

| Field        | Type   | Required | Description                                                                 |
|-------------|--------|----------|-----------------------------------------------------------------------------|
| `revisionId`| string | Yes      | The revision to update (current head or a specific revision).               |
| `update`    | object | Yes      | Map of field ID to `{ data, annotation?, attachments? }`. Only include fields you want to change. |
| `mode`      | string | No       | `"new"` or `"parent"`. Default `"parent"`. Use `"new"` for the first update after create (revision has no parents). |

**Example (field-level update)**:

```json
{
  "revisionId": "frev-<uuid>",
  "update": {
    "hridFORM2": {
      "data": "Element: Updated-00001",
      "attachments": []
    }
  },
  "mode": "new"
}
```

**Response** (200 OK):

```json
{
  "revisionId": "frev-<uuid>"
}
```

The returned `revisionId` is the updated revision (may be the same document with a new `_rev` if the engine updated in place).

---

### Soft-delete record

**DELETE** `/api/notebooks/:id/records/:recordId`

Marks the record as deleted by creating a new revision with `deleted: true`. Data is retained; list/get can exclude deleted records depending on `filterDeleted` and client behaviour.

**Required permission**: record-level delete (your record → `DELETE_MY_PROJECT_RECORDS`, others → `DELETE_ALL_PROJECT_RECORDS`).

**Query parameters**:

| Parameter   | Type   | Required | Description                    |
|------------|--------|----------|--------------------------------|
| `revisionId` | string | Yes    | Current head revision ID.      |

**Example**: `DELETE /api/notebooks/my-project-id/records/rec-abc123?revisionId=frev-def456`

**Response**: 204 No Content (empty body).

---

## Error responses

| Status | Meaning |
|--------|--------|
| **400** | Bad request: invalid body, missing or invalid query (e.g. missing `revisionId` on delete), or invalid state (e.g. malformed parents, revision mismatch). |
| **401** | Unauthorized: missing or invalid Bearer token. |
| **403** | Forbidden: authenticated but not allowed to perform this action on this project or record (e.g. cannot edit another user's record with a guest role). |
| **404** | Not found: project or record or revision does not exist. |
| **409** | Conflict: record has multiple heads (concurrent updates). Retry with an explicit `revisionId` after resolving conflicts. |

Error bodies are JSON, e.g.:

```json
{
  "error": "authentication required"
}
```

or a message string depending on the middleware.

## Summary table

| Method | Path | Permission (project) | Record-level check | Description |
|--------|------|----------------------|--------------------|-------------|
| GET    | `/api/notebooks/:id/records/metadata` | READ_MY_PROJECT_RECORDS | Applied in filter | List record metadata |
| POST   | `/api/notebooks/:id/records` | CREATE_PROJECT_RECORD   | — | Create record |
| GET    | `/api/notebooks/:id/records/:recordId` | READ_* | Read this record | Get one record |
| POST   | `/api/notebooks/:id/records/:recordId/revisions` | EDIT_MY_PROJECT_RECORDS | Edit this record | Fork revision (new head) |
| PUT    | `/api/notebooks/:id/records/:recordId` | EDIT_MY_PROJECT_RECORDS | Edit this record | Update record |
| DELETE | `/api/notebooks/:id/records/:recordId` | EDIT_MY_PROJECT_RECORDS | Delete this record | Soft-delete |

## Example: create and update a record

1. **Create** a new record (empty first revision):

   ```http
   POST /api/notebooks/my-project-id/records
   Content-Type: application/json
   Authorization: Bearer <token>

   { "formId": "FORM2" }
   ```

   Response: `201` with `{ "recordId": "rec-...", "revisionId": "frev-..." }`.

2. **Update** the first revision with field data (use `mode: "new"` because this revision has no parent):

   ```http
   PUT /api/notebooks/my-project-id/records/rec-...
   Content-Type: application/json
   Authorization: Bearer <token>

   {
     "revisionId": "frev-...",
     "update": {
       "hridFORM2": { "data": "Element: Test-001", "attachments": [] }
     },
     "mode": "new"
   }
   ```

   Response: `200` with `{ "revisionId": "frev-..." }`.

3. **Get** the record to verify:

   ```http
   GET /api/notebooks/my-project-id/records/rec-...
   Authorization: Bearer <token>
   ```

   Response: `200` with full form data including the updated field.

## Example: fork then update with default `parent` mode

After the first save, the head revision may still have **no** parent. To align with **parent-mode** AVP behaviour (same as the form app), fork the head, then **PUT** with default `mode` (`"parent"`):

1. **Fork** the current head (from list or GET):

   ```http
   POST /api/notebooks/my-project-id/records/rec-...
   Content-Type: application/json
   Authorization: Bearer <token>

   { "revisionId": "frev-<current-head>" }
   ```

   Response: `201` with `{ "revisionId": "frev-<new-head>" }`.

2. **Update** the new head (omit `mode` or set `"parent"`):

   ```http
   PUT /api/notebooks/my-project-id/records/rec-...
   Content-Type: application/json
   Authorization: Bearer <token>

   {
     "revisionId": "frev-<new-head>",
     "update": {
       "hridFORM2": { "data": "Element: Test-002", "attachments": [] }
     }
   }
   ```

If the head already has exactly one parent (e.g. you forked earlier), you can usually **PUT** directly with default `mode: "parent"` without forking again.

## Related documentation

- [PermissionModel](PermissionModel.md) — Actions, roles, and resource-specific permissions.
- [Long-lived-tokens](Long-lived-tokens.md) — Obtaining and using access tokens for API calls.
- [Forms overview](forms/01-overview.md) — UI specification, viewsets, and field definitions (form IDs and field IDs come from the project UI spec).
