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
      // Membership = "may talk to this DB". Per-document my/all sync reads are
      // enforced by couch-auth-proxy (`creator`/`parent` + FAIMS-patched
      // `dbacl` on proxy `_design/acl`). See AclValidationLayering.md /
      // dataDB/acl.ts.
      roles: necessaryActionToCouchRoleList({
        action: Action.READ_MY_PROJECT_RECORDS,
        resourceId: projectId,
      }),
    },
  };
};
