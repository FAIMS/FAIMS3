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
    CouchExistingDocumentSchema.extend(
      VerificationChallengeV3FieldsSchema.shape
    ),
  ]
);
export type AuthRecordV3ExistingDocument = z.infer<
  typeof AuthRecordV3ExistingDocumentSchema
>;

export type RefreshRecordV3Fields = z.infer<typeof RefreshRecordV3FieldsSchema>;
export type EmailCodeV3Fields = z.infer<typeof EmailCodeV3FieldsSchema>;
export type VerificationChallengeV3Fields = z.infer<
  typeof VerificationChallengeV3FieldsSchema
>;
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

// =============
// V4 Definition
// =============

// V4 - Refresh token schema remains the same as V2
export const RefreshRecordV4FieldsSchema = RefreshRecordV3FieldsSchema;

// V4 - Email code schema extends V3 with creation
export const EmailCodeV4FieldsSchema = EmailCodeV3FieldsSchema.extend({
  // When was it created? unix timestamp in ms
  createdTimestampMs: z.number(),
});

// V4 - no change
export const VerificationChallengeV4FieldsSchema =
  VerificationChallengeV3FieldsSchema;

export const AuthRecordV4FieldsSchema = z.discriminatedUnion('documentType', [
  RefreshRecordV4FieldsSchema,
  EmailCodeV4FieldsSchema,
  VerificationChallengeV4FieldsSchema,
]);

export const AuthRecordV4DocumentSchema = z.discriminatedUnion('documentType', [
  CouchDocumentSchema.extend(RefreshRecordV4FieldsSchema.shape),
  CouchDocumentSchema.extend(EmailCodeV4FieldsSchema.shape),
  CouchDocumentSchema.extend(VerificationChallengeV4FieldsSchema.shape),
]);
export type AuthRecordV4Document = z.infer<typeof AuthRecordV4DocumentSchema>;

export const AuthRecordV4ExistingDocumentSchema = z.discriminatedUnion(
  'documentType',
  [
    CouchExistingDocumentSchema.extend(RefreshRecordV4FieldsSchema.shape),
    CouchExistingDocumentSchema.extend(EmailCodeV4FieldsSchema.shape),
    CouchExistingDocumentSchema.extend(
      VerificationChallengeV4FieldsSchema.shape
    ),
  ]
);
export type AuthRecordV4ExistingDocument = z.infer<
  typeof AuthRecordV4ExistingDocumentSchema
>;

export type RefreshRecordV4Fields = z.infer<typeof RefreshRecordV4FieldsSchema>;
export type EmailCodeV4Fields = z.infer<typeof EmailCodeV4FieldsSchema>;
export type VerificationChallengeV4Fields = z.infer<
  typeof VerificationChallengeV4FieldsSchema
>;
export type AuthRecordV4Fields = z.infer<typeof AuthRecordV4FieldsSchema>;

// refresh token
export const RefreshRecordV4DocumentSchema = CouchDocumentSchema.extend(
  RefreshRecordV4FieldsSchema.shape
);
export type RefreshRecordV4Document = z.infer<
  typeof RefreshRecordV4DocumentSchema
>;

export const RefreshRecordV4ExistingDocumentSchema =
  CouchExistingDocumentSchema.extend(RefreshRecordV4FieldsSchema.shape);
export type RefreshRecordV4ExistingDocument = z.infer<
  typeof RefreshRecordV4ExistingDocumentSchema
>;

// email code
export const EmailCodeV4DocumentSchema = CouchDocumentSchema.extend(
  EmailCodeV4FieldsSchema.shape
);
export type EmailCodeV4Document = z.infer<typeof EmailCodeV4DocumentSchema>;

export const EmailCodeV4ExistingDocumentSchema =
  CouchExistingDocumentSchema.extend(EmailCodeV4FieldsSchema.shape);
export type EmailCodeV4ExistingDocument = z.infer<
  typeof EmailCodeV4ExistingDocumentSchema
>;

// verification challenge
export const VerificationChallengeV4DocumentSchema = CouchDocumentSchema.extend(
  VerificationChallengeV4FieldsSchema.shape
);
export type VerificationChallengeV4Document = z.infer<
  typeof VerificationChallengeV4DocumentSchema
>;

export const VerificationChallengeV4ExistingDocumentSchema =
  CouchExistingDocumentSchema.extend(VerificationChallengeV4FieldsSchema.shape);
export type VerificationChallengeV4ExistingDocument = z.infer<
  typeof VerificationChallengeV4ExistingDocumentSchema
>;

// =============
// V5 Definition
// =============

// V5 - Refresh token schema remains the same as V4
export const RefreshRecordV5FieldsSchema = RefreshRecordV4FieldsSchema;

// V5 - Email code schema remains the same as V4
export const EmailCodeV5FieldsSchema = EmailCodeV4FieldsSchema;

// V5 - Verification challenge schema remains the same as V4
export const VerificationChallengeV5FieldsSchema =
  VerificationChallengeV4FieldsSchema;

// V5 - New Long Lived Token schema
export const LongLivedTokenV5FieldsSchema = z.object({
  // When was it created? unix timestamp in ms
  createdTimestampMs: z.number(),
  // When was it last updated? unix timestamp in ms
  updatedTimestampMs: z.number(),
  // When was it last used? unix timestamp in ms
  lastUsedTimestampMs: z.number().optional(),
  // When does it expire? unix timestamp in ms (undefined means no expiry!)
  expiryTimestampMs: z.number().optional(),
  // Discriminator field
  documentType: z.literal('longlived'),
  // Which user ID owns this token
  userId: z.string(),
  // Hash of the actual token (this is used to look up the token without storing
  // it in plain text)
  tokenHash: z.string(),
  // Human readable title for the token
  title: z.string(),
  // Description of what this token is used for
  description: z.string(),
  // Is this token enabled/active
  enabled: z.boolean(),
});

export const AuthRecordV5FieldsSchema = z.discriminatedUnion('documentType', [
  RefreshRecordV5FieldsSchema,
  EmailCodeV5FieldsSchema,
  VerificationChallengeV5FieldsSchema,
  LongLivedTokenV5FieldsSchema,
]);

export const AuthRecordV5DocumentSchema = z.discriminatedUnion('documentType', [
  CouchDocumentSchema.extend(RefreshRecordV5FieldsSchema.shape),
  CouchDocumentSchema.extend(EmailCodeV5FieldsSchema.shape),
  CouchDocumentSchema.extend(VerificationChallengeV5FieldsSchema.shape),
  CouchDocumentSchema.extend(LongLivedTokenV5FieldsSchema.shape),
]);
export type AuthRecordV5Document = z.infer<typeof AuthRecordV5DocumentSchema>;

export const AuthRecordV5ExistingDocumentSchema = z.discriminatedUnion(
  'documentType',
  [
    CouchExistingDocumentSchema.extend(RefreshRecordV5FieldsSchema.shape),
    CouchExistingDocumentSchema.extend(EmailCodeV5FieldsSchema.shape),
    CouchExistingDocumentSchema.extend(
      VerificationChallengeV5FieldsSchema.shape
    ),
    CouchExistingDocumentSchema.extend(LongLivedTokenV5FieldsSchema.shape),
  ]
);
export type AuthRecordV5ExistingDocument = z.infer<
  typeof AuthRecordV5ExistingDocumentSchema
>;

export type RefreshRecordV5Fields = z.infer<typeof RefreshRecordV5FieldsSchema>;
export type EmailCodeV5Fields = z.infer<typeof EmailCodeV5FieldsSchema>;
export type VerificationChallengeV5Fields = z.infer<
  typeof VerificationChallengeV5FieldsSchema
>;
export type LongLivedTokenV5Fields = z.infer<
  typeof LongLivedTokenV5FieldsSchema
>;
export type AuthRecordV5Fields = z.infer<typeof AuthRecordV5FieldsSchema>;

// refresh token
export const RefreshRecordV5DocumentSchema = CouchDocumentSchema.extend(
  RefreshRecordV5FieldsSchema.shape
);
export type RefreshRecordV5Document = z.infer<
  typeof RefreshRecordV5DocumentSchema
>;

export const RefreshRecordV5ExistingDocumentSchema =
  CouchExistingDocumentSchema.extend(RefreshRecordV5FieldsSchema.shape);
export type RefreshRecordV5ExistingDocument = z.infer<
  typeof RefreshRecordV5ExistingDocumentSchema
>;

// email code
export const EmailCodeV5DocumentSchema = CouchDocumentSchema.extend(
  EmailCodeV5FieldsSchema.shape
);
export type EmailCodeV5Document = z.infer<typeof EmailCodeV5DocumentSchema>;

export const EmailCodeV5ExistingDocumentSchema =
  CouchExistingDocumentSchema.extend(EmailCodeV5FieldsSchema.shape);
export type EmailCodeV5ExistingDocument = z.infer<
  typeof EmailCodeV5ExistingDocumentSchema
>;

// verification challenge
export const VerificationChallengeV5DocumentSchema = CouchDocumentSchema.extend(
  VerificationChallengeV5FieldsSchema.shape
);
export type VerificationChallengeV5Document = z.infer<
  typeof VerificationChallengeV5DocumentSchema
>;

export const VerificationChallengeV5ExistingDocumentSchema =
  CouchExistingDocumentSchema.extend(VerificationChallengeV5FieldsSchema.shape);
export type VerificationChallengeV5ExistingDocument = z.infer<
  typeof VerificationChallengeV5ExistingDocumentSchema
>;

// long lived token
export const LongLivedTokenV5DocumentSchema = CouchDocumentSchema.extend(
  LongLivedTokenV5FieldsSchema.shape
);
export type LongLivedTokenV5Document = z.infer<
  typeof LongLivedTokenV5DocumentSchema
>;

export const LongLivedTokenV5ExistingDocumentSchema =
  CouchExistingDocumentSchema.extend(LongLivedTokenV5FieldsSchema.shape);
export type LongLivedTokenV5ExistingDocument = z.infer<
  typeof LongLivedTokenV5ExistingDocumentSchema
>;

// CURRENT EXPORTS
// ===============

// Fields
export const AuthRecordFieldsSchema = AuthRecordV5FieldsSchema;
export type AuthRecordFields = AuthRecordV5Fields;

// possibly existing document schemas
export const AuthRecordDocumentSchema = AuthRecordV5DocumentSchema;
export type AuthRecordDocument = AuthRecordV5Document;

// existing document schemas
export const AuthRecordExistingDocumentSchema =
  AuthRecordV5ExistingDocumentSchema;
export type AuthRecordExistingDocument = AuthRecordV5ExistingDocument;

// Helper types for specific record documents
export type RefreshRecordFields = RefreshRecordV5Fields;
export type EmailCodeFields = EmailCodeV5Fields;
export type VerificationChallengeFields = VerificationChallengeV5Fields;
export type LongLivedTokenFields = LongLivedTokenV5Fields;

// refresh token
export const RefreshRecordDocumentSchema = RefreshRecordV5DocumentSchema;
export type RefreshRecordDocument = RefreshRecordV5Document;
export const RefreshRecordExistingDocumentSchema =
  RefreshRecordV5ExistingDocumentSchema;
export type RefreshRecordExistingDocument = RefreshRecordV5ExistingDocument;

// email code
export const EmailCodeDocumentSchema = EmailCodeV5DocumentSchema;
export type EmailCodeDocument = EmailCodeV5Document;
export const EmailCodeExistingDocumentSchema =
  EmailCodeV5ExistingDocumentSchema;
export type EmailCodeExistingDocument = EmailCodeV5ExistingDocument;

// verification challenge
export const VerificationChallengeDocumentSchema =
  VerificationChallengeV5DocumentSchema;
export type VerificationChallengeDocument = VerificationChallengeV5Document;
export const VerificationChallengeExistingDocumentSchema =
  VerificationChallengeV5ExistingDocumentSchema;
export type VerificationChallengeExistingDocument =
  VerificationChallengeV5ExistingDocument;

// long lived token
export const LongLivedTokenDocumentSchema = LongLivedTokenV5DocumentSchema;
export type LongLivedTokenDocument = LongLivedTokenV5Document;
export const LongLivedTokenExistingDocumentSchema =
  LongLivedTokenV5ExistingDocumentSchema;
export type LongLivedTokenExistingDocument = LongLivedTokenV5ExistingDocument;

// ID prefix map
export const AUTH_RECORD_ID_PREFIXES = {
  refresh: 'refresh_',
  emailcode: 'emailcode_',
  verification: 'verification_',
  longlived: 'longlived_',
} as const;

// Database
export type GetRefreshTokenIndex = 'id' | 'token';
export type GetEmailCodeIndex = 'id' | 'code';
export type GetVerificationChallengeIndex = 'id' | 'code';
export type GetLongLivedTokenIndex = 'id' | 'tokenHash';
export type AuthDatabase = PouchDB.Database<AuthRecordFields>;
