import {DatabaseInterface} from '../../types';

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

export type MigrationContext = {
  getDbById: GetDbById;
  /**
   * Username stored as `createdBy` on migrated audit fields when legacy data has
   * no creator. Defaults to {@link DEFAULT_MIGRATION_CREATED_BY}.
   */
  migrationCreatedBy?: string;
};

// Check if we are testing
export const IS_TESTING = process.env.NODE_ENV === 'test';

export enum DatabaseType {
  AUTH = 'AUTH',
  DATA = 'DATA',
  DIRECTORY = 'DIRECTORY',
  INVITES = 'INVITES',
  PEOPLE = 'PEOPLE',
  PROJECTS = 'PROJECTS',
  TEMPLATES = 'TEMPLATES',
  TEAMS = 'TEAMS',
}

export const DATABASE_TYPES = [
  DatabaseType.AUTH,
  DatabaseType.DATA,
  DatabaseType.DIRECTORY,
  DatabaseType.INVITES,
  DatabaseType.PEOPLE,
  DatabaseType.PROJECTS,
  DatabaseType.TEMPLATES,
  DatabaseType.TEAMS,
] as const;
export type DATABASE_TYPE = (typeof DATABASE_TYPES)[number];

export type DBTargetVersions = {
  [key in DatabaseType]: {defaultVersion: number; targetVersion: number};
};

// update function requires an updated record
type MigrationUpdateFuncReturn = {
  action: 'update';
  updatedRecord: PouchDB.Core.ExistingDocument<any>;
};

type MigrationOtherFuncReturn = {
  action: 'delete' | 'none';
};

export type MigrationFuncReturn =
  | MigrationOtherFuncReturn
  | MigrationUpdateFuncReturn;

export type MigrationFuncRecordInput = PouchDB.Core.ExistingDocument<any>;

export type MigrationFunc = (
  record: MigrationFuncRecordInput,
  context?: MigrationContext
) => MigrationFuncReturn | Promise<MigrationFuncReturn>;

export type MigrationDetails = {
  dbType: DATABASE_TYPE;
  from: number;
  description: string;
  to: number;
  migrationFunction: MigrationFunc;
};
