# Records CRUD API

## Overview

The Records CRUD API provides a **stateless REST interface** for reading and writing notebook (project) record data. It is an alternative to the default architecture where mobile and desktop apps replicate the remote database via the PouchDB/CouchDB sync protocol. Use this API when you need:

- **Online-only or server-driven workflows** (e.g. web back-office, scripts, integrations)
- **Record-level or field-level updates** without syncing the full dataset
- **The same authorization rules** as sync: project roles and "my records" vs "all records" are enforced per request

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

1. **Project-level**: the user must have at least the action required for the operation on that project (e.g. `READ_MY_PROJECT_RECORDS` for list/get, `CREATE_PROJECT_RECORD` for create). See [PermissionModel](PermissionModel.md) for actions and roles.
2. **Record-level**: for get/update/delete, the server checks whether the record is "yours" (`created_by` equals your user id) or someone else's, and requires `READ_MY_PROJECT_RECORDS` / `EDIT_MY_PROJECT_RECORDS` / `DELETE_MY_PROJECT_RECORDS` for your own records, or `READ_ALL_PROJECT_RECORDS` / `EDIT_ALL_PROJECT_RECORDS` / `DELETE_ALL_PROJECT_RECORDS` for others.

## Data model (brief)

- A **record** is the top-level entity; it has a unique **record ID** (e.g. `rec-<uuid>`) and a **type** equal to the form/viewset ID (e.g. `FORM1`, `FORM2`).
- Each record has one or more **revisions**. The current state is given by a **head** revision; each revision has a **revision ID** (e.g. `frev-<uuid>`).
- Field values are stored as **AVPs** (attribute–value pairs). When you **get** a record, you receive **form data**: a map of field IDs to `{ data, annotation?, attachments? }`. When you **update**, you send the same shape for the fields you want to change (partial updates are supported).

## Endpoints

### List records

**GET** `/api/notebooks/:id/records`

Returns a permission-filtered list of minimal record metadata (no field values). Only records the user is allowed to read (according to "my" vs "all" and project role) are included.

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

- **data**: map of field ID to `{ data, annotation?, attachments? }`. `data` is the field value (type depends on the field). `attachments` is an array of `{ attachmentId, filename, fileType }`.

---

### Update record (record-level or field-level)

**PATCH** `/api/notebooks/:id/records/:recordId`

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
| GET    | `/api/notebooks/:id/records` | READ_MY_PROJECT_RECORDS | Applied in filter | List records |
| POST   | `/api/notebooks/:id/records` | CREATE_PROJECT_RECORD   | — | Create record |
| GET    | `/api/notebooks/:id/records/:recordId` | READ_* | Read this record | Get one record |
| PATCH  | `/api/notebooks/:id/records/:recordId` | — | Edit this record | Update record |
| DELETE | `/api/notebooks/:id/records/:recordId` | — | Delete this record | Soft-delete |

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
   PATCH /api/notebooks/my-project-id/records/rec-...
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

## Related documentation

- [PermissionModel](PermissionModel.md) — Actions, roles, and resource-specific permissions.
- [Long-lived-tokens](Long-lived-tokens.md) — Obtaining and using access tokens for API calls.
- [Forms overview](forms/01-overview.md) — UI specification, viewsets, and field definitions (form IDs and field IDs come from the project UI spec).
