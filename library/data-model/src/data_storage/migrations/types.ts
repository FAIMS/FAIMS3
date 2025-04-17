// Check if we are testing
export const IS_TESTING = process.env.NODE_ENV === 'test';

export enum DatabaseType {
  AUTH = 'AUTH',
  DATA = 'DATA',
  DIRECTORY = 'DIRECTORY',
  INVITES = 'INVITES',
  METADATA = 'METADATA',
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
  DatabaseType.METADATA,
  DatabaseType.PEOPLE,
  DatabaseType.PROJECTS,
  DatabaseType.TEMPLATES,
  DatabaseType.TEAMS,
] as const;
export type DATABASE_TYPE = (typeof DATABASE_TYPES)[number];

export type DBTargetVersions = {
  [key in DatabaseType]: {defaultVersion: number; targetVersion: number};
};

export type MigrationFuncReturn = {
  action: 'none' | 'update' | 'delete';
  updatedRecord?: PouchDB.Core.ExistingDocument<any>;
};
export type MigrationFuncRecordInput = PouchDB.Core.ExistingDocument<any>;

export type MigrationFunc = (
  record: MigrationFuncRecordInput
) => MigrationFuncReturn;

export type MigrationDetails = {
  dbType: DATABASE_TYPE;
  from: number;
  description: string;
  to: number;
  migrationFunction: MigrationFunc;
};
