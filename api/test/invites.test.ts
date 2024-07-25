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
 * Filename: invites.tests.ts
 * Description:
 *   Tests for invite handling
 */

import {ProjectUIModel} from 'faims3-datamodel';
import PouchDB from 'pouchdb';
import {createNotebook} from '../src/couchdb/notebooks';
import {getUserFromEmailOrUsername} from '../src/couchdb/users';
import {
  createInvite,
  deleteInvite,
  getInvite,
  getInvitesForNotebook,
} from '../src/couchdb/invites';
import {initialiseDatabases} from '../src/couchdb';

PouchDB.plugin(require('pouchdb-adapter-memory')); // enable memory adapter for testing
PouchDB.plugin(require('pouchdb-find'));
import {expect, assert} from 'chai';

const uispec: ProjectUIModel = {
  fields: [],
  views: {},
  viewsets: {},
  visible_types: [],
};

describe('Invites', () => {
  beforeEach(initialiseDatabases);

  it('create invite', async () => {
    const adminUser = await getUserFromEmailOrUsername('admin');
    const project_id = await createNotebook('Test Notebook', uispec, {});
    const role = 'user';
    const number = 10;

    if (adminUser && project_id) {
      const invite = await createInvite(adminUser, project_id, role, number);

      // check that it was saved - fetch from db
      const fetched = await getInvite(invite._id);

      if (fetched) {
        expect(fetched.project_id).to.equal(project_id);
        expect(fetched.number).to.equal(number);

        // get invites for notebook
        const invites = await getInvitesForNotebook(project_id);
        expect(invites.length).to.equal(1);

        // and now delete it
        const deleted = await deleteInvite(fetched);
        expect(deleted._deleted).to.be.true;
      } else {
        assert.fail('could not retrieve newly created invite');
      }
    } else {
      assert.fail('could not get admin user');
    }
  });

  it('create unlimited invite', async () => {
    const adminUser = await getUserFromEmailOrUsername('admin');
    const project_id = await createNotebook('Test Notebook', uispec, {});
    const role = 'user';
    const number = 0;

    if (adminUser && project_id) {
      const invite = await createInvite(adminUser, project_id, role, number);

      // check that it was saved - fetch from db
      const fetched = await getInvite(invite._id);

      if (fetched) {
        expect(fetched.project_id).to.equal(project_id);
        expect(fetched.unlimited).to.be.true;
      } else {
        assert.fail('could not retrieve newly created invite');
      }
    } else {
      assert.fail('could not get admin user');
    }
  });
});
