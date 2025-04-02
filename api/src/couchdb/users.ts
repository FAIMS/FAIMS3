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
 * Filename: users.ts
 * Description:
 * CRUD helper methods for the users DB
 */

import {
  addGlobalRole,
  CouchDBUsername,
  NotebookAuthSummary,
  PeopleDBFields,
  Role,
  safeWriteDocument,
  userHasResourceRole,
} from '@faims3/data-model';
import {getUsersDB} from '.';
import {
  addLocalPasswordForUser,
  registerLocalUser,
} from '../auth_providers/local';
import {LOCAL_COUCHDB_AUTH} from '../buildconfig';
import * as Exceptions from '../exceptions';
import {getRolesForNotebook} from './notebooks';

/**
 * Builds a minimum spec user object - need to add profiles
 * @returns User object
 */
export const generateInitialUser = ({
  email,
  username,
  name,
}: {
  email?: string;
  username: string;
  name: string;
}): Express.User => {
  return {
    _id: username,
    user_id: username,
    name,
    emails: email ? [email.toLowerCase()] : [],
    // General user is given by default
    globalRoles: [Role.GENERAL_USER],
    // Resource roles are empty to start with
    resourceRoles: [],
    // Profiles are injected later
    profiles: {},
  };
};

/**
 * Registers the admin user into the people DB
 * @param db
 */
export const registerAdminUser = async () => {
  // register a local admin user with the same password as couchdb if there
  // isn't already one there
  if (LOCAL_COUCHDB_AUTH) {
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
      addGlobalRole({user, role: Role.GENERAL_ADMIN});
      await saveUser(user);
    } else {
      console.error(error);
    }
  }
};

/**
 * createUser - create a new user record ensuring that the username or password
 *   - at least one of these needs to be supplied but the other can be empty
 * @param email? - email address
 * @param username? - username
 * @param name? - full name
 * @returns a new Express.User object ready to be saved in the DB
 */
export async function createUser({
  email,
  username,
  name,
}: {
  email?: string;
  username?: string;
  name: string;
}): Promise<[Express.User | null, string]> {
  if (!email && !username) {
    return [null, 'At least one of username or email is required'];
  }
  if (email && (await getUserFromEmail(email))) {
    return [null, `User with email '${email}' already exists`];
  }
  if (username && (await getUserFromUsername(username))) {
    return [null, `User with username '${username}' already exists`];
  }
  if (!username) {
    username = email!.toLowerCase();
  }

  // make a new user record
  const initialUser = generateInitialUser({email: email, username, name});
  return [initialUser, ''];
}

/**
 * Gets the user by ID, then updates the password by writing the local auth
 * strategy for the given username with the updated password.
 * @param userId User id (email/username)
 * @param newPassword new password (not hashed)
 * @returns void
 */
export async function updateUserPassword(
  userId: string,
  newPassword: string
): Promise<void> {
  const possibleUser = await getUserFromEmailOrUsername(userId);

  if (!possibleUser) {
    throw new Exceptions.ItemNotFoundException(
      'Could not find specified user.'
    );
  }

  addLocalPasswordForUser(possibleUser, newPassword);
}

/**
 * Return all users from the users database, if it does not exist, throws error.
 * TODO wherever possible dumping the whole db will not be ideal as scales.
 * @returns all users as Express.User[]
 */
export async function getUsers(): Promise<Express.User[]> {
  // Get the users database
  const users_db = getUsersDB();
  // Fetch all user records from the database and get doc
  return (await users_db.allDocs({include_docs: true})).rows
    .map(r => r.doc!)
    .filter(d => !d._id.startsWith('_'));
}

/**
 * Return all users from the users database, if it does not exist, throws error.
 * TODO wherever possible dumping the whole db will not be ideal as scales.
 * @returns all users as Express.User[]
 */
export async function getUsersForResource({
  resourceId,
}: {
  resourceId: string;
}): Promise<Express.User[]> {
  // Get the users database
  const usersDb = getUsersDB();
  // Fetch all user records from the database and get doc
  return (
    await usersDb.query<PeopleDBFields>('indexes/byResource', {
      key: resourceId,
      include_docs: true,
    })
  ).rows.reduce((filtered, option) => {
    if (option.doc) filtered.push(option.doc);
    return filtered;
  }, [] as Express.User[]);
}

/**
 * getUserFromEmailOrUsername - find a user based on an identifier that could be either an email or username
 * @param identifier - either an email address or username
 * @returns The Express.User record denoted by the identifier or null if it doesn't exist
 */
export async function getUserFromEmailOrUsername(
  identifier: string
): Promise<null | Express.User> {
  let user;
  user = await getUserFromEmail(identifier);
  if (!user) {
    user = await getUserFromUsername(identifier);
  }
  return user;
}

/**
 * getUserFromEmail - retrieve a user record given their email address
 * @param email User email address
 * @returns An Express.User record or null if the user is not in the database
 */
async function getUserFromEmail(email: string): Promise<null | Express.User> {
  const users_db = getUsersDB();
  if (users_db) {
    const result = await users_db.find({
      selector: {emails: {$elemMatch: {$eq: email.toLowerCase()}}},
    });
    if (result.docs.length === 0) {
      return null;
    } else if (result.docs.length === 1) {
      return result.docs[0] as Express.User;
    } else {
      throw Error(`Multiple conflicting users with email ${email}`);
    }
  } else {
    throw Error('Failed to connect to user database');
  }
}

/**
 * getUserFromUsername - retrieve a user record given their username
 * @param username - the username
 * @returns An Express.User record or null if the user is not in the database
 */
async function getUserFromUsername(
  username: CouchDBUsername
): Promise<Express.User | null> {
  const users_db = getUsersDB();
  try {
    const user = (await users_db.get(username)) as Express.User;
    return user;
    //return (await users_db.get(username)) as Express.User;
  } catch (err) {
    return null;
  }
}

/**
 * saveUser - save a user record to the database as a new record or new revision
 * @param user An Express.User record to be written to the database
 */
export async function saveUser(user: Express.User): Promise<void> {
  await safeWriteDocument({db: getUsersDB(), data: user, writeOnClash: true});
}

export async function getUserInfoForProject({
  projectId,
}: {
  projectId: string;
}): Promise<NotebookAuthSummary> {
  const roleDetails = getRolesForNotebook();
  const roles = roleDetails.map(r => r.role);

  // TODO filter this better?
  const allUsers = await getUsers();

  const userList: NotebookAuthSummary = {
    // What roles does the notebook have
    roles,
    users: allUsers.map(user => ({
      name: user.name,
      username: user.user_id,
      roles: roles.map(role => ({
        name: role,
        value: userHasResourceRole({
          user,
          resourceId: projectId,
          resourceRole: role,
        }),
      })),
    })),
  };

  return userList;
}

/**
 * Remove a user from the database
 * @param user - the user to remove
 */
export function removeUser(user: Express.User) {
  const usersDb = getUsersDB();
  usersDb
    .get(user._id)
    .then(doc => {
      return usersDb.remove(doc);
    })
    .catch(err => {
      throw new Error(`User not found or could not be removed! Error: ${err}.`);
    });
}
