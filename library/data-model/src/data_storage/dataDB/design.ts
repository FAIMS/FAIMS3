// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

import {convertToCouchDBString} from '../utils';

/**
 * Design document for filtering attachments
 */
export const attachmentFilterDocument = {
  _id: '_design/attachment_filter',
  views: {
    attachment_filter: {
      map: convertToCouchDBString(doc => {
        if (doc.attach_format_version === undefined) {
          emit(doc._id);
        }
      }),
    },
  },
};

/**
 * Design document for permissions validation
 */
export const permissionsDocument = {
  _id: '_design/permissions',
  validate_doc_update: convertToCouchDBString(
    (newDoc, oldDoc, userCtx, _secObj) => {
      if (userCtx === null || userCtx === undefined) {
        throw {
          unauthorized: 'You must be logged in. No token given.',
        };
      }
      if (userCtx.name === null || userCtx.name === undefined) {
        throw {
          unauthorized: 'You must be logged in. No username given.',
        };
      }
      return;
    }
  ),
};

/**
 * Design document for indexing different document types
 */
export const indexDocument = {
  _id: '_design/index',
  views: {
    record: {
      map: convertToCouchDBString(doc => {
        if (doc.record_format_version === 1) emit(doc._id, 1);
      }),
    },
    recordRevisions: {
      map: convertToCouchDBString(doc => {
        if (doc.record_format_version === 1)
          if (doc.heads.length > 0) {
            const conflict = doc.heads.length > 1;
            const created = doc.created;
            const created_by = doc.created_by;
            const type = doc.type;
            emit(doc._id, {
              _id: doc.heads[0],
              conflict,
              created,
              created_by,
              type,
            });
          }
      }),
    },
    revision: {
      map: convertToCouchDBString(doc => {
        if (doc.revision_format_version === 1) emit(doc._id, 1);
      }),
    },
    avp: {
      map: convertToCouchDBString(doc => {
        if (doc.avp_format_version === 1) emit(doc._id, 1);
      }),
    },
    recordCount: {
      map: convertToCouchDBString(doc => {
        if (doc.record_format_version === 1) emit(doc._id, 1);
      }),
      reduce: '_count',
    },
  },
};

/**
 * Exports all design documents for the notebook database
 */
export const dataDbDesignDocuments = {
  attachmentFilterDocument,
  permissionsDocument,
  indexDocument,
};
