/** Provides types for the Auth database */
export type AuthRecordTypes = 'refresh';

// Document type
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

// ID prefix map
export const AuthRecordIdPrefixMap = new Map<AuthRecordTypes, string>([
  // Refresh records start with prefix
  ['refresh', 'refresh_'],
]);

// NOTE: if we have multiple record types, we could update below to use a union
// of different fields and update the prefix map
export type AuthRecordFields = RefreshRecordFields;

// Type of instantiated auth record in the database
export type AuthRecord = PouchDB.Core.Document<RefreshRecordFields>;
export type AuthDatabase = PouchDB.Database<AuthRecordFields>;
