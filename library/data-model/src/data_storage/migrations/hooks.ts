import {GetDbById, MigrationContext} from './types';

/**
 * Couch database name prefix for per-project notebook JSON before projects DB v4
 * inlined it into the project document `uiSpecification` field.
 */
export const LEGACY_INLINE_NOTEBOOK_DB_PREFIX = 'metadata-';

/** Default `createdBy` on migrated project/template docs (people DB admin username). */
export const DEFAULT_MIGRATION_CREATED_BY = 'admin';

export function buildMigrationContext({
  getDbById,
  migrationCreatedBy = DEFAULT_MIGRATION_CREATED_BY,
  db,
  dbName,
}: {
  getDbById: GetDbById;
  migrationCreatedBy?: string;
  db?: MigrationContext['db'];
  dbName?: string;
}): MigrationContext {
  return {getDbById, migrationCreatedBy, db, dbName};
}

export function resolveMigrationCreatedBy(context?: MigrationContext): string {
  return context?.migrationCreatedBy ?? DEFAULT_MIGRATION_CREATED_BY;
}
