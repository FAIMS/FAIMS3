/**
 * Security document for the tombstone database (server-side only).
 */

import {COUCH_ADMIN_ROLE_NAME} from '../../constants';
import {SecurityDocument} from '../utils';

export const TombstoneDBSecurityDocument: SecurityDocument = {
  // Only DB admins or cluster admins can interact with the TombstoneDB
  admins: {
    names: [],
    roles: [COUCH_ADMIN_ROLE_NAME],
  },
  members: {
    names: [],
    roles: [COUCH_ADMIN_ROLE_NAME],
  },
};
