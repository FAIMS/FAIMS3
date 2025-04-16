import {z} from 'zod';
import {CouchDocumentSchema, CouchExistingDocumentSchema} from '../utils';

// =============
// V1 Definition
// =============

// V1 - Refresh token schema
export const RefreshRecordV1FieldsSchema = z.object({
  // When does it expire? unix timestamp in ms
  expiryTimestampMs: z.number(),
  // Discriminator field
  documentType: z.literal('refresh'),
  // Which user ID has this refresh token
  userId: z.string(),
  // What is the token?
  token: z.string(),
  // Is this token valid
  enabled: z.boolean(),
});

// V1 - Email code schema
export const EmailCodeV1FieldsSchema = z.object({
  // When does it expire? unix timestamp in ms
  expiryTimestampMs: z.number(),
  // Discriminator field
  documentType: z.literal('emailcode'),
  // Which user ID generated this code?
  userId: z.string(),
  // Hashed code
  code: z.string(),
  // Has it been used?
  used: z.boolean(),
});

// V1 - Union of auth record types using discriminated union
export const AuthRecordV1FieldsSchema = z.discriminatedUnion('documentType', [
  RefreshRecordV1FieldsSchema,
  EmailCodeV1FieldsSchema,
]);

export const AuthRecordV1DocumentSchema = z.discriminatedUnion('documentType', [
  CouchDocumentSchema.extend(RefreshRecordV1FieldsSchema.shape),
  CouchDocumentSchema.extend(EmailCodeV1FieldsSchema.shape),
]);
export type AuthRecordV1Document = z.infer<typeof AuthRecordV1DocumentSchema>;

export const AuthRecordV1ExistingDocumentSchema = z.discriminatedUnion(
  'documentType',
  [
    CouchExistingDocumentSchema.extend(RefreshRecordV1FieldsSchema.shape),
    CouchExistingDocumentSchema.extend(EmailCodeV1FieldsSchema.shape),
  ]
);
export type AuthRecordV1ExistingDocument = z.infer<
  typeof AuthRecordV1ExistingDocumentSchema
>;

export type RefreshRecordV1Fields = z.infer<typeof RefreshRecordV1FieldsSchema>;
export type EmailCodeV1Fields = z.infer<typeof EmailCodeV1FieldsSchema>;
export type AuthRecordV1Fields = z.infer<typeof AuthRecordV1FieldsSchema>;

// refresh token
export const RefreshRecordV1DocumentSchema = CouchDocumentSchema.extend(
  RefreshRecordV1FieldsSchema.shape
);
export type RefreshRecordV1Document = z.infer<
  typeof RefreshRecordV1DocumentSchema
>;

export const RefreshRecordV1ExistingDocumentSchema =
  CouchExistingDocumentSchema.extend(RefreshRecordV1FieldsSchema.shape);
export type RefreshRecordV1ExistingDocument = z.infer<
  typeof RefreshRecordV1ExistingDocumentSchema
>;

// email code
export const EmailCodeV1DocumentSchema = CouchDocumentSchema.extend(
  EmailCodeV1FieldsSchema.shape
);
export type EmailCodeV1Document = z.infer<typeof EmailCodeV1DocumentSchema>;

export const EmailCodeV1ExistingDocumentSchema =
  CouchExistingDocumentSchema.extend(EmailCodeV1FieldsSchema.shape);
export type EmailCodeV1ExistingDocument = z.infer<
  typeof EmailCodeV1ExistingDocumentSchema
>;

// =============
// V2 Definition
// =============

// Refresh token schema with new fields added only to refresh tokens
export const RefreshRecordV2FieldsSchema = RefreshRecordV1FieldsSchema.extend({
  // New fields for V2 - only for refresh tokens
  exchangeTokenHash: z.string(),
  exchangeTokenUsed: z.boolean(),
});

// V2 - Email code schema remains the same as V1
export const EmailCodeV2FieldsSchema = EmailCodeV1FieldsSchema;

export const AuthRecordV2FieldsSchema = z.discriminatedUnion('documentType', [
  RefreshRecordV2FieldsSchema,
  EmailCodeV2FieldsSchema,
]);

export const AuthRecordV2DocumentSchema = z.discriminatedUnion('documentType', [
  CouchDocumentSchema.extend(RefreshRecordV2FieldsSchema.shape),
  CouchDocumentSchema.extend(EmailCodeV2FieldsSchema.shape),
]);
export type AuthRecordV2Document = z.infer<typeof AuthRecordV2DocumentSchema>;

export const AuthRecordV2ExistingDocumentSchema = z.discriminatedUnion(
  'documentType',
  [
    CouchExistingDocumentSchema.extend(RefreshRecordV2FieldsSchema.shape),
    CouchExistingDocumentSchema.extend(EmailCodeV2FieldsSchema.shape),
  ]
);
export type AuthRecordV2ExistingDocument = z.infer<
  typeof AuthRecordV2ExistingDocumentSchema
>;

export type RefreshRecordV2Fields = z.infer<typeof RefreshRecordV2FieldsSchema>;
export type EmailCodeV2Fields = z.infer<typeof EmailCodeV2FieldsSchema>;
export type AuthRecordV2Fields = z.infer<typeof AuthRecordV2FieldsSchema>;

// refresh token
export const RefreshRecordV2DocumentSchema = CouchDocumentSchema.extend(
  RefreshRecordV2FieldsSchema.shape
);
export type RefreshRecordV2Document = z.infer<
  typeof RefreshRecordV2DocumentSchema
>;

export const RefreshRecordV2ExistingDocumentSchema =
  CouchExistingDocumentSchema.extend(RefreshRecordV2FieldsSchema.shape);
export type RefreshRecordV2ExistingDocument = z.infer<
  typeof RefreshRecordV2ExistingDocumentSchema
>;

// email code
export const EmailCodeV2DocumentSchema = CouchDocumentSchema.extend(
  EmailCodeV2FieldsSchema.shape
);
export type EmailCodeV2Document = z.infer<typeof EmailCodeV2DocumentSchema>;

export const EmailCodeV2ExistingDocumentSchema =
  CouchExistingDocumentSchema.extend(EmailCodeV2FieldsSchema.shape);
export type EmailCodeV2ExistingDocument = z.infer<
  typeof EmailCodeV2ExistingDocumentSchema
>;

// CURRENT EXPORTS
// ===============

// Fields
export const AuthRecordFieldsSchema = AuthRecordV2FieldsSchema;
export type AuthRecordFields = AuthRecordV2Fields;

// possibly existing document schemas
export const AuthRecordDocumentSchema = AuthRecordV2DocumentSchema;
export type AuthRecordDocument = AuthRecordV2Document;

// existing document schemas
export const AuthRecordExistingDocumentSchema =
  AuthRecordV2ExistingDocumentSchema;
export type AuthRecordExistingDocument = AuthRecordV2ExistingDocument;

// Helper types for specific record documents
export type RefreshRecordFields = RefreshRecordV2Fields;
export type EmailCodeFields = EmailCodeV2Fields;

// refresh token
export const RefreshRecordDocumentSchema = RefreshRecordV2DocumentSchema;
export type RefreshRecordDocument = RefreshRecordV2Document;
export const RefreshRecordExistingDocumentSchema =
  RefreshRecordV2ExistingDocumentSchema;
export type RefreshRecordExistingDocument = RefreshRecordV2ExistingDocument;

// email code
export const EmailCodeDocumentSchema = EmailCodeV2DocumentSchema;
export type EmailCodeDocument = EmailCodeV2Document;
export const EmailCodeExistingDocumentSchema =
  EmailCodeV2ExistingDocumentSchema;
export type EmailCodeExistingDocument = EmailCodeV2ExistingDocument;

// ID prefix map
export const AUTH_RECORD_ID_PREFIXES = {
  refresh: 'refresh_',
  emailcode: 'emailcode_',
} as const;

// Database
export type GetRefreshTokenIndex = 'id' | 'token';
export type GetEmailCodeIndex = 'id' | 'code';
export type AuthDatabase = PouchDB.Database<AuthRecordFields>;
