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
    byProjectRoles: {
      map: convertToCouchDBString(doc => {
        if (doc.projectRoles) {
          for (const {role, resourceId} of doc.projectRoles) {
            emit([role, resourceId], 1);
          }
        }
      }),
    },
    byTemplateRoles: {
      map: convertToCouchDBString(doc => {
        if (doc.templateRoles) {
          for (const {role, resourceId} of doc.templateRoles) {
            emit([role, resourceId], 1);
          }
        }
      }),
    },
    byTeamRoles: {
      map: convertToCouchDBString(doc => {
        if (doc.teamRoles) {
          for (const {role, resourceId} of doc.teamRoles) {
            emit([role, resourceId], 1);
          }
        }
      }),
    },
    byResource: {
      map: convertToCouchDBString(doc => {
        // only emit once per resource Id !
        const emitted = [];
        if (doc.projectRoles) {
          for (const {resourceId} of doc.projectRoles) {
            if (emitted.indexOf(resourceId) === -1) {
              emit(resourceId, 1);
              emitted.push(resourceId);
            }
          }
        }
        if (doc.teamRoles) {
          for (const {resourceId} of doc.teamRoles) {
            if (emitted.indexOf(resourceId) === -1) {
              emit(resourceId, 1);
              emitted.push(resourceId);
            }
          }
        }
        if (doc.templateRoles) {
          for (const {resourceId} of doc.templateRoles) {
            if (emitted.indexOf(resourceId) === -1) {
              emit(resourceId, 1);
              emitted.push(resourceId);
            }
          }
        }
      }),
    },
  },
};

export const peopleDesignDocuments = {designDoc};
