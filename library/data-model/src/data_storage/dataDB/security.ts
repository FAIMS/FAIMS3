/**
 * This module exports the security document to be used for the auth database.
 */

import {Role} from '../../permission';
import {buildCouchRoleFromProjectId, SecurityDocument} from '../utils';

export const DataDBSecurityDocument = ({
  projectId,
  roles,
}: {
  projectId: string;
  roles: string[];
}): SecurityDocument => {
  return {
    // General admins have complete access
    admins: {
      names: [],
      roles: [Role.GENERAL_ADMIN],
    },
    members: {
      names: [],
      roles: roles.map(role => buildCouchRoleFromProjectId({projectId, role})),
    },
  };
};
