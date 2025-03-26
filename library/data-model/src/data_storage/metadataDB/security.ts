/**
 * This module exports the security document to be used for the auth database.
 */

import {CLUSTER_ADMIN_GROUP_NAME} from '../../auth';
import {buildCouchRoleFromProjectId, SecurityDocument} from '../utils';

export const MetadataDBSecurityDocument = ({
  projectId,
  roles,
}: {
  projectId: string;
  roles: string[];
}): SecurityDocument => {
  return {
    // Cluster admins have admin ownership
    admins: {
      names: [],
      roles: [CLUSTER_ADMIN_GROUP_NAME],
    },
    // Otherwise project scoped roles
    members: {
      names: [],
      roles: roles.map(role => buildCouchRoleFromProjectId({projectId, role})),
    },
  };
};
