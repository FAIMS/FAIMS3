/**
 * This module exports the security document to be used for the auth database.
 */

import {CLUSTER_ADMIN_GROUP_NAME} from '../../auth';

export interface SecurityDocument {
  // Standard fields for a CouchDB security document
  admins: {
    names: string[];
    roles: string[];
  };
  members: {
    names: string[];
    roles: string[];
  };
}

export const AuthDatabaseSecurityDocument: SecurityDocument = {
  // Only DB admins or cluster admins can interact with the AuthDB
  admins: {
    names: [],
    roles: [CLUSTER_ADMIN_GROUP_NAME],
  },
  members: {
    names: [],
    roles: [CLUSTER_ADMIN_GROUP_NAME],
  },
};
