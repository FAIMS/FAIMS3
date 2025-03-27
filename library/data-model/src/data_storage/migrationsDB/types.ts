import {DatabaseType} from '../migrations/migrationService';

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
export type MigrationsDB = PouchDB.Database<MigrationsDBFields>;
