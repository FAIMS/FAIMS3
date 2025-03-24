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
PouchDB.plugin(require('pouchdb-adapter-memory')); // enable memory adapter for testing
import PouchDBFind from 'pouchdb-find';
PouchDB.plugin(PouchDBFind);

import {
  addLocalPasswordForUser,
  validateLocalUser,
} from '../src/auth_providers/local';
import {getUsersDB, initialiseDbAndKeys} from '../src/couchdb';
import {
  createUser,
  getUserInfoForProject,
  saveUser,
} from '../src/couchdb/users';
import {expect, assert} from 'chai';

import * as fs from 'fs';
import {createNotebook} from '../src/couchdb/notebooks';
import {
  Action,
  addGlobalRole,
  addResourceRole,
  removeGlobalRole,
  removeResourceRole,
  Resource,
  Role,
  userCanDo,
  userHasResourceRole,
  userResourceRoles,
} from '@faims3/data-model';

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
    const [newUserUsername, errorUsername] = await createUser({
      username,
      name: username,
    });
    expect(errorUsername).to.equal('');
    if (newUserUsername) {
      expect(newUserUsername.user_id).to.equal(username);
      expect(newUserUsername.emails.length).to.equal(0);
    } else {
      assert.fail('user is null after createUser with valid username');
    }

    const [newUserEmail, errorEmail] = await createUser({email, name: email});
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

    const [newUser, errorFirst] = await createUser({email, name: email});
    expect(errorFirst).to.equal('');
    if (newUser) {
      await saveUser(newUser);
      // now make another user with the same email
      const [anotherUser, errorSecond] = await createUser({email, name: email});
      expect(errorSecond).to.equal(`User with email '${email}' already exists`);
      expect(anotherUser).to.be.null;
    }
    const [newUserU, errorFirstU] = await createUser({
      username,
      name: username,
    });
    expect(errorFirstU).to.equal('');
    if (newUserU) {
      await saveUser(newUserU);
      // now make another user with the same email
      const [anotherUserU, errorSecondU] = await createUser({
        username,
        name: username,
      });
      expect(errorSecondU).to.equal(
        `User with username '${username}' already exists`
      );
      expect(anotherUserU).to.be.null;
    }

    const [newUserM, errorM] = await createUser({name: 'name'});
    expect(errorM).to.equal('At least one of username or email is required');
    expect(newUserM).to.be.null;
  });

  it('user roles', async () => {
    const email = 'BOBBY@here.com';
    const username = 'bobalooba';

    const [newUser, error] = await createUser({
      email,
      username,
      name: username,
    });
    expect(error).to.equal('');
    if (newUser !== null) {
      // add some global roles using Role enum
      addGlobalRole({user: newUser, role: Role.GENERAL_ADMIN});
      addGlobalRole({user: newUser, role: Role.GENERAL_CREATOR});

      // check that global roles have been updated
      expect(newUser.globalRoles.length).to.equal(3);
      expect(newUser.globalRoles).to.include(Role.GENERAL_USER);
      expect(newUser.globalRoles).to.include(Role.GENERAL_ADMIN);
      expect(newUser.globalRoles).to.include(Role.GENERAL_CREATOR);

      // add resource role
      addResourceRole({
        user: newUser,
        resourceId: 'important-project',
        role: Role.PROJECT_ADMIN,
      });

      // verify global roles remain unchanged
      expect(newUser.globalRoles.length).to.equal(3);
      expect(newUser.globalRoles).to.include(Role.GENERAL_USER);
      expect(newUser.globalRoles).to.include(Role.GENERAL_ADMIN);
      expect(newUser.globalRoles).to.include(Role.GENERAL_CREATOR);

      // verify resource role was added
      expect(newUser.resourceRoles.length).to.equal(1);
      expect(
        userHasResourceRole({
          user: newUser,
          resourceId: 'important-project',
          resourceRole: Role.PROJECT_ADMIN,
        })
      ).to.be.true;

      // Get all roles for the resource
      const projectRoles = userResourceRoles({
        user: newUser,
        resource: Resource.PROJECT,
        resourceId: 'important-project',
      });
      expect(projectRoles).to.include(Role.PROJECT_ADMIN);
      expect(projectRoles.length).to.equal(1);

      // add another resource role to the same project
      addResourceRole({
        user: newUser,
        resourceId: 'important-project',
        role: Role.PROJECT_MANAGER,
      });

      // verify both resource roles exist
      expect(newUser.resourceRoles.length).to.equal(2);
      expect(
        userHasResourceRole({
          user: newUser,
          resourceId: 'important-project',
          resourceRole: Role.PROJECT_ADMIN,
        })
      ).to.be.true;
      expect(
        userHasResourceRole({
          user: newUser,
          resourceId: 'important-project',
          resourceRole: Role.PROJECT_MANAGER,
        })
      ).to.be.true;

      // Get updated roles for the resource
      const updatedProjectRoles = userResourceRoles({
        user: newUser,
        resource: Resource.PROJECT,
        resourceId: 'important-project',
      });
      expect(updatedProjectRoles).to.include(Role.PROJECT_ADMIN);
      expect(updatedProjectRoles).to.include(Role.PROJECT_MANAGER);
      expect(updatedProjectRoles.length).to.equal(2);

      // doing it again should be a no-op
      const userBeforeRedundantAdd = {...newUser};
      addResourceRole({
        user: newUser,
        resourceId: 'important-project',
        role: Role.PROJECT_MANAGER,
      });
      expect(newUser).to.deep.equal(userBeforeRedundantAdd);

      addGlobalRole({user: newUser, role: Role.GENERAL_ADMIN});
      expect(newUser.globalRoles.length).to.equal(2);
      expect(newUser.resourceRoles.length).to.equal(2);

      // remove resource role
      removeResourceRole({
        user: newUser,
        resourceId: 'important-project',
        role: Role.PROJECT_ADMIN,
      });

      expect(
        userHasResourceRole({
          user: newUser,
          resourceId: 'important-project',
          resourceRole: Role.PROJECT_ADMIN,
        })
      ).to.be.false;

      expect(
        userHasResourceRole({
          user: newUser,
          resourceId: 'important-project',
          resourceRole: Role.PROJECT_MANAGER,
        })
      ).to.be.true;

      // remove global role
      removeGlobalRole({user: newUser, role: Role.GENERAL_ADMIN});
      expect(newUser.globalRoles.length).to.equal(1);
      expect(newUser.globalRoles).to.include(Role.GENERAL_CREATOR);
      expect(newUser.globalRoles).not.to.include(Role.GENERAL_ADMIN);

      // Check remaining resource role
      expect(
        userHasResourceRole({
          user: newUser,
          resourceId: 'important-project',
          resourceRole: Role.PROJECT_MANAGER,
        })
      ).to.be.true;

      // remove roles that aren't there should be harmless
      const userBeforeNonExistentRemoval = {...newUser};
      removeResourceRole({
        user: newUser,
        resourceId: 'important-project',
        role: Role.PROJECT_GUEST, // trying to remove a role that isn't assigned
      });
      expect(newUser).to.deep.equal(userBeforeNonExistentRemoval);

      removeGlobalRole({user: newUser, role: Role.GENERAL_USER}); // trying to remove a role that isn't assigned
      expect(newUser.globalRoles.length).to.equal(1);
      expect(newUser.globalRoles).to.include(Role.GENERAL_CREATOR);
    }
  });

  it('checking permissions', async () => {
    const email = 'BOBBY@here.com';
    const username = 'bobalooba';
    const project_id = 'myProject';
    const [user, error] = await createUser({email, username, name: username});
    expect(error).to.equal('');
    if (user) {
      // Use userCanDo with proper Action enums instead of the old userHasPermission
      expect(
        userCanDo({
          user,
          action: Action.READ_PROJECT_METADATA,
          resourceId: project_id,
        })
      ).to.be.false;

      expect(
        userCanDo({
          user,
          action: Action.UPDATE_PROJECT_DETAILS,
          resourceId: project_id,
        })
      ).to.be.false;

      // Add GENERAL_ADMIN role - this should grant all permissions
      addGlobalRole({user, role: Role.GENERAL_ADMIN});

      // Now user should have read/modify permissions for all projects
      expect(
        userCanDo({
          user,
          action: Action.READ_PROJECT_METADATA,
          resourceId: project_id,
        })
      ).to.be.true;

      expect(
        userCanDo({
          user,
          action: Action.UPDATE_PROJECT_DETAILS,
          resourceId: project_id,
        })
      ).to.be.true;

      // Remove the admin role
      removeGlobalRole({user, role: Role.GENERAL_ADMIN});

      // Add PROJECT_GUEST role (similar to old 'user' role) for specific project
      addResourceRole({
        user,
        resourceId: project_id,
        role: Role.PROJECT_GUEST,
      });

      // Should have read but not modify permission for this project
      expect(
        userCanDo({
          user,
          action: Action.READ_PROJECT_METADATA,
          resourceId: project_id,
        })
      ).to.be.true;

      expect(
        userCanDo({
          user,
          action: Action.UPDATE_PROJECT_DETAILS,
          resourceId: project_id,
        })
      ).to.be.false;

      // But can't access another project
      expect(
        userCanDo({
          user,
          action: Action.READ_PROJECT_METADATA,
          resourceId: 'anotherProject',
        })
      ).to.be.false;

      expect(
        userCanDo({
          user,
          action: Action.UPDATE_PROJECT_DETAILS,
          resourceId: 'anotherProject',
        })
      ).to.be.false;

      // Give them PROJECT_ADMIN permission for the project
      addResourceRole({
        user,
        resourceId: project_id,
        role: Role.PROJECT_ADMIN,
      });

      // Now should have full permissions for this project
      expect(
        userCanDo({
          user,
          action: Action.READ_PROJECT_METADATA,
          resourceId: project_id,
        })
      ).to.be.true;

      expect(
        userCanDo({
          user,
          action: Action.UPDATE_PROJECT_DETAILS,
          resourceId: project_id,
        })
      ).to.be.true;
    }
  });

  it('add local password', async () => {
    const username = 'bobalooba';
    const password = 'verysecret';
    const [user, error] = await createUser({username, name: username});
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
    await initialiseDbAndKeys({force: false});

    const jsonText = fs.readFileSync(
      './notebooks/sample_notebook.json',
      'utf-8'
    );
    const {metadata, 'ui-specification': uiSpec} = JSON.parse(jsonText);
    const name = 'Test Notebook';
    const project_id = await createNotebook(name, uiSpec, metadata);
    const username = 'bobalooba';

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [user, error] = await createUser({username, name: username});
    if (user && project_id) {
      addResourceRole({
        user,
        resourceId: project_id,
        role: Role.PROJECT_CONTRIBUTOR,
      });
      addResourceRole({
        user,
        resourceId: project_id,
        role: Role.PROJECT_MANAGER,
      });
      await saveUser(user);

      const userInfo = await getUserInfoForProject({projectId: project_id});

      expect(userInfo.roles).to.include(Role.PROJECT_ADMIN);
      expect(userInfo.roles).to.include(Role.PROJECT_MANAGER);
      expect(userInfo.roles).to.include(Role.PROJECT_CONTRIBUTOR);
      // should have the admin user and this new one
      expect(userInfo.users.length).to.equal(2);
      expect(userInfo.users[1].username).to.equal(username);
      expect(userInfo.users[1].roles[0].value).to.be.false;
    }
  });
});
