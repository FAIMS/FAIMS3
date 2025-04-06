// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {convertToCouchDBString} from '../utils';

// Index constants
const INDEX_DOCUMENT_NAME = 'index';
const MIGRATIONS_BY_DB_TYPE_INDEX_POSTFIX = 'by_dbType';
const MIGRATIONS_BY_DB_NAME_INDEX_POSTFIX = 'by_dbName';
const MIGRATIONS_BY_DB_TYPE_AND_NAME_INDEX_POSTFIX = 'by_dbType_and_dbName';
const MIGRATIONS_BY_STATUS_INDEX_POSTFIX = 'by_status';

export const MIGRATIONS_BY_DB_TYPE_INDEX = `${INDEX_DOCUMENT_NAME}/${MIGRATIONS_BY_DB_TYPE_INDEX_POSTFIX}`;
export const MIGRATIONS_BY_DB_NAME_INDEX = `${INDEX_DOCUMENT_NAME}/${MIGRATIONS_BY_DB_NAME_INDEX_POSTFIX}`;
export const MIGRATIONS_BY_DB_TYPE_AND_NAME_INDEX = `${INDEX_DOCUMENT_NAME}/${MIGRATIONS_BY_DB_TYPE_AND_NAME_INDEX_POSTFIX}`;
export const MIGRATIONS_BY_STATUS_INDEX = `${INDEX_DOCUMENT_NAME}/${MIGRATIONS_BY_STATUS_INDEX_POSTFIX}`;

/**
 * Design document for indexing by key fields
 */
const indexDocument = {
  _id: `_design/${INDEX_DOCUMENT_NAME}`,
  views: {
    [MIGRATIONS_BY_DB_TYPE_INDEX_POSTFIX]: {
      map: convertToCouchDBString(doc => {
        if (doc.dbType !== undefined) {
          emit(doc.dbType, 1);
        }
      }),
    },
    [MIGRATIONS_BY_DB_NAME_INDEX_POSTFIX]: {
      map: convertToCouchDBString(doc => {
        if (doc.dbName !== undefined) {
          emit(doc.dbName, 1);
        }
      }),
    },
    [MIGRATIONS_BY_DB_TYPE_AND_NAME_INDEX_POSTFIX]: {
      map: convertToCouchDBString(doc => {
        if (doc.dbType !== undefined && doc.dbName !== undefined) {
          emit([doc.dbType, doc.dbName], 1);
        }
      }),
    },
    [MIGRATIONS_BY_STATUS_INDEX_POSTFIX]: {
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
