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
 * Description:
 *   Setup helper functions for the api tests
 */

import request from 'supertest';
import {NOTEBOOK_CREATOR_GROUP_NAME} from '@faims3/data-model';
import {expect} from 'chai';
import PouchDB from 'pouchdb';
import {addLocalPasswordForUser} from '../src/auth_providers/local';
import {createAuthKey} from '../src/authkeys/create';
import {KEY_SERVICE} from '../src/buildconfig';
import {
  addOtherRoleToUser,
  createUser,
  getUserFromEmailOrUsername,
  saveUser,
} from '../src/couchdb/users';
import {cleanDataDBS, resetDatabases} from './mocks';
PouchDB.plugin(require('pouchdb-adapter-memory')); // enable memory adapter for testing
PouchDB.plugin(require('pouchdb-find'));

export let adminToken = '';
export let localUserToken = '';
export let notebookUserToken = '';

export const adminUserName = 'admin';
export const localUserName = 'bobalooba';
export const localUserPassword = 'bobalooba';
export const notebookUserName = 'notebook';
export const notebookPassword = 'notebook';

/**
 * A startup function which
 * - clears out the databases
 * - re-initialises including setting up the admin user in the users database
 * - removes all data databases
 * - ensures the admin user exists
 * - creates the local user who is authenticated but has no roles
 * - creates a notebook user who has the notebook creator role
 */
export const beforeApiTests = async () => {
  // Clean and reinitialise databases
  await resetDatabases();
  await cleanDataDBS();

  // NOTE the admin user should exist at this point

  // Get the signing key to use to create JWTs
  const signingKey = await KEY_SERVICE.getSigningKey();

  // get the admin user - this should exist at this point
  const possibleAdminUser = await getUserFromEmailOrUsername(adminUserName);

  // If this is null then the admin user wasn't seeded properly
  expect(possibleAdminUser, 'Admin user was null from the database.').to.not.be
    .null;
  const adminUser = possibleAdminUser!;

  // Create the admin token
  adminToken = await createAuthKey(adminUser!, signingKey);

  // create the local user
  const [possibleLocalUser] = await createUser('', localUserName);
  // If this is null then the createUser function is not working
  expect(possibleLocalUser, 'Local user was null from create function.').to.not
    .be.null;
  const localUser = possibleLocalUser!;

  // save user and create password
  await saveUser(localUser);
  await addLocalPasswordForUser(localUser, localUserPassword); // saves the user
  localUserToken = await createAuthKey(localUser, signingKey);

  // create the nb user
  const [possibleNbUser] = await createUser('', notebookUserName);

  // If this is null then the createUser function is not working
  expect(possibleNbUser, 'Notebook user was null from create user function.').to
    .not.be.null;
  const nbUser = possibleNbUser!;

  // save user and create password
  await saveUser(nbUser);
  addOtherRoleToUser(nbUser, NOTEBOOK_CREATOR_GROUP_NAME);
  await addLocalPasswordForUser(nbUser, notebookPassword);
  notebookUserToken = await createAuthKey(nbUser, signingKey);
};

/**
 * Wraps a test request object with necessary authentication (admin) and JSON
 * content type
 * @param request The test request object to wrap
 * @returns The wrapped request object
 */
export const requestAuthAndType = (
  request: request.Test,
  token: string = adminToken
) => {
  return request
    .set('Authorization', `Bearer ${token}`)
    .set('Content-Type', 'application/json');
};
