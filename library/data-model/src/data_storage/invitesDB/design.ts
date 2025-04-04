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
    // Get invites by project resource
    byProject: {
      map: convertToCouchDBString(doc => {
        if (
          doc.resourceType === 'PROJECT' &&
          doc.resourceId &&
          doc.resourceId.length > 0
        ) {
          emit(doc.resourceId, 1);
        }
      }),
    },

    // Get invites by team resource
    byTeam: {
      map: convertToCouchDBString(doc => {
        if (
          doc.resourceType === 'TEAM' &&
          doc.resourceId &&
          doc.resourceId.length > 0
        ) {
          emit(doc.resourceId, 1);
        }
      }),
    },

    // Get invites by any resource ID (project or team)
    byResourceId: {
      map: convertToCouchDBString(doc => {
        if (doc.resourceId && doc.resourceId.length > 0) {
          emit(doc.resourceId, 1);
        }
      }),
    },

    // Get invites by resource type and ID combination
    byResourceTypeAndId: {
      map: convertToCouchDBString(doc => {
        if (doc.resourceType && doc.resourceId && doc.resourceId.length > 0) {
          emit([doc.resourceType, doc.resourceId], 1);
        }
      }),
    },

    // Get invites by project and role (for backward compatibility)
    byProjectAndRole: {
      map: convertToCouchDBString(doc => {
        if (doc.resourceType === 'PROJECT' && doc.resourceId && doc.role) {
          emit([doc.resourceId, doc.role], 1);
        }
      }),
    },

    // Get invites by team and role
    byTeamAndRole: {
      map: convertToCouchDBString(doc => {
        if (doc.resourceType === 'TEAM' && doc.resourceId && doc.role) {
          emit([doc.resourceId, doc.role], 1);
        }
      }),
    },

    // Get invites by resource type, resource id, and role
    byResourceAndRole: {
      map: convertToCouchDBString(doc => {
        if (doc.resourceType && doc.resourceId && doc.role) {
          emit([doc.resourceType, doc.resourceId, doc.role], 1);
        }
      }),
    },

    // Get invites by creator
    byCreator: {
      map: convertToCouchDBString(doc => {
        if (doc.createdBy) {
          emit(doc.createdBy, 1);
        }
      }),
    },
  },
};

/**
 * Exports all design documents for the invites database
 * Consolidated indexes for common query patterns
 */
export const invitesDesignDocuments = {designDoc};
