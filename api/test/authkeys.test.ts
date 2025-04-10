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
 * Filename: authkeys.test.ts
 * Description:
 *   Tests for authkeys handling
 */

import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
PouchDB.plugin(require('pouchdb-adapter-memory')); // enable memory adapter for testing
PouchDB.plugin(PouchDBFind);

import {addGlobalRole, Role} from '@faims3/data-model';
import {expect} from 'chai';
import {
  generateJwtFromUser,
  upgradeCouchUserToExpressUser,
} from '../src/auth/keySigning/create';
import {validateToken} from '../src/auth/keySigning/read';
import {KEY_SERVICE} from '../src/buildconfig';
import {createUser, saveExpressUser} from '../src/couchdb/users';

describe('roundtrip creating and reading token', () => {
  it('create and read token', async () => {
    const username = 'bobalooba-the-great';
    const name = 'Bob Bobalooba';
    const roles: Role[] = [Role.GENERAL_ADMIN, Role.GENERAL_USER];
    const signing_key = await KEY_SERVICE.getSigningKey();

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
        expect(valid_user).not.to.be.undefined;
        if (valid_user) {
          expect(valid_user.user_id).to.equal(user.user_id);
          expect(valid_user.globalRoles).to.deep.equal(user.globalRoles);
          expect(valid_user.resourceRoles).to.deep.equal(user.resourceRoles);
          expect(valid_user.name).to.equal(user.name);
        }
      });
  });
});
