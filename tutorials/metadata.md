# Project Metadata

Every project (Notebook) has a metadata database that stores project metadata
fields and values. This note documents how these metadata fields are used
in the application.

The `getProjectMetadata` function (from `src/projectMetadata.ts`) is the access
point for project metadata.  This survey is based on looking at where that
function is called.  Based on this review the following fields are expected
in the metadata:

* `project_status` - text shown in the UI
* `lead_institution` - text shown in the UI
* `project_lead` - text shown in the UI
* `last_updated` - text shown in the UI
* `meta` - an object containing at least the field `showQRCodeButton`
* `projectvalue` - an object containing all of the metadata fields
* `attachedfilenames` - a list of attached filenames
* `attachments` - a list of attachments
* `sections` - a section name?

## MetadataRenderer

A component that can display a metadata field and it's value.
Used to render `project_status`, `lead_institution`, `project_lead` and `last_updated` 
in `NotebookComponent`.

## AddRecordButtons

This record adds buttons to the page for a notebook based on various properties
of the notebook. The metadata field `meta` is retrieved to check whether the value
`showQRCodeButton` is set to true, if it is, then a QR code button is shown in the
page.  THis relies on `meta` being an object containing the full metadata properties
of the project.

## CreateProjectCard

This is a component responsible for building new projects (Notebooks) or editing
existing ones.  It defines a local function `getprojectmeta` which retrieves the
metadata field `projectvalue` which it expects to be an object. It also retrieves
attachments listed in the `attachedfilenames` field of the `projectvalue`.  The
attachments are retrieved via `getProjectMetadata`.

This component is also the only place that `setProjectMetadata` is called.  It
sets:

* `isrequest` - a boolean
* `project_status` - set here to `pending`
* the contents of `PROJECT_META` which are:
  `project_status`,
  `accesses`,
  `forms`,
  `sections`,
  `meta`,
  `access`,
  `ispublic`,
  `isrequest`,
  `behaviours`,
  `project_lead`,
  `lead_institution`,
  `pre_description`,
  `filenames`, these all seem to be stored locally in `projectvalue` which 
  at some point is stored in the metadata field `projectvalue` (as well as 
  each of these fields being stored separately).

## MapFormField

This field retrieves the list of attachments for the notebook as the `attachments` metadata field.

## AdvancedSelect

Similar to the usage in `CreateProjectCard` this component retrieves a list of attached
filenames but this time from the `attachedfilenames` metadata field rather than the same field in the `projectvalue` metadata field.

## DraftEdit, Record

In these components, the metadata field `sections` is retrieved and used as part
of the configuration of a sub-component.   While the name implies there is more
than one section, the local variable is called `metaSection` and seems to be
a singular value.
