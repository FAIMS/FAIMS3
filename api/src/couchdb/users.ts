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
  ExistingPeopleDBDocument,
  NotebookAuthSummary,
  PeopleDBDocument,
  PeopleDBFields,
  Role,
  safeWriteDocument,
  userHasProjectRole,
} from '@faims3/data-model';
import {getUsersDB} from '.';
import {upgradeCouchUserToExpressUser} from '../auth/keySigning/create';
import {LOCAL_COUCHDB_AUTH} from '../buildconfig';
import * as Exceptions from '../exceptions';
import {getRolesForNotebook} from './notebooks';
import {registerLocalUser, addLocalPasswordForUser} from '../auth/helpers';

/**
 * Builds a minimum spec user object - need to add profiles
 * @returns User object
 */
export const generateInitialUser = ({
  email,
  username,
  name,
  verified = false,
}: {
  email?: string;
  username: string;
  name: string;
  verified?: boolean;
}): PeopleDBDocument => {
  return {
    _id: username,
    user_id: username,
    name,
    emails: email ? [{email: email.toLowerCase(), verified}] : [],
    // General user is given by default
    globalRoles: [Role.GENERAL_USER],
    // Project roles is empty
    projectRoles: [],
    // Template roles is empty
    templateRoles: [],
    // Profiles are injected later
    profiles: {},
    teamRoles: [],
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
    const adminUser = await getCouchUserFromEmailOrUserId('admin');
    if (adminUser) {
      return;
    }
    const [user, error] = await registerLocalUser({
      username: 'admin',
      // email is not specified - username is used
      email: '',
      name: 'Admin User',
      password: LOCAL_COUCHDB_AUTH.password,
    });
    if (user) {
      addGlobalRole({user, role: Role.GENERAL_ADMIN});
      await saveCouchUser(user);
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
  verified = false,
}: {
  email?: string;
  username?: string;
  name: string;
  verified?: boolean;
}): Promise<[PeopleDBDocument | null, string]> {
  if (!email && !username) {
    return [null, 'At least one of username or email is required'];
  }
  if (email && (await getUserFromEmail(email))) {
    return [null, `User with email '${email}' already exists`];
  }
  if (username && (await getUserFromUserId(username))) {
    return [null, `User with username '${username}' already exists`];
  }
  if (!username) {
    username = email!.toLowerCase();
  }

  // make a new user record
  const initialUser = generateInitialUser({
    email,
    username,
    name,
    verified,
  });
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
  const possibleUser = await getCouchUserFromEmailOrUserId(userId);

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
export async function getUsers(): Promise<ExistingPeopleDBDocument[]> {
  // Get the users database
  const users_db = getUsersDB();
  // Fetch all user records from the database and get doc
  return (await users_db.allDocs({include_docs: true})).rows
    .map(r => r.doc!)
    .filter(d => !d._id.startsWith('_'));
}

/**
 * Gets users from the people db by resource Id (see design index)
 */
export async function getUsersForResource({
  resourceId,
}: {
  resourceId: string;
}): Promise<ExistingPeopleDBDocument[]> {
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
  }, [] as ExistingPeopleDBDocument[]);
}

/**
 * Gets users from the people db by team ID
 */
export async function getUsersForTeam({
  teamId,
}: {
  teamId: string;
}): Promise<ExistingPeopleDBDocument[]> {
  // Get the users database
  const usersDb = getUsersDB();

  // Fetch all user records from the database and get doc
  return (
    await usersDb.query<PeopleDBFields>('indexes/byResource', {
      key: teamId,
      include_docs: true,
    })
  ).rows
    .filter(r => !!r.doc && !r.id.startsWith('_'))
    .map(r => r.doc!);
}

/**
 * getUserFromEmailOrUsername - find a user based on an identifier that could be either an email or username
 * @param identifier - either an email address or username
 * @returns The Express.User record denoted by the identifier or null if it doesn't exist
 */
export async function getCouchUserFromEmailOrUserId(
  identifier: string
): Promise<null | ExistingPeopleDBDocument> {
  let user;
  user = await getUserFromEmail(identifier);
  if (!user) {
    user = await getUserFromUserId(identifier);
  }
  return user;
}

/**
 * Fetch and then upgrade express user (drilling permission into resource roles
 * based on associative virtual roles etc)
 * @param identifier
 * @returns
 */
export async function getExpressUserFromEmailOrUserId(
  identifier: string
): Promise<Express.User | null> {
  const dbUser = await getCouchUserFromEmailOrUserId(identifier);
  if (dbUser === null) {
    return dbUser;
  }

  return await upgradeCouchUserToExpressUser({dbUser});
}

/**
 * getUserFromEmail - retrieve a user record given their email address
 * @param email User email address
 */
async function getUserFromEmail(
  email: string
): Promise<null | ExistingPeopleDBDocument> {
  const usersDb = getUsersDB();
  if (!usersDb) {
    throw Error('Failed to connect to user database');
  }

  // Normalize email to lowercase
  const normalizedEmail = email.toLowerCase();

  // Query the byEmail view
  const result = await usersDb.query<ExistingPeopleDBDocument>(
    'indexes/byEmail',
    {
      key: normalizedEmail,
      include_docs: true,
    }
  );

  if (result.rows.length === 0) {
    return null;
  } else if (result.rows.length === 1) {
    return result.rows[0].doc as ExistingPeopleDBDocument;
  } else {
    throw Error(`Multiple conflicting users with email ${email}`);
  }
}

/**
 * getUserFromUsername - retrieve a user record given their username
 * @param userId - the username
 */
async function getUserFromUserId(
  userId: CouchDBUsername
): Promise<ExistingPeopleDBDocument | null> {
  const usersDb = getUsersDB();
  if (!usersDb) {
    throw Error('Failed to connect to user database');
  }

  // Query the byUserId view
  const result = await usersDb.query<ExistingPeopleDBDocument>(
    'indexes/byUserId',
    {
      key: userId,
      include_docs: true,
    }
  );

  if (result.rows.length === 0) {
    return null;
  } else if (result.rows.length === 1) {
    return result.rows[0].doc as ExistingPeopleDBDocument;
  } else {
    throw Error(`Multiple conflicting users with username ${userId}`);
  }
}

/**
 * saveCouchUser - save a user record to the database as a new record or new revision
 * @param user A people db document to write
 */
export async function saveCouchUser(
  user: PeopleDBDocument | ExistingPeopleDBDocument
): Promise<void> {
  await safeWriteDocument({db: getUsersDB(), data: user, writeOnClash: true});
}

/**
 * saveExpressUser - saves an express user to the db (stripping out resource roles)
 * @param user An Express.User record to be written to the database
 */
export async function saveExpressUser(user: Express.User): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const {resourceRoles, ...dbUser} = user;
  await saveCouchUser(dbUser);
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
        value: userHasProjectRole({
          user,
          projectId,
          role,
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
export function removeUser(user: ExistingPeopleDBDocument) {
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

/**
 * Updates the verification status of a user's email address.
 *
 * @param userId The ID of the user whose email is being verified
 * @param email The email address to mark as verified/unverified
 * @param verified Whether the email should be marked as verified or not
 *
 * @returns A Promise that resolves when the email verification status has been updated
 *
 * @throws ItemNotFoundException if the user is not found
 * @throws InvalidRequestException if the specified email is not associated with the user
 */
export async function updateUserEmailVerificationStatus({
  userId,
  email,
  verified,
}: {
  userId: string;
  email: string;
  verified: boolean;
}): Promise<void> {
  // Get the user from the database
  const user = await getCouchUserFromEmailOrUserId(userId);

  if (!user) {
    throw new Exceptions.ItemNotFoundException(
      'Could not find specified user.'
    );
  }

  // Normalize email to lowercase for comparison
  const normalizedEmail = email.toLowerCase();

  // Check if the user has the specified email
  let emailFound = false;

  // Update the verification status if the email exists
  const updatedEmails = user.emails.map(emailEntry => {
    if (emailEntry.email.toLowerCase() === normalizedEmail) {
      emailFound = true;
      // Update the verification status
      return {...emailEntry, verified};
    }
    // Keep other emails unchanged
    return emailEntry;
  });

  // If the email wasn't found, throw an error
  if (!emailFound) {
    throw new Exceptions.InvalidRequestException(
      `The email ${email} is not associated with this user account.`
    );
  }

  // Update the user's emails array with the new verification statuses
  user.emails = updatedEmails;

  // Save the updated user to the database
  await saveCouchUser(user);
}
