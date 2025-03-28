/**
 * This module exports the security document to be used for the auth database.
 */

import {COUCH_ADMIN_ROLE_NAME} from '../..';
import {SecurityDocument} from '../utils';

export const DirectoryDBSecurityDocument: SecurityDocument = {
  // Only DB admins (_admin) can modify the directory
  admins: {
    names: [],
    roles: [COUCH_ADMIN_ROLE_NAME],
  },
  members: {
    names: [],
    roles: [COUCH_ADMIN_ROLE_NAME],
  },
};
