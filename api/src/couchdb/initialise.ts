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

import {
  AuthDatabaseSecurityDocument,
  CLUSTER_ADMIN_GROUP_NAME,
  permissionDocument,
  viewsDocument,
} from '@faims3/data-model';
import {registerLocalUser} from '../auth_providers/local';
import {
  CONDUCTOR_INSTANCE_NAME,
  CONDUCTOR_PUBLIC_URL,
  LOCAL_COUCHDB_AUTH,
} from '../buildconfig';
import {safeWriteDocument} from './helpers';
import {
  addOtherRoleToUser,
  getUserFromEmailOrUsername,
  saveUser,
} from './users';

/**
 * A helper to 1) clear out admins/members 2) add the specified roles 3) save
 * the security document. This will have the behaviour of 'locking down' the DB
 * to these users only.
 * @param security The pouchDB security helper. Will be saved after completion.
 * @param roles The roles to include in the members and admin arrays. **NOTE**
 * An empty members array will make the DB public!
 */
const adminOnlySecurityHelper = async (
  security: PouchDB.SecurityHelper.Security,
  roles: Array<string>
) => {
  // Remove all admins
  security.admins.removeAll();
  roles.forEach(r => {
    security.admins.roles.add(r);
  });
  // Remove all members
  security.members.removeAll();
  roles.forEach(r => {
    security.members.roles.add(r);
  });
  await security.save();
};

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
      await adminOnlySecurityHelper(security, [
        CLUSTER_ADMIN_GROUP_NAME,
        '_admin',
      ]);
    }
  }
};

export const initialiseTemplatesDb = async (
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
            \`Access denied for \${userCtx.roles}. Only the Fieldmark server may modify templates\`,
        };
      }
    }`,
  };
  if (db) {
    try {
      await db.get(projectPermissionsDoc._id);
    } catch {
      try {
        await db.put(projectPermissionsDoc);
      } catch (e) {
        console.error(
          'Failed to initialise security document for templates database.'
        );
        throw e;
      }
    }

    // can't save security on an in-memory database so skip if testing
    if (process.env.NODE_ENV !== 'test') {
      const security = db.security();
      await adminOnlySecurityHelper(security, [
        CLUSTER_ADMIN_GROUP_NAME,
        '_admin',
      ]);
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
        await adminOnlySecurityHelper(security, ['_admin']);
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
      await adminOnlySecurityHelper(security, [CLUSTER_ADMIN_GROUP_NAME]);
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

// ============
// AUTH DB
// ============

/**
 * Initialises the Auth DB by injecting a security document, and design
 * documents from the data model.
 *
 * Will perform no-op if the permission and design docs are in place.
 *
 * TODO have an admin only initialisation endpoint which can be used to update
 * existing documents.
 *
 * @param db The database to initialise, intentionally not typed so as to not
 * include type errors for interacting with permission and security documents.
 */
export const initialiseAuthDb = async (db: PouchDB.Database): Promise<void> => {
  // To check if we are initialised - we check for presence of expected
  // documents
  let initialised = true;

  try {
    db.get(permissionDocument._id);
    db.get(viewsDocument._id);
  } catch (err: any) {
    // 404 for not found
    if (err.status !== 404) {
      throw err;
    }

    // item was not found - so not initialised
    initialised = false;
  }

  if (initialised) {
    console.log('Already initialised AuthDB - no-op.');
    return;
  }

  console.log('Performing initialisation of AuthDB.');

  // can't save security on an in-memory database so skip if testing
  if (process.env.NODE_ENV !== 'test') {
    try {
      await db.security(AuthDatabaseSecurityDocument).save();
    } catch (e) {
      console.error(
        'Failed to save security document into Auth DB. Error: ' + e
      );
      throw e;
    }
  }

  // Next setup the permissions document - overwrite if existing
  try {
    await safeWriteDocument(db, permissionDocument);
  } catch (e) {
    console.error(
      'Failed to upsert permission document into Auth DB. Error: ' + e
    );
    throw e;
  }

  // Next setup the index document - overwrite if existing
  try {
    await safeWriteDocument(db, viewsDocument);
  } catch (e) {
    console.error('Failed to upsert index document into Auth DB. Error: ' + e);
    throw e;
  }
};
