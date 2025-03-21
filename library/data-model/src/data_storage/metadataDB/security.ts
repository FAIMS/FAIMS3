/**
 * This module exports the security document to be used for the auth database.
 */

import {Role} from '../../permission';
import {buildCouchRoleFromProjectId, SecurityDocument} from '../utils';

export const MetadataDBSecurityDocument = ({
  projectId,
  roles,
}: {
  projectId: string;
  roles: string[];
}): SecurityDocument => {
  return {
    // admins have admin ownership
    admins: {
      names: [],
      roles: [Role.GENERAL_ADMIN],
    },
    // Otherwise project scoped roles
    members: {
      names: [],
      roles: roles.map(role => buildCouchRoleFromProjectId({projectId, role})),
    },
  };
};
