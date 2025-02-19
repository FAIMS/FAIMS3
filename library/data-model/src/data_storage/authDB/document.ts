/** Provides types for the Auth database */
export type AuthRecordTypes = 'refresh' | 'emailcode';

// These indicate the available indexes to fetch things
export type GetRefreshTokenIndex = 'id' | 'token';

// You can fetch email codes by index or code
export type GetEmailCodeIndex = 'id' | 'code';

// Refresh token fields
export interface RefreshRecordFields {
  // Mandatory field for auth records
  documentType: 'refresh';

  // Which user ID has this refresh token
  userId: string;

  // What is the token?
  token: string;

  // When does it expire? unix timestamp in ms
  expiryTimestampMs: number;

  // Is this token valid
  enabled: boolean;
}

// Refresh token fields
export interface EmailCodeFields {
  // Mandatory field for auth records
  documentType: 'emailcode';

  // Which user ID generated this code?
  userId: string;

  // What is the code
  code: string;

  // When does it expire? unix timestamp in ms
  expiryTimestampMs: number;

  // Is this reset token valid
  enabled: boolean;
}

// ID prefix map
export const AuthRecordIdPrefixMap = new Map<AuthRecordTypes, string>([
  // Refresh records start with prefix
  ['refresh', 'refresh_'],
  ['emailcode', 'emailcode_'],
]);

// NOTE: if we have multiple record types, we could update below to use a union
// of different fields and update the prefix map
export type AuthRecordFields = RefreshRecordFields;

// Type of instantiated auth record in the database
export type AuthRecord = PouchDB.Core.Document<AuthRecordFields> &
  PouchDB.Core.RevisionIdMeta;
export type AuthDatabase = PouchDB.Database<AuthRecordFields>;
