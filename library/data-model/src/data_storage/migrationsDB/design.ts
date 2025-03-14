// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {convertToCouchDBString} from '../utils';

// Index constants
export const INDEX_DOCUMENT_NAME = 'index';
export const MIGRATIONS_BY_DB_TYPE_INDEX = INDEX_DOCUMENT_NAME + '/by_dbType';
export const MIGRATIONS_BY_DB_NAME_INDEX = INDEX_DOCUMENT_NAME + '/by_dbName';
export const MIGRATIONS_BY_DB_TYPE_AND_NAME_INDEX =
  INDEX_DOCUMENT_NAME + '/by_dbType_and_dbName';
export const MIGRATIONS_BY_STATUS_INDEX = INDEX_DOCUMENT_NAME + '/by_status';

/**
 * Design document for indexing by key fields
 */
const indexDocument = {
  _id: '_design/' + INDEX_DOCUMENT_NAME,
  views: {
    [MIGRATIONS_BY_DB_TYPE_INDEX.split('/')[1]]: {
      map: convertToCouchDBString(doc => {
        if (doc.dbType !== undefined) {
          emit(doc.dbType, 1);
        }
      }),
    },
    [MIGRATIONS_BY_DB_NAME_INDEX.split('/')[1]]: {
      map: convertToCouchDBString(doc => {
        if (doc.dbName !== undefined) {
          emit(doc.dbName, 1);
        }
      }),
    },
    [MIGRATIONS_BY_DB_TYPE_AND_NAME_INDEX.split('/')[1]]: {
      map: convertToCouchDBString(doc => {
        if (doc.dbType !== undefined && doc.dbName !== undefined) {
          emit([doc.dbType, doc.dbName], 1);
        }
      }),
    },
    [MIGRATIONS_BY_STATUS_INDEX.split('/')[1]]: {
      map: convertToCouchDBString(doc => {
        if (doc.status !== undefined) {
          emit(doc.status, 1);
        }
      }),
    },
  },
};

/**
 * Exports all design documents for the migrations database
 */
export const migrationDbDesignDocuments = {
  indexDocument,
};
