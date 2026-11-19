// SPDX-License-Identifier: Apache-2.0
import {DatabaseInterface} from '../../types';
import {DatabaseType} from '../migrations/types';

/** `kind` written on new per-database version records. Existing records omit it. */
export const MIGRATION_VERSION_RECORD_KIND = 'db-version';

export type MigrationLog = {
  // from and to version ID
  from: number;
  to: number;
  // Any notes about this migration?
  notes?: string;
  // MS timestamp started at
  startedAtTimestampMs: number;
  // MS timestamp completed at
  completedAtTimestampMs: number;
  // User ID of the token who launched this
  launchedBy: string;
  // Status and issues
  status: 'success' | 'failure';
  issues?: string[];
  // Detailed information about documents that had issues during migration
  documentsWithIssues?: {
    id: string;
    error: any;
    document: any;
  }[];
  // Complete error details for migration-level errors
  errorDetails?: {
    message: string;
    stack?: string;
    name?: string;
    code?: string;
    [key: string]: any;
  };
};

export type MigrationsDBFields = {
  /**
   * Distinguishes version records from other migrations-DB documents (lock,
   * notebook marker, db-setup). Omitted on records written before this field
   * existed; {@link isMigrationVersionRecord} still accepts those.
   */
  kind?: typeof MIGRATION_VERSION_RECORD_KIND;
  // Which type of database is this referring to
  dbType: DatabaseType;
  // The fully qualified db name (i.e. uniquely specifies the actual database
  // within this couch instance)
  dbName: string;
  // What version is this database at - that we know of?
  version: number;
  // Do we suspect that the DB is healthy?
  status: 'healthy' | 'not-healthy';
  // History of migrations
  migrationLog: MigrationLog[];
};
export type MigrationsDBDocument =
  PouchDB.Core.ExistingDocument<MigrationsDBFields>;
export type MigrationsDB = DatabaseInterface<MigrationsDBFields>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * True for a per-database Couch schema version record.
 *
 * New records set {@link MIGRATION_VERSION_RECORD_KIND}. Older records have
 * no `kind`. Any other `kind` (lock, notebook marker, db-setup) is excluded
 * even if it happens to reuse `dbType` / `dbName`. The migrations-DB views
 * duplicate this check inline (map functions cannot import); keep them in
 * sync and cover both in the parity test.
 */
export function isMigrationVersionRecord(
  doc: unknown
): doc is MigrationsDBDocument {
  if (!isRecord(doc)) {
    return false;
  }
  const kind = doc.kind;
  if (kind !== undefined && kind !== MIGRATION_VERSION_RECORD_KIND) {
    return false;
  }
  return (
    typeof doc.dbType === 'string' &&
    typeof doc.dbName === 'string' &&
    typeof doc.version === 'number' &&
    Array.isArray(doc.migrationLog)
  );
}
