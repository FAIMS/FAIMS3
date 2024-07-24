# Structure of the FAIMS CouchDB Database

FAIMS uses CouchDB for data storage and requires a particular structure to be in
place. This structure is described here.

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
    "conductor_url": "https://dev.conductor.faims.edu.au/",
  }
  ```

`conductor_url` is the URL of the Conductor instance we will use for authentication etc.

### `people`

Database referenced in `directory` as `people_db`.

Used to store records of users with the username as the record `_id`.  

### `projects`

Database referenced in `directory` as `projects_db` contains information about the
projects stored on this couchdb instance.

Document `_design/permissions` is added to implement a permissions check that
restricts access to users with the `_admin` role.

Every notebook has it's own document with the notebook name as the `id` containing eg:

```json
{
  "_id": "blue_mountains_survey",
  "_rev": "1-d3aa99ada9503360b611b060bee1a72b",
  "name": "Blue-Mountains-Survey",
  "metadata_db": {
    "db_name": "metadata-blue_mountains_survey"
  },
  "data_db": {
    "db_name": "data-blue_mountains_survey"
  },
  "auth_mechanisms": {
    "demo": {
      "portal": "https://dev.conductor.faims.edu.au:443",
      "type": "oauth",
      "name": "AAO DataCentral"
    }
  }
}
```

This names two databases that are used to store the metadata and data records for the
notebook instance.  By convention these are called `data-{project name}` and
`metadata-{project name}` (via constants defined in the FAIMS3 project) but
these names are not relied on by the code and the entries
here are used to locate the databases.

`auth_mechanisms` is repeated here from the projects database.  It doesn't seem to be
used anywhere at all.

## Individual project databases

Two databases hold the data for a notebook: `data-{project name}` and `metadata-{project name}`.  

### `metadata-{project name}`

This database contains the notebook metadata including the form definition with the id `ui_specification` (defined in [src/datamodel/database.ts] and equivalently in the FAIMS3 app as `UI_SPECIFICATION_NAME`).
This holds all of the field definitions etc for the notebook.

The value of `local_autoincrementers` in the metadata database will contain an incrementing value in the front end app unique to each user.  

Remaining documents in this database have ids like `project-metadata-{fieldname}` and hold values for various metadata fields:

* `access`
* `accesses`
* `behavious` - typo, not referenced anywhere
* `filenames`
* `forms`
* `ispublic`
* `isrequest`
* `lead_institution`
* `meta`
* `pre_description`
* `project_lead`
* `project_status`
* `projectvalue`
* `sections`

(defined in `src/gui/components/project/CreateProjectCard.tsx` in FAIMS3)

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
  "heads": [
    "frev-f588e888-854f-4df9-ae20-662281951fa0"
  ],
  "type": "FORM2"
}
```

#### `frev-{id}`

These documents define a revision of a record and point to avp documents that contain the
actual data values.   The property `avps` contains the list of field names
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
  "parents": [
    "frev-f0567880-0f49-4865-aa66-2ada6f8a6922"
  ],
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
