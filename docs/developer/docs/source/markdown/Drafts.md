# Draft Storage

Drafts are created when you first create a new record or when you start
editing an existing record.   A draft exists up to the point that you
publish a record at which point it is deleted and the full record
is stored in the dataDB.

Drafts are stored in a separate draft_db. Most of the code around them
is in <sync/draft-storage.ts>.

I'm writing this after debugging an issue relating to attachments in
drafts. It focusses on that issue and doesn't reflect a complete
understanding of how drafts work.

## Draft Creation

To create a draft we call `newStagedData` with a link to an existing record which
will be null if this is a new record.  The encoded draft (`EncodedDraft`) has
no content initially (fields, annotations are empty).

## Draft Update

When a change is made in the form, setStagedData is called with the values
from the current form. At this point we update the stored draft with all
form values and with some special treatment for attachments. SetStagedData
merges the new data with whatever was stored in the database for field values
annotations and relationships.

Attachments are handled specially.  Any field that holds files (Photos) has the
values stored separately.  We note that the value of these fields can contain
both files (just attached photos) and FAIMSAttachmentReference objects that refer
to an existing stored attachment that may or may not be on-device. The process
here takes any File object and stores it as an attachment to the draft record.
The value of these fields are stored separately in the `.attachments` property
with the actual files in `._attachments`.

## Draft Retrieval

When we want to get the updated version of the draft we pull the record from
the database and go through the reverse of the attachment process to turn the
stored attachments into file values in the form.
