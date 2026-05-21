import {DatabaseInterface} from '../../types';
import {DATABASE_TYPE} from './types';

/**
 * Couch database name prefix for per-project notebook JSON before projects DB v4
 * inlined it into the project document `uiSpecification` field.
 */
export const LEGACY_INLINE_NOTEBOOK_DB_PREFIX = 'metadata-';

/**
 * Open a database for migrations.
 *
 * - With {@link dbType}: {@link id} is interpreted per kind (e.g. project id for DATA).
 * - Without {@link dbType}: {@link id} is the Couch database name to open directly.
 */
export type GetDbByIdParams = {
  id: string;
  dbType?: DATABASE_TYPE;
};

export type GetDbById = (params: GetDbByIdParams) => Promise<DatabaseInterface>;

/** Default `createdBy` on migrated project/template docs (people DB admin username). */
export const DEFAULT_MIGRATION_CREATED_BY = 'admin';

export type MigrationContext = {
  getDbById: GetDbById;
  /**
   * Username stored as `createdBy` on migrated audit fields when legacy data has
   * no creator. Defaults to {@link DEFAULT_MIGRATION_CREATED_BY}.
   */
  migrationCreatedBy?: string;
};

export function buildMigrationContext({
  getDbById,
  migrationCreatedBy = DEFAULT_MIGRATION_CREATED_BY,
}: {
  getDbById: GetDbById;
  migrationCreatedBy?: string;
}): MigrationContext {
  return {getDbById, migrationCreatedBy};
}

export function resolveMigrationCreatedBy(context?: MigrationContext): string {
  return context?.migrationCreatedBy ?? DEFAULT_MIGRATION_CREATED_BY;
}
