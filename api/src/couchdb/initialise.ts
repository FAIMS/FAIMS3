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

import {registerLocalUser} from '../auth_providers/local';
import {
  CONDUCTOR_INSTANCE_NAME,
  CONDUCTOR_PUBLIC_URL,
  LOCAL_COUCHDB_AUTH,
  CLUSTER_ADMIN_GROUP_NAME,
} from '../buildconfig';
import {
  addOtherRoleToUser,
  getUserFromEmailOrUsername,
  saveUser,
} from './users';

export const initialiseProjectsDB = async (
  db: PouchDB.Database | undefined
) => {
  // Permissions doc goes into _design/permissions in a project
  // javascript in here will run inside CouchDB
  const projectPermissionsDoc = {
    _id: '_design/permissions',
    validate_doc_update: `function (newDoc, oldDoc, userCtx) {
      // Reject update if user does not have an _admin role
      if (userCtx.roles.indexOf('_admin') < 0) {
        throw {
          unauthorized:
            \`Access denied for \${userCtx.roles}. Only the Fieldmark server may modify projects\`,
        };
      }
    }`,
  };
  if (db) {
    try {
      await db.get(projectPermissionsDoc._id);
    } catch {
      await db.put(projectPermissionsDoc);
    }

    // can't save security on an in-memory database so skip if testing
    if (process.env.NODE_ENV !== 'test') {
      const security = db.security();
      security.admins.roles.add(CLUSTER_ADMIN_GROUP_NAME);
      security.admins.roles.add('_admin');
      security.members.roles.removeAll();
      await security.save();
    }
  }
};

export const initialiseDirectoryDB = async (
  db: PouchDB.Database | undefined
) => {
  const directoryDoc = {
    _id: 'default',
    name: CONDUCTOR_INSTANCE_NAME,
    description: `Fieldmark instance on ${CONDUCTOR_PUBLIC_URL}`,
    people_db: {
      db_name: 'people',
    },
    projects_db: {
      db_name: 'projects',
    },
    conductor_url: `${CONDUCTOR_PUBLIC_URL}/`,
  };

  const permissions = {
    _id: '_design/permissions',
    validate_doc_update: `function(newDoc, oldDoc, userCtx) {
      if (userCtx.roles.indexOf('_admin') >= 0) {
        return;
      }
      throw({forbidden: "Access denied. Only the Fieldmark admin can modify the directory."});
    }`,
  };

  if (db) {
    // do we already have a default document?
    try {
      await db.get('default');
    } catch {
      await db.put(directoryDoc);
      await db.put(permissions);

      // can't save security on an in-memory database so skip if testing
      if (process.env.NODE_ENV !== 'test') {
        // directory needs to be public
        const security = db.security();
        security.admins.roles.removeAll();
        security.members.roles.removeAll();
        await security.save();
      }
    }
  }
};

export const initialiseUserDB = async (db: PouchDB.Database | undefined) => {
  // register a local admin user with the same password as couchdb
  // if there isn't already one there
  if (db && LOCAL_COUCHDB_AUTH) {
    const adminUser = await getUserFromEmailOrUsername('admin');

    if (adminUser) {
      return;
    }

    // can't save security on an in-memory database so skip if testing
    if (process.env.NODE_ENV !== 'test') {
      const security = db.security();
      security.admins.roles.add(CLUSTER_ADMIN_GROUP_NAME);
      security.members.roles.removeAll();
      await security.save();
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
