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
PouchDB.plugin(require('pouchdb-adapter-memory')); // enable memory adapter for testing
PouchDB.plugin(require('pouchdb-find'));

import {createAuthKey} from '../src/authkeys/create';
import {validateToken} from '../src/authkeys/read';
import {getSigningKey} from '../src/authkeys/signing_keys';
import {addOtherRoleToUser, createUser, saveUser} from '../src/couchdb/users';
import {expect} from 'chai';

describe('roundtrip creating and reading token', () => {
  it('create and read token', async () => {
    const username = 'bobalooba';
    const name = 'Bob Bobalooba';
    const roles = ['admin', 'user'];
    const signing_key = await getSigningKey();

    // need to make a user with these details
    const [user, err] = await createUser(username, '');

    if (user) {
      user.name = name;
      for (let i = 0; i < roles.length; i++) {
        addOtherRoleToUser(user, roles[i]);
      }
      await saveUser(user);

      return createAuthKey(user, signing_key)
        .then(token => {
          return validateToken(token);
        })
        .then(valid_user => {
          expect(valid_user).not.to.be.undefined;
          if (valid_user) {
            expect(valid_user.user_id).to.equal(user.user_id);
            expect(valid_user.roles).to.deep.equal(user.roles);
            expect(valid_user.name).to.equal(user.name);
          }
        });
    } else {
      console.error(err);
    }
  });
});
