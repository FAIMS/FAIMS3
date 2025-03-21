// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

import {convertToCouchDBString} from '../utils';

/**
 * Design document for indexing people
 */
const designDoc = {
  _id: '_design/indexes',
  views: {
    byUserId: {
      map: convertToCouchDBString(doc => {
        if (doc.user_id) {
          emit(doc.user_id, 1);
        }
      }),
    },
    byEmail: {
      map: convertToCouchDBString(doc => {
        if (doc.emails) {
          for (const email of doc.emails) {
            emit(email, 1);
          }
        }
      }),
    },
    byGlobalRoles: {
      map: convertToCouchDBString(doc => {
        if (doc.globalRoles) {
          for (const role of doc.globalRoles) {
            emit(role, 1);
          }
        }
      }),
    },
    byResourceRoles: {
      map: convertToCouchDBString(doc => {
        if (doc.resourceRoles) {
          for (const {role, resourceId} of doc.resourceRoles) {
            emit([role, resourceId], 1);
          }
        }
      }),
    },
    byResource: {
      map: convertToCouchDBString(doc => {
        if (doc.resourceRoles) {
          for (const {resourceId} of doc.resourceRoles) {
            emit(resourceId, 1);
          }
        }
      }),
    },
  },
};

export const peopleDesignDocuments = {designDoc};
