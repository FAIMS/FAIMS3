// SPDX-License-Identifier: Apache-2.0
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
    // Each map duplicates isMigrationVersionRecord: Couch map functions
    // cannot import. Emit only per-database version records (kind missing
    // or 'db-version', with dbType/dbName/version/migrationLog). Other
    // migrations-DB documents (lock, notebook marker, db-setup) are skipped
    // even when they reuse those field names.
    [MIGRATIONS_BY_DB_TYPE_INDEX_POSTFIX]: {
      map: convertToCouchDBString(doc => {
        if (
          (doc.kind === undefined || doc.kind === 'db-version') &&
          typeof doc.dbType === 'string' &&
          typeof doc.dbName === 'string' &&
          typeof doc.version === 'number' &&
          Array.isArray(doc.migrationLog)
        ) {
          emit(doc.dbType, 1);
        }
      }),
    },
    [MIGRATIONS_BY_DB_NAME_INDEX_POSTFIX]: {
      map: convertToCouchDBString(doc => {
        if (
          (doc.kind === undefined || doc.kind === 'db-version') &&
          typeof doc.dbType === 'string' &&
          typeof doc.dbName === 'string' &&
          typeof doc.version === 'number' &&
          Array.isArray(doc.migrationLog)
        ) {
          emit(doc.dbName, 1);
        }
      }),
    },
    [MIGRATIONS_BY_DB_TYPE_AND_NAME_INDEX_POSTFIX]: {
      map: convertToCouchDBString(doc => {
        if (
          (doc.kind === undefined || doc.kind === 'db-version') &&
          typeof doc.dbType === 'string' &&
          typeof doc.dbName === 'string' &&
          typeof doc.version === 'number' &&
          Array.isArray(doc.migrationLog)
        ) {
          emit([doc.dbType, doc.dbName], 1);
        }
      }),
    },
    [MIGRATIONS_BY_STATUS_INDEX_POSTFIX]: {
      map: convertToCouchDBString(doc => {
        if (
          (doc.kind === undefined || doc.kind === 'db-version') &&
          typeof doc.dbType === 'string' &&
          typeof doc.dbName === 'string' &&
          typeof doc.version === 'number' &&
          Array.isArray(doc.migrationLog) &&
          typeof doc.status === 'string'
        ) {
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
