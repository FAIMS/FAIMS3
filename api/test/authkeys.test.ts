// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: authkeys.test.ts
 * Description:
 *   Tests for authkeys handling
 */

import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
PouchDB.plugin(require('pouchdb-adapter-memory')); // enable memory adapter for testing
PouchDB.plugin(PouchDBFind);

import {addGlobalRole, Role} from '@faims3/data-model';
import {beforeEach, describe, expect, it} from 'vitest';
import {
  generateJwtFromUser,
  upgradeCouchUserToExpressUser,
} from '../src/auth/keySigning/create';
import {validateToken} from '../src/auth/keySigning/read';
import {keyService} from '../src/buildconfig';
import {createUser, saveExpressUser} from '../src/couchdb/users';
import {resetDatabases} from './mocks';

describe('roundtrip creating and reading token', () => {
  beforeEach(async () => {
    await resetDatabases();
  });

  it('create and read token', async () => {
    const username = 'bobalooba-the-great';
    const name = 'Bob Bobalooba';
    const roles: Role[] = [Role.GENERAL_ADMIN, Role.GENERAL_USER];
    const signing_key = await keyService.getSigningKey();

    // need to make a user with these details
    const [dbUser, err] = await createUser({username, name});

    if (!dbUser) {
      // create user failed
      throw new Error('Create user failed!. Error: ' + err);
    }

    // upgrade the user
    let user = await upgradeCouchUserToExpressUser({dbUser});

    for (let i = 0; i < roles.length; i++) {
      addGlobalRole({user, role: roles[i]});
    }
    await saveExpressUser(user);

    // Recompile permissions
    user = await upgradeCouchUserToExpressUser({dbUser});

    return generateJwtFromUser({user, signingKey: signing_key})
      .then(token => {
        return validateToken(token);
      })
      .then(valid_user => {
        expect(valid_user).not.toBeUndefined();
        if (valid_user) {
          expect(valid_user.user_id).toBe(user.user_id);
          expect(valid_user.globalRoles).toEqual(user.globalRoles);
          expect(valid_user.resourceRoles).toEqual(user.resourceRoles);
          expect(valid_user.name).toBe(user.name);
        }
      });
  });
});
