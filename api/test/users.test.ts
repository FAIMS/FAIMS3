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
import PouchDBFind from 'pouchdb-find';
PouchDB.plugin(require('pouchdb-adapter-memory')); // enable memory adapter for testing
PouchDB.plugin(PouchDBFind);

import {
  Action,
  addGlobalRole,
  addProjectRole,
  couchInitialiser,
  initPeopleDB,
  removeGlobalRole,
  removeProjectRole,
  Role,
  userHasProjectRole,
  userProjectRoles,
} from '@faims3/data-model';
import {beforeEach, describe, expect, it} from 'vitest';
import {addLocalPasswordForUser} from '../src/auth/helpers';
import {upgradeCouchUserToExpressUser} from '../src/auth/keySigning/create';
import {validateLocalUser} from '../src/auth/strategies/localStrategy';
import {getUsersDB, initialiseDbAndKeys} from '../src/couchdb';
import {
  createUser,
  getUserInfoForProject,
  registerAdminUser,
  saveCouchUser,
} from '../src/couchdb/users';
import {userCanDo} from '../src/middleware';
import {createNotebookFromSampleFile} from './sampleNotebook';

const clearUsers = async () => {
  const usersDB = getUsersDB();
  await couchInitialiser({
    db: usersDB,
    content: initPeopleDB({}),
    config: {applyPermissions: false, forceWrite: true},
  });

  if (usersDB) {
    const docs = await usersDB.allDocs();
    for (let i = 0; i < docs.rows.length; i++) {
      // don't delete design docs!
      if (docs.rows[i].id.startsWith('_')) {
        continue;
      }
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
    expect(errorUsername).toBe('');
    if (newUserUsername) {
      expect(newUserUsername.user_id).toBe(username);
      expect(newUserUsername.emails.length).toBe(0);
    } else {
      expect.fail('user is null after createUser with valid username');
    }

    const [newUserEmail, errorEmail] = await createUser({email, name: email});
    expect(errorEmail).toBe('');
    if (newUserEmail) {
      expect(newUserEmail.user_id).not.toBe('');
      expect(newUserEmail.emails.map(e => e.email)).toContain(
        email.toLowerCase()
      );
    } else {
      expect.fail('user is null after createUser with valid email');
    }
  });

  it('create user - duplicates and missing', async () => {
    const email = 'BOBBY@here.com';
    const username = 'bobalooba';

    const [newUser, errorFirst] = await createUser({email, name: email});
    expect(errorFirst).toBe('');
    if (newUser) {
      await saveCouchUser(newUser);
      // now make another user with the same email
      const [anotherUser, errorSecond] = await createUser({email, name: email});
      expect(errorSecond).toBe(`User with email '${email}' already exists`);
      expect(anotherUser).toBeNull();
    }
    const [newUserU, errorFirstU] = await createUser({
      username,
      name: username,
    });
    expect(errorFirstU).toBe('');
    if (newUserU) {
      await saveCouchUser(newUserU);
      // now make another user with the same email
      const [anotherUserU, errorSecondU] = await createUser({
        username,
        name: username,
      });
      expect(errorSecondU).toBe(
        `User with username '${username}' already exists`
      );
      expect(anotherUserU).toBeNull();
    }

    const [newUserM, errorM] = await createUser({name: 'name'});
    expect(errorM).toBe('At least one of username or email is required');
    expect(newUserM).toBeNull();
  });

  it('user roles', async () => {
    const email = 'BOBBY@here.com';
    const username = 'bobalooba';

    const [newUser, error] = await createUser({
      email,
      username,
      name: username,
    });
    expect(error).toBe('');
    if (newUser !== null) {
      // add some global roles using Role enum
      addGlobalRole({user: newUser, role: Role.GENERAL_ADMIN});
      addGlobalRole({user: newUser, role: Role.GENERAL_CREATOR});

      // check that global roles have been updated
      expect(newUser.globalRoles.length).toBe(3);
      expect(newUser.globalRoles).toContain(Role.GENERAL_USER);
      expect(newUser.globalRoles).toContain(Role.GENERAL_ADMIN);
      expect(newUser.globalRoles).toContain(Role.GENERAL_CREATOR);

      // add resource role
      addProjectRole({
        user: newUser,
        projectId: 'important-project',
        role: Role.PROJECT_ADMIN,
      });

      // verify global roles remain unchanged
      expect(newUser.globalRoles.length).toBe(3);
      expect(newUser.globalRoles).toContain(Role.GENERAL_USER);
      expect(newUser.globalRoles).toContain(Role.GENERAL_ADMIN);
      expect(newUser.globalRoles).toContain(Role.GENERAL_CREATOR);

      // verify resource role was added
      expect(newUser.projectRoles.length).toBe(1);
      expect(
        userHasProjectRole({
          user: newUser,
          projectId: 'important-project',
          role: Role.PROJECT_ADMIN,
        })
      ).toBe(true);

      // Get all roles for the resource
      const projectRoles = userProjectRoles({
        user: newUser,
        projectId: 'important-project',
      });
      expect(projectRoles).toContain(Role.PROJECT_ADMIN);
      // These are not drilled explicitly anymore
      expect(projectRoles.length).toBe(1);

      addGlobalRole({user: newUser, role: Role.GENERAL_ADMIN});
      expect(newUser.globalRoles.length).toBe(3);
      expect(newUser.projectRoles.length).toBe(1);

      // remove resource role
      removeProjectRole({
        user: newUser,
        projectId: 'important-project',
        role: Role.PROJECT_ADMIN,
      });

      // Still true due to general admin
      // This asks "does this user explicitly have this role" so does not drill!
      expect(
        userHasProjectRole({
          user: newUser,
          projectId: 'important-project',
          role: Role.PROJECT_ADMIN,
        })
      ).toBe(false);

      // remove global role
      removeGlobalRole({user: newUser, role: Role.GENERAL_ADMIN});
      expect(newUser.globalRoles.length).toBe(2);
      expect(newUser.globalRoles).toContain(Role.GENERAL_CREATOR);
      expect(newUser.globalRoles).toContain(Role.GENERAL_USER);

      // remove roles that aren't there should be harmless
      const userBeforeNonExistentRemoval = {...newUser};
      removeProjectRole({
        user: newUser,
        projectId: 'important-project',
        role: Role.PROJECT_GUEST, // trying to remove a role that isn't assigned
      });
      expect(newUser).toEqual(userBeforeNonExistentRemoval);
    }
  });

  it('checking permissions', async () => {
    const email = 'BOBBY@here.com';
    const username = 'bobalooba';
    const project_id = 'myProject';
    const [dbUser, error] = await createUser({email, username, name: username});
    if (!dbUser) {
      throw new Error('Failed to create user! Error: ' + error);
    }
    let user = await upgradeCouchUserToExpressUser({dbUser});

    // Use userCanDo with proper Action enums instead of the old userHasPermission
    expect(
      userCanDo({
        user,
        action: Action.READ_PROJECT_METADATA,
        resourceId: project_id,
      })
    ).toBe(false);

    expect(
      userCanDo({
        user,
        action: Action.UPDATE_PROJECT_DETAILS,
        resourceId: project_id,
      })
    ).toBe(false);

    // Now user should have read/modify permissions for all projects
    // Add GENERAL_ADMIN role - this should grant all permissions
    addGlobalRole({user, role: Role.GENERAL_ADMIN});
    // Now user should have read/modify permissions for all projects

    // Recompile permissions
    user = await upgradeCouchUserToExpressUser({dbUser: user});

    // Now user should have read/modify permissions for all projects
    expect(
      userCanDo({
        user,
        action: Action.READ_PROJECT_METADATA,
        resourceId: project_id,
      })
    ).toBe(true);

    expect(
      userCanDo({
        user,
        action: Action.UPDATE_PROJECT_DETAILS,
        resourceId: project_id,
      })
    ).toBe(true);

    // Remove the admin role
    removeGlobalRole({user, role: Role.GENERAL_ADMIN});

    // Add PROJECT_GUEST role (similar to old 'user' role) for specific project
    addProjectRole({
      user,
      projectId: project_id,
      role: Role.PROJECT_GUEST,
    });
    // Recompile permissions
    user = await upgradeCouchUserToExpressUser({dbUser: user});

    // Should have read but not modify permission for this project
    expect(
      userCanDo({
        user,
        action: Action.READ_PROJECT_METADATA,
        resourceId: project_id,
      })
    ).toBe(true);

    expect(
      userCanDo({
        user,
        action: Action.UPDATE_PROJECT_DETAILS,
        resourceId: project_id,
      })
    ).toBe(false);

    // But can't access another project
    expect(
      userCanDo({
        user,
        action: Action.READ_PROJECT_METADATA,
        resourceId: 'anotherProject',
      })
    ).toBe(false);

    expect(
      userCanDo({
        user,
        action: Action.UPDATE_PROJECT_DETAILS,
        resourceId: 'anotherProject',
      })
    ).toBe(false);

    // Give them PROJECT_ADMIN permission for the project
    addProjectRole({
      user,
      projectId: project_id,
      role: Role.PROJECT_ADMIN,
    });

    // Recompile permissions
    user = await upgradeCouchUserToExpressUser({dbUser: user});

    // Now should have full permissions for this project
    expect(
      userCanDo({
        user,
        action: Action.READ_PROJECT_METADATA,
        resourceId: project_id,
      })
    ).toBe(true);

    expect(
      userCanDo({
        user,
        action: Action.UPDATE_PROJECT_DETAILS,
        resourceId: project_id,
      })
    ).toBe(true);
  });

  it('add local password', async () => {
    const username = 'bobalooba';
    const password = 'verysecret';
    const [user, error] = await createUser({username, name: username});
    expect(error).toBe('');
    if (user) {
      await addLocalPasswordForUser(user, password);
      const profile = user.profiles['local'] as any; // really LocalProfile
      expect(profile).not.toBeUndefined();
      expect(profile.salt).not.toBeNull();
      expect(profile.password).not.toBeNull();

      await new Promise<void>((resolve, reject) => {
        validateLocalUser(username, password, (error, validUser) => {
          try {
            expect(validUser).not.toBe(false);
            if (validUser) {
              expect(validUser.user_id).toBe(username);
              expect(error).toBeNull();
            }
            resolve();
          } catch (e) {
            reject(e);
          }
        });
      });

      await new Promise<void>((resolve, reject) => {
        validateLocalUser(username, 'wrong', (error, validUser) => {
          try {
            expect(validUser).toBe(false);
            expect(error).toBe('Username or password incorrect.');
            resolve();
          } catch (e) {
            reject(e);
          }
        });
      });
    } else {
      expect.fail('user is null after createUser with valid username');
    }
  });

  it('listing users for notebooks', async () => {
    await initialiseDbAndKeys({force: false});
    await registerAdminUser();

    const project_id = await createNotebookFromSampleFile('Test Notebook');
    const username = 'bobalooba';

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [user, error] = await createUser({username, name: username});
    if (user && project_id) {
      addProjectRole({
        user,
        projectId: project_id,
        role: Role.PROJECT_CONTRIBUTOR,
      });
      addProjectRole({
        user,
        projectId: project_id,
        role: Role.PROJECT_MANAGER,
      });
      await saveCouchUser(user);

      const projectUserInfo = await getUserInfoForProject({
        projectId: project_id,
      });

      expect(projectUserInfo.roles).toContain(Role.PROJECT_ADMIN);
      expect(projectUserInfo.roles).toContain(Role.PROJECT_MANAGER);
      expect(projectUserInfo.roles).toContain(Role.PROJECT_CONTRIBUTOR);
      // should have the admin user and this new one
      expect(projectUserInfo.users.length).toBe(2);
      expect(projectUserInfo.users[1].username).toBe(username);
      expect(projectUserInfo.users[1].roles[0].value).toBe(false);
    }
  });
});
