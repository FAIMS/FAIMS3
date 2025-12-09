import {z} from 'zod';

// ============================================================================
// Common Schemas
// ============================================================================

const newPouchDBDocumentSchema = z.object({
  _id: z.string(),
});

const pouchDBDocumentSchema = newPouchDBDocumentSchema.extend({
  _rev: z.string().optional(),
});

const existingPouchDBDocumentSchema = newPouchDBDocumentSchema.extend({
  _rev: z.string(),
});

export type ExistingPouchDocument = z.infer<
  typeof existingPouchDBDocumentSchema
>;
export type NewPouchDocument = z.infer<typeof newPouchDBDocumentSchema>;

// ============================================================================
// Record Document
// ============================================================================

export const v1RecordDBFieldsSchema = z
  .object({
    record_format_version: z.number(),
    created: z.string().datetime(),
    created_by: z.string(),
    revisions: z.array(z.string()),
    heads: z.array(z.string()),
    type: z.string(),
  })
  .strict();

export type V1RecordDBFields = z.infer<typeof v1RecordDBFieldsSchema>;
export type RecordDBFields = V1RecordDBFields;

export const newRecordDocumentSchema = newPouchDBDocumentSchema.merge(
  v1RecordDBFieldsSchema
);

export const recordDocumentSchema = pouchDBDocumentSchema.merge(
  v1RecordDBFieldsSchema
);

export const existingRecordDocumentSchema = existingPouchDBDocumentSchema.merge(
  v1RecordDBFieldsSchema
);

export type NewRecordDBDocument = z.infer<typeof newRecordDocumentSchema>;
export type RecordDBDocument = z.infer<typeof recordDocumentSchema>;
export type ExistingRecordDBDocument = z.infer<
  typeof existingRecordDocumentSchema
>;

// ============================================================================
// Revision Document
// ============================================================================

export const relationshipSchema = z.object({
  parent: z.object({
    record_id: z.string(),
    field_id: z.string(),
    relation_type_vocabPair: z.tuple([z.string(), z.string()]),
  }),
});

export type RecordRelationship = z.infer<typeof relationshipSchema>;

export const v1RevisionDBFieldsSchema = z
  .object({
    revision_format_version: z.number(),
    avps: z.record(z.string(), z.string()),
    record_id: z.string(),
    parents: z.array(z.string()),
    created: z.string().datetime(),
    created_by: z.string(),
    type: z.string(),
    ugc_comment: z.string().optional(),
    relationship: relationshipSchema
      .optional()
      // This allows empty objects
      .or(z.object({}).strict()),
  })
  .strict();

export type V1RevisionDBFields = z.infer<typeof v1RevisionDBFieldsSchema>;
export type RevisionDBFields = V1RevisionDBFields;

export const newRevisionDocumentSchema = newPouchDBDocumentSchema.merge(
  v1RevisionDBFieldsSchema
);

export const revisionDocumentSchema = pouchDBDocumentSchema.merge(
  v1RevisionDBFieldsSchema
);

export const existingRevisionDocumentSchema =
  existingPouchDBDocumentSchema.merge(v1RevisionDBFieldsSchema);

export type NewRevisionDBDocument = z.infer<typeof newRevisionDocumentSchema>;
export type RevisionDBDocument = z.infer<typeof revisionDocumentSchema>;
export type ExistingRevisionDBDocument = z.infer<
  typeof existingRevisionDocumentSchema
>;

// ============================================================================
// AVP (Attribute-Value-Pair) Document
// ============================================================================

export const annotationsSchema = z.object({
  annotation: z.string(),
  uncertainty: z.boolean(),
});

export type RecordAnnotations = z.infer<typeof annotationsSchema>;

export const attachmentSchema = z.object({
  attachment_id: z.string(),
  filename: z.string(),
  file_type: z.string(),
});
export type Attachment = z.infer<typeof attachmentSchema>;

export const v1AvpDBFieldsSchema = z
  .object({
    avp_format_version: z.number(),
    type: z.string(),
    data: z.unknown(),
    revision_id: z.string(),
    record_id: z.string(),
    annotations: annotationsSchema.optional(),
    created: z.string().datetime(),
    created_by: z.string(),
    faims_attachments: z.array(attachmentSchema).optional(),
  })
  .strict();

export type V1AvpDBFields = z.infer<typeof v1AvpDBFieldsSchema>;
export type AvpDBFields = V1AvpDBFields;

export const newAvpDocumentSchema =
  newPouchDBDocumentSchema.merge(v1AvpDBFieldsSchema);

export const avpDocumentSchema =
  pouchDBDocumentSchema.merge(v1AvpDBFieldsSchema);

export const existingAvpDocumentSchema =
  existingPouchDBDocumentSchema.merge(v1AvpDBFieldsSchema);

export type NewAvpDBDocument = z.infer<typeof newAvpDocumentSchema>;
export type AvpDBDocument = z.infer<typeof avpDocumentSchema>;
export type ExistingAvpDBDocument = z.infer<typeof existingAvpDocumentSchema>;

// ============================================================================
// Attachment Schemas
// ============================================================================

// Encoded attachment (stub version - as stored in CouchDB after upload)
export const encodedAttachmentSchema = z.object({
  content_type: z.string(),
  revpos: z.number(),
  digest: z.string(),
  length: z.number(),
  stub: z.literal(true),
});
export type EncodedAttachment = z.infer<typeof encodedAttachmentSchema>;

// Pending attachment (with data - for PUT operations)
export const pendingAttachmentSchema = z.object({
  content_type: z.string(),
  // Base64 encoded data
  data: z.string(),
});
export type PendingAttachment = z.infer<typeof pendingAttachmentSchema>;

// ============================================================================
// Attachment Document Base
// ============================================================================

// Base fields shared by all attachment documents
const v1AttachmentDBFieldsBaseSchema = z.object({
  attach_format_version: z.number(),
  // This is optional - old records know this, but new ones don't need to. It's
  // exposing too much information about the AVP layer storage mechanism and
  // makes fields which require storing attachments very tricky to cleanly
  // implement.
  avp_id: z.string().optional(),
  revision_id: z.string(),
  record_id: z.string(),
  created: z.string().datetime(),
  created_by: z.string(),
  filename: z.string(),
});

// Encoded attachment document fields
export const v1AttachmentDBFieldsSchema = v1AttachmentDBFieldsBaseSchema
  .extend({
    _attachments: z.record(z.string(), encodedAttachmentSchema),
  })
  .strict();
export type V1AttachmentDBFields = z.infer<typeof v1AttachmentDBFieldsSchema>;
export type AttachmentDBFields = V1AttachmentDBFields;

// Pending attachment document fields
export const v1PendingAttachmentDBFieldsSchema = v1AttachmentDBFieldsBaseSchema
  .extend({
    _attachments: z.record(z.string(), pendingAttachmentSchema),
  })
  .strict();
export type V1PendingAttachmentDBFields = z.infer<
  typeof v1PendingAttachmentDBFieldsSchema
>;
export type PendingAttachmentDBFields = V1PendingAttachmentDBFields;

// New attachments are pending
export const newAttachmentDocumentSchema = newPouchDBDocumentSchema.merge(
  v1PendingAttachmentDBFieldsSchema
);

// Documents are generally already encoded
export const attachmentDocumentSchema = pouchDBDocumentSchema.merge(
  v1AttachmentDBFieldsSchema
);

// Existing attachments are encoded
export const existingAttachmentDocumentSchema =
  existingPouchDBDocumentSchema.merge(v1AttachmentDBFieldsSchema);

export type NewAttachmentDBDocument = z.infer<
  typeof newAttachmentDocumentSchema
>;
export type AttachmentDBDocument = z.infer<typeof attachmentDocumentSchema>;
export type ExistingAttachmentDBDocument = z.infer<
  typeof existingAttachmentDocumentSchema
>;

// Pending attachment documents (for PUT operations)
export const newPendingAttachmentDocumentSchema =
  newPouchDBDocumentSchema.merge(v1PendingAttachmentDBFieldsSchema);
export const pendingAttachmentDocumentSchema = pouchDBDocumentSchema.merge(
  v1PendingAttachmentDBFieldsSchema
);
export const existingPendingAttachmentDocumentSchema =
  existingPouchDBDocumentSchema.merge(v1PendingAttachmentDBFieldsSchema);

export type NewPendingAttachmentDBDocument = z.infer<
  typeof newPendingAttachmentDocumentSchema
>;
export type PendingAttachmentDBDocument = z.infer<
  typeof pendingAttachmentDocumentSchema
>;
export type ExistingPendingAttachmentDBDocument = z.infer<
  typeof existingPendingAttachmentDocumentSchema
>;
// ============================================================================
// Union Types for All Data Documents
// ============================================================================

export const newDataDocumentSchema = z.union([
  newRecordDocumentSchema,
  newRevisionDocumentSchema,
  newAvpDocumentSchema,
  newAttachmentDocumentSchema,
]);

export const dataDocumentSchema = z.union([
  recordDocumentSchema,
  revisionDocumentSchema,
  avpDocumentSchema,
  attachmentDocumentSchema,
]);

export const existingDataDocumentSchema = z.union([
  existingRecordDocumentSchema,
  existingRevisionDocumentSchema,
  existingAvpDocumentSchema,
  existingAttachmentDocumentSchema,
]);

export type DataDocument =
  | RecordDBDocument
  | RevisionDBDocument
  | AvpDBDocument
  | AttachmentDBDocument;

export type NewDataDocument =
  | NewRecordDBDocument
  | NewRevisionDBDocument
  | NewAvpDBDocument
  | NewAttachmentDBDocument;

export type ExistingDataDocument =
  | ExistingRecordDBDocument
  | ExistingRevisionDBDocument
  | ExistingAvpDBDocument
  | ExistingAttachmentDBDocument;

// ============================================================================
// Type Guards
// ============================================================================

export function isRecordDocument(doc: unknown): doc is RecordDBDocument {
  return (
    doc !== null && typeof doc === 'object' && 'record_format_version' in doc
  );
}

export function isRevisionDocument(doc: unknown): doc is RevisionDBDocument {
  return (
    doc !== null && typeof doc === 'object' && 'revision_format_version' in doc
  );
}

export function isAvpDocument(doc: unknown): doc is AvpDBDocument {
  return doc !== null && typeof doc === 'object' && 'avp_format_version' in doc;
}

export function isAttachmentDocument(
  doc: unknown
): doc is AttachmentDBDocument {
  return (
    doc !== null && typeof doc === 'object' && 'attach_format_version' in doc
  );
}

export function isExistingRecordDocument(
  doc: unknown
): doc is ExistingRecordDBDocument {
  return isRecordDocument(doc) && '_rev' in doc && typeof doc._rev === 'string';
}

export function isExistingRevisionDocument(
  doc: unknown
): doc is ExistingRevisionDBDocument {
  return (
    isRevisionDocument(doc) && '_rev' in doc && typeof doc._rev === 'string'
  );
}

export function isExistingAvpDocument(
  doc: unknown
): doc is ExistingAvpDBDocument {
  return isAvpDocument(doc) && '_rev' in doc && typeof doc._rev === 'string';
}

export function isExistingAttachmentDocument(
  doc: unknown
): doc is ExistingAttachmentDBDocument {
  return (
    isAttachmentDocument(doc) && '_rev' in doc && typeof doc._rev === 'string'
  );
}

// ============================================================================
// Utility Functions
// ============================================================================

export function getDocumentType(
  doc: unknown
): 'record' | 'revision' | 'avp' | 'attachment' | 'unknown' {
  if (isRecordDocument(doc)) return 'record';
  if (isRevisionDocument(doc)) return 'revision';
  if (isAvpDocument(doc)) return 'avp';
  if (isAttachmentDocument(doc)) return 'attachment';
  return 'unknown';
}

// ============================================================================
// Validation Functions
// ============================================================================

// ===============
// NEW OR EXISTING
// ===============

export function validateRecordDocument(data: unknown): RecordDBDocument {
  return recordDocumentSchema.parse(data);
}

export function validateRevisionDocument(data: unknown): RevisionDBDocument {
  return revisionDocumentSchema.parse(data);
}

export function validateAvpDocument(data: unknown): AvpDBDocument {
  return avpDocumentSchema.parse(data);
}

export function validateAttachmentDocument(
  data: unknown
): AttachmentDBDocument {
  return attachmentDocumentSchema.parse(data);
}

export function validateDataDocument(data: unknown): DataDocument {
  return dataDocumentSchema.parse(data);
}

// ===============
// NEW
// ===============

export function validateNewRecordDocument(data: unknown): NewRecordDBDocument {
  return newRecordDocumentSchema.parse(data);
}

export function validateNewRevisionDocument(
  data: unknown
): NewRevisionDBDocument {
  return newRevisionDocumentSchema.parse(data);
}

export function validateNewAvpDocument(data: unknown): NewAvpDBDocument {
  return newAvpDocumentSchema.parse(data);
}

export function validateNewAttachmentDocument(
  data: unknown
): NewAttachmentDBDocument {
  return newAttachmentDocumentSchema.parse(data);
}

export function validateNewDataDocument(data: unknown): NewDataDocument {
  return newDataDocumentSchema.parse(data);
}

// ===============
// EXISTING
// ===============

export function validateExistingRecordDocument(
  data: unknown
): ExistingRecordDBDocument {
  return existingRecordDocumentSchema.parse(data);
}

export function validateExistingRevisionDocument(
  data: unknown
): ExistingRevisionDBDocument {
  return existingRevisionDocumentSchema.parse(data);
}

export function validateExistingAvpDocument(
  data: unknown
): ExistingAvpDBDocument {
  return existingAvpDocumentSchema.parse(data);
}

export function validateExistingAttachmentDocument(
  data: unknown
): ExistingAttachmentDBDocument {
  return existingAttachmentDocumentSchema.parse(data);
}

export function validateExistingDataDocument(
  data: unknown
): ExistingDataDocument {
  return existingDataDocumentSchema.parse(data);
}

// ============================================================================
// High level Engine IO schemas
// ============================================================================

/**
 * Schema for file attachments associated with a field.
 */
export const faimsAttachmentSchema = z.object({
  /** Unique identifier for the attachment document - corresponds to
   * an att- prefixed attachment document */
  attachmentId: z.string(),
  /** Original filename of the attachment */
  filename: z.string(),
  /** MIME type of the file */
  fileType: z.string(),
});
export type FaimsAttachment = z.infer<typeof faimsAttachmentSchema>;

// and we use an array of these for multiple attachments
export const faimsAttachmentsSchema = z.array(faimsAttachmentSchema).optional();
export type FaimsAttachments = z.infer<typeof faimsAttachmentsSchema>;

/**
 * Schema for an annotation on a form field.
 * Annotations provide additional context and metadata about field values.
 */
const formAnnotationSchema = z.object({
  /** Human-readable annotation text describing the field value */
  annotation: z.string(),
  /** Flag indicating if there is uncertainty about this field's value */
  uncertainty: z.boolean(),
});

const formAnnotations = z.record(z.string(), formAnnotationSchema.optional());
export type FormAnnotations = z.infer<typeof formAnnotations>;
export type FormAnnotation = z.infer<typeof formAnnotationSchema>;

// Form data
const formDataEntry = z.object({
  data: z.unknown(),
  // NOTE: do we want to use the internal representation
  annotation: formAnnotationSchema.optional(),
  // NOTE: do we want to use the internal representation?
  attachments: faimsAttachmentsSchema,
});
export type FormDataEntry = z.infer<typeof formDataEntry>;
const formUpdateData = z.record(z.string(), formDataEntry);
export type FormUpdateData = z.infer<typeof formUpdateData>;

// AVP update modes
export type AvpUpdateMode = 'new' | 'parent';

/**
 * Schema for a relationship between records.
 * Used when a record is related to another record through a specific field.
 */
const formRelationshipSchema = z.object({
  parent: z.object({
    /** The ID of the parent record this record is related to */
    recordId: z.string(),
    /** The field ID in the parent record that defines this relationship */
    fieldId: z.string(),
    /** The relationship type as a vocabulary pair */
    relationTypeVocabPair: z.tuple([z.string(), z.string()]),
  }),
});

export type FormRelationship = z.infer<typeof formRelationshipSchema>;

/**
 * For submitting data from forms, this is the starting point
 */
const baseFormRecordSchema = z.object({
  /** The ID of the form/viewset this record is an instance of */
  formId: z.string(),
  /** The actual form data as a map of field IDs to their values */
  // data: z.record(z.string(), z.unknown()).optional(),
  /** Annotations for each field, mapped by field ID */
  // annotations: z.record(z.string(), formAnnotationSchema.optional()).optional(),
  /** Username of the user who created this record */
  createdBy: z.string(),
  /** Optional relationship information if this is a related/child record */
  relationship: formRelationshipSchema.optional(),
});

/**
 * Schema for a new form record being created.
 * Contains all necessary information to create a new record in the system.
 */
export const newFormRecordSchema = baseFormRecordSchema;

export type NewFormRecord = z.infer<typeof newFormRecordSchema>;

export const hydratedDataFieldSchema = z.object({
  /** Unique identifier for this AVP document */
  _id: z.string(),
  /** Current revision string from PouchDB */
  _rev: z.string(),
  /** Type identifier for this field */
  type: z.string(),
  /** The actual field value (can be any valid JSON type) */
  data: z.unknown(),
  /** The revision ID this AVP belongs to */
  revisionId: z.string(),
  /** The record ID this AVP belongs to */
  recordId: z.string(),
  /** Optional annotations for this field value */
  annotations: formAnnotationSchema.optional(),
  /** ISO datetime when this AVP was created */
  created: z.string().datetime(),
  /** User who created this AVP */
  createdBy: z.string(),
  /** Optional array of file attachments associated with this field */
  faimsAttachments: z.array(faimsAttachmentSchema).optional(),
});

export type HydratedDataField = z.infer<typeof hydratedDataFieldSchema>;

/**
 * Schema for the core record document containing record-level metadata.
 */
export const hydratedRecordDocumentSchema = z.object({
  /** Unique identifier for this record */
  _id: z.string(),
  /** Current revision string from PouchDB */
  _rev: z.string(),
  /** ISO 8601 datetime when the record was created */
  created: z.string().datetime(),
  /** User who created the record */
  createdBy: z.string(),
  /** Array of all revision IDs that make up this record's history */
  revisions: z.array(z.string()),
  /** Array of current head revision IDs (usually one, multiple if conflicted) */
  heads: z.array(z.string()),
  /** Form identifier for this document */
  formId: z.string(),
});

export type HydratedRecordDocument = z.infer<
  typeof hydratedRecordDocumentSchema
>;

/**
 * Schema for a revision document containing field values at a point in time.
 */
export const hydratedRevisionDocumentSchema = z.object({
  /** Unique identifier for this revision */
  _id: z.string(),
  /** Current revision string from PouchDB */
  _rev: z.string(),
  /** Attribute-value pairs mapping field IDs to AVP document IDs */
  avps: z.record(z.string(), z.string()),
  /** The record ID this revision belongs to */
  recordId: z.string(),
  /** Array of parent revision IDs (for tracking revision history) */
  parents: z.array(z.string()),
  /** ISO datetime when this revision was created */
  created: z.string().datetime(),
  /** User who created this revision */
  createdBy: z.string(),
  /** Type identifier for this form */
  formId: z.string(),
  /** Optional relationship information if this is a related record */
  relationship: formRelationshipSchema.optional(),
});

export type HydratedRevisionDocument = z.infer<
  typeof hydratedRevisionDocumentSchema
>;

/**
 * Schema for metadata about record retrieval and conflict resolution.
 */
export const hydratedRecordMetadataSchema = z.object({
  /** Whether this record had conflicting heads when retrieved */
  hadConflict: z.boolean(),
  /** The strategy used to resolve conflicts, if any were present */
  conflictResolution: z.enum(['throw', 'pickFirst', 'pickLast']).optional(),
  /** All head revision IDs that existed before conflict resolution */
  allHeads: z.array(z.string()),
});

export type HydratedRecordMetadata = z.infer<
  typeof hydratedRecordMetadataSchema
>;

/**
 * Schema for a fully hydrated record with all related data.
 * This represents a complete record retrieved from the database with all
 * its components and metadata assembled together.
 */
export const hydratedRecordSchema = z.object({
  /** The core record document containing record-level metadata */
  record: hydratedRecordDocumentSchema,
  /** The current revision document containing the latest field values */
  revision: hydratedRevisionDocumentSchema,
  /** Map of field IDs to their complete AVP (Attribute-Value-Pair) documents */
  data: z.record(z.string(), hydratedDataFieldSchema),
  /** Metadata about the record retrieval and conflict resolution */
  metadata: hydratedRecordMetadataSchema,
  /** What is the HRID of this record? */
  hrid: z.string(),
});

export type HydratedRecord = z.infer<typeof hydratedRecordSchema>;

// A packet of data needed to create a editable form
const initialFormData = z.object({
  revisionId: z.string(),
  formId: z.string(),
  data: formUpdateData,
  context: z.object({
    hrid: z.string(),
    record: hydratedRecordDocumentSchema,
    revision: hydratedRevisionDocumentSchema,
  }),
});

export type InitialFormData = z.infer<typeof initialFormData>;

/**
 * Query result for paginated record listing
 */
export interface RecordQueryResult {
  /** Array of record summaries for this page */
  records: RecordDBDocument[];
  /** Whether there are more records after this page */
  hasMore: boolean;
  /** Bookmark for fetching the next page (pass as `startKey` in next call) */
  nextStartKey?: string;
}

/**
 * Query result for paginated record listing (hydrated)
 */
export interface HydratedRecordQueryResult {
  /** Array of record summaries for this page */
  records: HydratedRecord[];
  /** Whether there are more records after this page */
  hasMore: boolean;
  /** Bookmark for fetching the next page (pass as `startKey` in next call) */
  nextStartKey?: string;
}
