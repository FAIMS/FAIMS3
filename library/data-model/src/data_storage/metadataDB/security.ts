/**
 * This module exports the security document to be used for the auth database.
 */

import {Action, necessaryActionToCouchRoleList, Role} from '../../permission';
import {SecurityDocument} from '../utils';

export const MetadataDBSecurityDocument = ({
  projectId,
}: {
  projectId: string;
}): SecurityDocument => {
  return {
    // admins have admin ownership
    admins: {
      names: [],
      roles: [Role.GENERAL_ADMIN],
    },
    members: {
      names: [],
      // Must be at least able to read project metadata!
      roles: necessaryActionToCouchRoleList({
        action: Action.READ_PROJECT_METADATA,
        resourceId: projectId,
      }),
    },
  };
};
