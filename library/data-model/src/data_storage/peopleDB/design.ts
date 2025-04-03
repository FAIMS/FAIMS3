// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

/**
 * Exports all design documents for the people database
 * (None)
 */
<<<<<<< HEAD
export const peopleDbDesignDocuments = {};
=======
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
          // only emit once per resource Id !
          const emitted = [];
          for (const {resourceId} of doc.resourceRoles) {
            if (emitted.indexOf(resourceId) === -1) {
              emit(resourceId, 1);
              emitted.push(resourceId);
            }
          }
        }
      }),
    },
    byTeam: {
      map: convertToCouchDBString(doc => {
        if (doc.resourceRoles) {
          // only emit once per team Id !
          const emitted = [];
          for (const {resourceId} of doc.teamRoles) {
            if (emitted.indexOf(resourceId) === -1) {
              emit(resourceId, 1);
              emitted.push(resourceId);
            }
          }
        }
      }),
    },
    byTeamRoles: {
      map: convertToCouchDBString(doc => {
        if (doc.resourceRoles) {
          for (const {role, resourceId} of doc.teamRoles) {
            emit([role, resourceId], 1);
          }
        }
      }),
    },
  },
};

export const peopleDesignDocuments = {designDoc};
>>>>>>> origin/main
