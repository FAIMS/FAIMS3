// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

import {convertToCouchDBString} from '../utils';

/**
 * Design document for indexing invites
 * Contains all the views needed for the invites database in a single doc
 */
const designDoc = {
  _id: '_design/indexes',
  views: {
    byProject: {
      map: convertToCouchDBString(doc => {
        if (doc.projectId) {
          emit(doc.projectId, 1);
        }
      }),
    },
    byProjectAndRole: {
      map: convertToCouchDBString(doc => {
        if (doc.projectId && doc.role) {
          emit([doc.projectId, doc.role], 1);
        }
      }),
    },
    countByProject: {
      map: convertToCouchDBString(doc => {
        if (doc.projectId) {
          emit(doc.projectId, 1);
        }
      }),
      reduce: '_count',
    },
  },
};

/**
 * Exports all design documents for the invites database
 * Consolidated indexes for common query patterns
 */
export const invitesDesignDocuments = {designDoc};
