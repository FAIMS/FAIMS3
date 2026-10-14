// SPDX-License-Identifier: Apache-2.0
/**
 * mapAssets is an API-owned system database, same as teams and people.
 * Devices download normalized files from object storage via a
 * Conductor-issued presigned URL.
 */

import {COUCH_ADMIN_ROLE_NAME} from '../../constants';
import {SecurityDocument} from '../utils';

export const MapAssetsDBSecurityDocument: SecurityDocument = {
  admins: {
    names: [],
    roles: [COUCH_ADMIN_ROLE_NAME],
  },
  members: {
    names: [],
    roles: [COUCH_ADMIN_ROLE_NAME],
  },
};
