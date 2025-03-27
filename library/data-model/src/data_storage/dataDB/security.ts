/**
 * This module exports the security document to be used for the auth database.
 */

import {Action, necessaryActionToCouchRoleList, Role} from '../../permission';
import {SecurityDocument} from '../utils';

export const DataDBSecurityDocument = ({
  projectId,
}: {
  projectId: string;
}): SecurityDocument => {
  return {
    // General admins have complete access
    admins: {
      names: [],
      roles: [Role.GENERAL_ADMIN],
    },
    members: {
      names: [],
      // We have to stoop to reading here since there is no differentiation
      // possible in couch (for read)
      roles: necessaryActionToCouchRoleList({
        action: Action.READ_MY_PROJECT_RECORDS,
        resourceId: projectId,
      }),
    },
  };
};
