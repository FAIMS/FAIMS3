import {DatabaseInterface} from '../../types';
import {DATABASE_TYPE} from './types';

export type GetDbByIdParams = {
  dbType: DATABASE_TYPE;
  /** Project ID for per-project DBs; ignored for singleton global databases */
  id: string;
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

export function resolveMigrationCreatedBy(
  context?: MigrationContext
): string {
  return context?.migrationCreatedBy ?? DEFAULT_MIGRATION_CREATED_BY;
}
