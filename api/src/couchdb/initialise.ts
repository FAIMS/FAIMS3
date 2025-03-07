/*
 * Copyright 2021, 2022 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: initialise.js
 * Description:
 *   Functions to initialise the databases required for FAIMS in couchdb
 */

import {CLUSTER_ADMIN_GROUP_NAME} from '@faims3/data-model';
import {registerLocalUser} from '../auth_providers/local';
import {LOCAL_COUCHDB_AUTH} from '../buildconfig';
import {
  addOtherRoleToUser,
  getUserFromEmailOrUsername,
  saveUser,
} from './users';

export const registerAdminUser = async (db: PouchDB.Database | undefined) => {
  // register a local admin user with the same password as couchdb if there
  // isn't already one there
  if (db && LOCAL_COUCHDB_AUTH) {
    const adminUser = await getUserFromEmailOrUsername('admin');
    if (adminUser) {
      return;
    }
    const [user, error] = await registerLocalUser(
      'admin',
      '', // no email address
      'Admin User',
      LOCAL_COUCHDB_AUTH.password
    );
    if (user) {
      addOtherRoleToUser(user, CLUSTER_ADMIN_GROUP_NAME);
      saveUser(user);
    } else {
      console.error(error);
    }
  }
};
