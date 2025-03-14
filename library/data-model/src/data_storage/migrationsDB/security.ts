/**
 * This module exports the security document to be used for the auth database.
 */

import {COUCH_ADMIN_ROLE_NAME} from '../../auth';
import {SecurityDocument} from '../utils';

export const MigrationsDBSecurityDocument: SecurityDocument = {
  // Only DB admins or cluster admins can interact with the Invites DB
  admins: {
    names: [],
    roles: [COUCH_ADMIN_ROLE_NAME],
  },
  members: {
    names: [],
    roles: [COUCH_ADMIN_ROLE_NAME],
  },
};
