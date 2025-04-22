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
  // When does the exchange token expire?
  exchangeTokenExpiryTimestampMs: z.number(),
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

// =============
// V3 Definition
// =============

// V3 - Refresh token schema remains the same as V2
export const RefreshRecordV3FieldsSchema = RefreshRecordV2FieldsSchema;

// V3 - Email code schema remains the same as V2
export const EmailCodeV3FieldsSchema = EmailCodeV2FieldsSchema;

// V3 - New Verification Challenge schema
export const VerificationChallengeV3FieldsSchema = z.object({
  // When was it created? unix timestamp in ms
  createdTimestampMs: z.number(),
  // When does it expire? unix timestamp in ms
  expiryTimestampMs: z.number(),
  // Discriminator field
  documentType: z.literal('verification'),
  // Which user ID generated this verification challenge?
  userId: z.string(),
  // Target email for verification
  email: z.string(),
  // Hashed verification code
  code: z.string(),
  // Has it been used?
  used: z.boolean(),
});

export const AuthRecordV3FieldsSchema = z.discriminatedUnion('documentType', [
  RefreshRecordV3FieldsSchema,
  EmailCodeV3FieldsSchema,
  VerificationChallengeV3FieldsSchema,
]);

export const AuthRecordV3DocumentSchema = z.discriminatedUnion('documentType', [
  CouchDocumentSchema.extend(RefreshRecordV3FieldsSchema.shape),
  CouchDocumentSchema.extend(EmailCodeV3FieldsSchema.shape),
  CouchDocumentSchema.extend(VerificationChallengeV3FieldsSchema.shape),
]);
export type AuthRecordV3Document = z.infer<typeof AuthRecordV3DocumentSchema>;

export const AuthRecordV3ExistingDocumentSchema = z.discriminatedUnion(
  'documentType',
  [
    CouchExistingDocumentSchema.extend(RefreshRecordV3FieldsSchema.shape),
    CouchExistingDocumentSchema.extend(EmailCodeV3FieldsSchema.shape),
    CouchExistingDocumentSchema.extend(VerificationChallengeV3FieldsSchema.shape),
  ]
);
export type AuthRecordV3ExistingDocument = z.infer<
  typeof AuthRecordV3ExistingDocumentSchema
>;

export type RefreshRecordV3Fields = z.infer<typeof RefreshRecordV3FieldsSchema>;
export type EmailCodeV3Fields = z.infer<typeof EmailCodeV3FieldsSchema>;
export type VerificationChallengeV3Fields = z.infer<typeof VerificationChallengeV3FieldsSchema>;
export type AuthRecordV3Fields = z.infer<typeof AuthRecordV3FieldsSchema>;

// refresh token
export const RefreshRecordV3DocumentSchema = CouchDocumentSchema.extend(
  RefreshRecordV3FieldsSchema.shape
);
export type RefreshRecordV3Document = z.infer<
  typeof RefreshRecordV3DocumentSchema
>;

export const RefreshRecordV3ExistingDocumentSchema =
  CouchExistingDocumentSchema.extend(RefreshRecordV3FieldsSchema.shape);
export type RefreshRecordV3ExistingDocument = z.infer<
  typeof RefreshRecordV3ExistingDocumentSchema
>;

// email code
export const EmailCodeV3DocumentSchema = CouchDocumentSchema.extend(
  EmailCodeV3FieldsSchema.shape
);
export type EmailCodeV3Document = z.infer<typeof EmailCodeV3DocumentSchema>;

export const EmailCodeV3ExistingDocumentSchema =
  CouchExistingDocumentSchema.extend(EmailCodeV3FieldsSchema.shape);
export type EmailCodeV3ExistingDocument = z.infer<
  typeof EmailCodeV3ExistingDocumentSchema
>;

// verification challenge
export const VerificationChallengeV3DocumentSchema = CouchDocumentSchema.extend(
  VerificationChallengeV3FieldsSchema.shape
);
export type VerificationChallengeV3Document = z.infer<
  typeof VerificationChallengeV3DocumentSchema
>;

export const VerificationChallengeV3ExistingDocumentSchema =
  CouchExistingDocumentSchema.extend(VerificationChallengeV3FieldsSchema.shape);
export type VerificationChallengeV3ExistingDocument = z.infer<
  typeof VerificationChallengeV3ExistingDocumentSchema
>;

// CURRENT EXPORTS
// ===============

// Fields
export const AuthRecordFieldsSchema = AuthRecordV3FieldsSchema;
export type AuthRecordFields = AuthRecordV3Fields;

// possibly existing document schemas
export const AuthRecordDocumentSchema = AuthRecordV3DocumentSchema;
export type AuthRecordDocument = AuthRecordV3Document;

// existing document schemas
export const AuthRecordExistingDocumentSchema =
  AuthRecordV3ExistingDocumentSchema;
export type AuthRecordExistingDocument = AuthRecordV3ExistingDocument;

// Helper types for specific record documents
export type RefreshRecordFields = RefreshRecordV3Fields;
export type EmailCodeFields = EmailCodeV3Fields;
export type VerificationChallengeFields = VerificationChallengeV3Fields;

// refresh token
export const RefreshRecordDocumentSchema = RefreshRecordV3DocumentSchema;
export type RefreshRecordDocument = RefreshRecordV3Document;
export const RefreshRecordExistingDocumentSchema =
  RefreshRecordV3ExistingDocumentSchema;
export type RefreshRecordExistingDocument = RefreshRecordV3ExistingDocument;

// email code
export const EmailCodeDocumentSchema = EmailCodeV3DocumentSchema;
export type EmailCodeDocument = EmailCodeV3Document;
export const EmailCodeExistingDocumentSchema =
  EmailCodeV3ExistingDocumentSchema;
export type EmailCodeExistingDocument = EmailCodeV3ExistingDocument;

// verification challenge
export const VerificationChallengeDocumentSchema = VerificationChallengeV3DocumentSchema;
export type VerificationChallengeDocument = VerificationChallengeV3Document;
export const VerificationChallengeExistingDocumentSchema =
  VerificationChallengeV3ExistingDocumentSchema;
export type VerificationChallengeExistingDocument = VerificationChallengeV3ExistingDocument;

// ID prefix map
export const AUTH_RECORD_ID_PREFIXES = {
  refresh: 'refresh_',
  emailcode: 'emailcode_',
  verification: 'verification_',
} as const;

// Database
export type GetRefreshTokenIndex = 'id' | 'token';
export type GetEmailCodeIndex = 'id' | 'code';
export type GetVerificationChallengeIndex = 'id' | 'code';
export type AuthDatabase = PouchDB.Database<AuthRecordFields>;