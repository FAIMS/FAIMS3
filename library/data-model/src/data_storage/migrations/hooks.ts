import {DatabaseInterface} from '../../types';
import {DATABASE_TYPE} from './types';

export type GetDbByIdParams = {
  dbType: DATABASE_TYPE;
  /** Project ID for per-project DBs; ignored for singleton global databases */
  id: string;
};

export type GetDbById = (params: GetDbByIdParams) => Promise<DatabaseInterface>;

export type MigrationContext = {
  getDbById: GetDbById;
};
