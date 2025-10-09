import {z} from 'zod';

// ============================================================================
// Common Schemas
// ============================================================================

const pouchDBDocumentSchema = z.object({
  _id: z.string(),
  _rev: z.string().optional(),
});

const existingPouchDBDocumentSchema = z.object({
  _id: z.string(),
  _rev: z.string(),
});

// ============================================================================
// Record Document
// ============================================================================

export const v1RecordDBFieldsSchema = z
  .object({
    record_format_version: z.number(),
    created: z.string().datetime(),
    created_by: z.string().email(),
    revisions: z.array(z.string()),
    heads: z.array(z.string()),
    type: z.string(),
  })
  .strict();

export type V1RecordDBFields = z.infer<typeof v1RecordDBFieldsSchema>;
export type RecordDBFields = V1RecordDBFields;

export const recordDocumentSchema = pouchDBDocumentSchema.merge(
  v1RecordDBFieldsSchema
);

export const existingRecordDocumentSchema = existingPouchDBDocumentSchema.merge(
  v1RecordDBFieldsSchema
);

export type RecordDBDocument = z.infer<typeof recordDocumentSchema>;
export type ExistingRecordDBDocument = z.infer<
  typeof existingRecordDocumentSchema
>;

// ============================================================================
// Revision Document
// ============================================================================

export const v1RevisionDBFieldsSchema = z
  .object({
    revision_format_version: z.number(),
    avps: z.record(z.string(), z.string()),
    record_id: z.string(),
    parents: z.array(z.string()),
    created: z.string().datetime(),
    created_by: z.string().email(),
    type: z.string(),
    ugc_comment: z.string().optional(),
    relationship: z
      .object({
        parent: z.object({
          record_id: z.string(),
          field_id: z.string(),
          relation_type_vocabPair: z.tuple([z.string(), z.string()]),
        }),
      })
      .optional()
      // This allows empty objects
      .or(z.object({})),
  })
  .strict();

export type V1RevisionDBFields = z.infer<typeof v1RevisionDBFieldsSchema>;
export type RevisionDBFields = V1RevisionDBFields;

export const revisionDocumentSchema = pouchDBDocumentSchema.merge(
  v1RevisionDBFieldsSchema
);

export const existingRevisionDocumentSchema =
  existingPouchDBDocumentSchema.merge(v1RevisionDBFieldsSchema);

export type RevisionDBDocument = z.infer<typeof revisionDocumentSchema>;
export type ExistingRevisionDBDocument = z.infer<
  typeof existingRevisionDocumentSchema
>;

// ============================================================================
// AVP (Attribute-Value-Pair) Document
// ============================================================================

export const v1AvpDBFieldsSchema = z
  .object({
    avp_format_version: z.number(),
    type: z.string(),
    data: z.unknown(),
    revision_id: z.string(),
    record_id: z.string(),
    annotations: z
      .object({
        annotation: z.string(),
        uncertainty: z.boolean(),
      })
      .optional(),
    created: z.string().datetime(),
    created_by: z.string().email(),
    faims_attachments: z
      .array(
        z.object({
          attachment_id: z.string(),
          filename: z.string(),
          file_type: z.string(),
        })
      )
      .optional(),
  })
  .strict();

export type V1AvpDBFields = z.infer<typeof v1AvpDBFieldsSchema>;
export type AvpDBFields = V1AvpDBFields;

export const avpDocumentSchema =
  pouchDBDocumentSchema.merge(v1AvpDBFieldsSchema);

export const existingAvpDocumentSchema =
  existingPouchDBDocumentSchema.merge(v1AvpDBFieldsSchema);

export type AvpDBDocument = z.infer<typeof avpDocumentSchema>;
export type ExistingAvpDBDocument = z.infer<typeof existingAvpDocumentSchema>;

// ============================================================================
// Attachment Document
// ============================================================================

export const v1AttachmentDBFieldsSchema = z
  .object({
    attach_format_version: z.number(),
    avp_id: z.string(),
    revision_id: z.string(),
    record_id: z.string(),
    created: z.string().datetime(),
    created_by: z.string().email(),
    filename: z.string(),
    _attachments: z.record(
      z.string(),
      z.object({
        content_type: z.string(),
        revpos: z.number(),
        digest: z.string(),
        length: z.number(),
        stub: z.boolean(),
      })
    ),
  })
  .strict();

export type V1AttachmentDBFields = z.infer<typeof v1AttachmentDBFieldsSchema>;
export type AttachmentDBFields = V1AttachmentDBFields;

export const attachmentDocumentSchema = pouchDBDocumentSchema.merge(
  v1AttachmentDBFieldsSchema
);

export const existingAttachmentDocumentSchema =
  existingPouchDBDocumentSchema.merge(v1AttachmentDBFieldsSchema);

export type AttachmentDBDocument = z.infer<typeof attachmentDocumentSchema>;
export type ExistingAttachmentDBDocument = z.infer<
  typeof existingAttachmentDocumentSchema
>;

// ============================================================================
// Union Types for All Data Documents
// ============================================================================

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
