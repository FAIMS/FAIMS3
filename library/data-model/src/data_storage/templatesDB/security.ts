/**
 * This module exports the security document to be used for the auth database.
 */

import {COUCH_ADMIN_ROLE_NAME} from '../../auth';
import {SecurityDocument} from '../utils';

export const TemplatesDBSecurityDocument: SecurityDocument = {
  // Only DB admins can do anything with this
  admins: {
    names: [],
    roles: [COUCH_ADMIN_ROLE_NAME],
  },
  members: {
    names: [],
    roles: [COUCH_ADMIN_ROLE_NAME],
  },
};
