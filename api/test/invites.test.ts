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

import {ProjectUIModel} from '@faims3/data-model';
import PouchDB from 'pouchdb';
import {createNotebook} from '../src/couchdb/notebooks';
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
    const project_id = await createNotebook('Test Notebook', uispec, {});
    const role = 'user';

    if (project_id) {
      const invite = await createInvite(project_id, role);

      // check that it was saved - fetch from db
      const fetched = await getInvite(invite._id);

      if (fetched) {
        expect(fetched.project_id).to.equal(project_id);

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
      assert.fail('could not create notebook');
    }
  });

  it('will not duplicate an invite', async () => {
    const project_id = await createNotebook('Test Notebook', uispec, {});
    const role = 'user';

    if (project_id) {
      const invite1 = await createInvite(project_id, role);
      const invite2 = await createInvite(project_id, role);

      // check that it was saved - fetch from db
      expect(invite1._id).to.equal(invite2._id);
    } else {
      assert.fail('could not create notebook');
    }
  });
});
