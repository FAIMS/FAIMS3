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
 * Filename: users.tests.ts
 * Description:
 *   Tests for user handling
 */

import PouchDB from 'pouchdb';
import {
  addLocalPasswordForUser,
  validateLocalUser,
} from '../src/auth_providers/local';
import {CLUSTER_ADMIN_GROUP_NAME} from '../src/buildconfig';
import {getUsersDB, initialiseDatabases} from '../src/couchdb';
import {
  addProjectRoleToUser,
  addOtherRoleToUser,
  createUser,
  removeOtherRoleFromUser,
  removeProjectRoleFromUser,
  saveUser,
  userHasPermission,
  getUserInfoForNotebook,
} from '../src/couchdb/users';
PouchDB.plugin(require('pouchdb-adapter-memory')); // enable memory adapter for testing
PouchDB.plugin(require('pouchdb-find'));
import {expect, assert} from 'chai';

import * as fs from 'fs';
import {createNotebook} from '../src/couchdb/notebooks';

const clearUsers = async () => {
  const usersDB = getUsersDB();
  if (usersDB) {
    const docs = await usersDB.allDocs();
    for (let i = 0; i < docs.rows.length; i++) {
      await usersDB.remove(docs.rows[i].id, docs.rows[i].value.rev);
    }
  }
};
describe('user creation', () => {
  beforeEach(clearUsers);

  it('create user - good', async () => {
    const email = 'BOB@Here.com';
    const username = 'bobalooba';
    const [newUserUsername, errorUsername] = await createUser('', username);
    expect(errorUsername).to.equal('');
    if (newUserUsername) {
      expect(newUserUsername.user_id).to.equal(username);
      expect(newUserUsername.emails.length).to.equal(0);
    } else {
      assert.fail('user is null after createUser with valid username');
    }

    const [newUserEmail, errorEmail] = await createUser(email, '');
    expect(errorEmail).to.equal('');
    if (newUserEmail) {
      expect(newUserEmail.user_id).not.to.equal('');
      expect(newUserEmail.emails).to.include(email.toLowerCase());
    } else {
      assert.fail('user is null after createUser with valid email');
    }
  });

  it('create user - duplicates and missing', async () => {
    const email = 'BOBBY@here.com';
    const username = 'bobalooba';

    const [newUser, errorFirst] = await createUser(email, '');
    expect(errorFirst).to.equal('');
    if (newUser) {
      await saveUser(newUser);
      // now make another user with the same email
      const [anotherUser, errorSecond] = await createUser(email, '');
      expect(errorSecond).to.equal(`User with email '${email}' already exists`);
      expect(anotherUser).to.be.null;
    }
    const [newUserU, errorFirstU] = await createUser('', username);
    expect(errorFirstU).to.equal('');
    if (newUserU) {
      await saveUser(newUserU);
      // now make another user with the same email
      const [anotherUserU, errorSecondU] = await createUser('', username);
      expect(errorSecondU).to.equal(
        `User with username '${username}' already exists`
      );
      expect(anotherUserU).to.be.null;
    }

    const [newUserM, errorM] = await createUser('', '');
    expect(errorM).to.equal('At least one of username and email is required');
    expect(newUserM).to.be.null;
  });

  it('user roles', async () => {
    const email = 'BOBBY@here.com';
    const username = 'bobalooba';

    const [newUser, error] = await createUser(email, username);
    expect(error).to.equal('');
    if (newUser) {
      // add some roles
      addOtherRoleToUser(newUser, 'cluster-admin');
      addOtherRoleToUser(newUser, 'chief-bobalooba');

      // check that 'roles' has been updated
      expect(newUser.roles.length).to.equal(2);
      expect(newUser.roles).to.include('cluster-admin');
      expect(newUser.roles).to.include('chief-bobalooba');

      addProjectRoleToUser(newUser, 'important-project', 'admin');

      expect(newUser.other_roles.length).to.equal(2);
      expect(newUser.other_roles).to.include('cluster-admin');
      expect(newUser.other_roles).to.include('chief-bobalooba');
      expect(Object.keys(newUser.project_roles)).to.include(
        'important-project'
      );
      expect(newUser.project_roles['important-project']).to.include('admin');

      expect(newUser.roles.length).to.equal(3);
      expect(newUser.roles).to.include('important-project||admin');

      // add more project roles
      addProjectRoleToUser(newUser, 'important-project', 'team');
      expect(newUser.project_roles['important-project']).to.include('admin');
      expect(newUser.project_roles['important-project']).to.include('team');
      expect(newUser.project_roles['important-project'].length).to.equal(2);

      expect(newUser.roles.length).to.equal(4);
      expect(newUser.roles).to.include('cluster-admin');
      expect(newUser.roles).to.include('chief-bobalooba');
      expect(newUser.roles).to.include('important-project||admin');
      expect(newUser.roles).to.include('important-project||team');

      // doing it again should be a no-op
      addProjectRoleToUser(newUser, 'important-project', 'team');
      expect(newUser.project_roles['important-project'].length).to.equal(2);

      addOtherRoleToUser(newUser, 'cluster-admin');
      expect(newUser.other_roles.length).to.equal(2);

      expect(newUser.roles.length).to.equal(4);
      expect(newUser.roles).to.include('cluster-admin');
      expect(newUser.roles).to.include('chief-bobalooba');
      expect(newUser.roles).to.include('important-project||admin');
      expect(newUser.roles).to.include('important-project||team');

      // remove one
      removeProjectRoleFromUser(newUser, 'important-project', 'admin');
      expect(newUser.project_roles['important-project']).not.to.include(
        'admin'
      );
      expect(newUser.project_roles['important-project']).to.include('team');

      removeOtherRoleFromUser(newUser, 'cluster-admin');
      expect(newUser.other_roles.length).to.equal(1);
      expect(newUser.other_roles).to.include('chief-bobalooba');
      expect(newUser.other_roles).not.to.include('cluster-admin');

      expect(newUser.roles.length).to.equal(2);
      expect(newUser.roles).not.to.include('cluster-admin');
      expect(newUser.roles).to.include('chief-bobalooba');
      expect(newUser.roles).not.to.include('important-project||admin');
      expect(newUser.roles).to.include('important-project||team');

      // remove roles that aren't there should be harmless
      removeProjectRoleFromUser(newUser, 'important-project', 'not-there');
      expect(newUser.project_roles['important-project'].length).to.equal(1);
      removeOtherRoleFromUser(newUser, 'non-existant');
      expect(newUser.other_roles.length).to.equal(1);
      expect(newUser.other_roles).to.include('chief-bobalooba');
    }
  });

  it('checking permissions', async () => {
    const email = 'BOBBY@here.com';
    const username = 'bobalooba';
    const project_id = 'myProject';

    const [user, error] = await createUser(email, username);
    expect(error).to.equal('');
    if (user) {
      expect(userHasPermission(user, project_id, 'read')).to.be.false;
      expect(userHasPermission(user, project_id, 'modify')).to.be.false;

      // add some roles
      addOtherRoleToUser(user, CLUSTER_ADMIN_GROUP_NAME);

      expect(userHasPermission(user, project_id, 'read')).to.be.true;
      expect(userHasPermission(user, project_id, 'modify')).to.be.true;

      removeOtherRoleFromUser(user, CLUSTER_ADMIN_GROUP_NAME);

      // test permissions for user role
      addProjectRoleToUser(user, project_id, 'user');
      expect(userHasPermission(user, project_id, 'read')).to.be.true;
      expect(userHasPermission(user, project_id, 'modify')).to.be.false;

      // but can't access another project
      expect(userHasPermission(user, 'anotherProject', 'read')).to.be.false;
      expect(userHasPermission(user, 'anotherProject', 'modify')).to.be.false;

      // give them admin permission
      addProjectRoleToUser(user, project_id, 'admin');

      expect(userHasPermission(user, project_id, 'read')).to.be.true;
      expect(userHasPermission(user, project_id, 'modify')).to.be.true;
    }
  });

  it('add local password', async () => {
    const username = 'bobalooba';
    const password = 'verysecret';
    const [user, error] = await createUser('', username);
    expect(error).to.equal('');
    if (user) {
      await addLocalPasswordForUser(user, password);
      const profile = user.profiles['local'] as any; // really LocalProfile
      expect(profile).not.to.be.undefined;
      expect(profile.salt).not.to.be.null;
      expect(profile.password).not.to.be.null;

      await validateLocalUser(
        username,
        password,
        (error: string, validUser: Express.User | false) => {
          expect(validUser).not.to.be.false;
          if (validUser) {
            expect(validUser.user_id).to.equal(username);
            expect(error).to.be.null;
          }
        }
      );

      await validateLocalUser(
        username,
        'not the password',
        (error: string, validUser: Express.User | false) => {
          expect(validUser).to.be.false;
          expect(error).to.be.null;
        }
      );
    } else {
      assert.fail('user is null after createUser with valid username');
    }
  });

  it('listing users for notebooks', async () => {
    await initialiseDatabases();

    const jsonText = fs.readFileSync(
      './notebooks/sample_notebook.json',
      'utf-8'
    );
    const {metadata, 'ui-specification': uiSpec} = JSON.parse(jsonText);
    const name = 'Test Notebook';
    const project_id = await createNotebook(name, uiSpec, metadata);
    const username = 'bobalooba';

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [user, error] = await createUser('', username);
    if (user && project_id) {
      addProjectRoleToUser(user, project_id, 'team');
      addProjectRoleToUser(user, project_id, 'moderator');
      await saveUser(user);

      const userInfo = await getUserInfoForNotebook(project_id);

      expect(userInfo.roles).to.include('admin');
      expect(userInfo.roles).to.include('moderator');
      expect(userInfo.roles).to.include('team');
      // should have the admin user and this new one
      expect(userInfo.users.length).to.equal(2);
      expect(userInfo.users[1].username).to.equal(username);
      expect(userInfo.users[1].roles[0].value).to.be.false;
    }
  });
});
