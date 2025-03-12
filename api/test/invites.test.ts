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

import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
PouchDB.plugin(PouchDBFind);
PouchDB.plugin(require('pouchdb-adapter-memory')); // enable memory adapter for testing

import {EncodedProjectUIModel} from '@faims3/data-model';
import {createNotebook} from '../src/couchdb/notebooks';
import {
  createInvite,
  deleteInvite,
  getInvite,
  getInvitesForNotebook,
} from '../src/couchdb/invites';
import {initialiseDatabases} from '../src/couchdb';
import request from 'supertest';
import {app} from '../src/routes';
import {expect, assert} from 'chai';

const uispec: EncodedProjectUIModel = {
  _id: '',
  fields: [],
  fviews: {},
  viewsets: {},
  visible_types: [],
};

describe('Invites', () => {
  beforeEach(async () => {
    await initialiseDatabases({});
  });

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

describe('Registration', () => {
  it('redirects with a token on registration', async () => {
    const payload = {
      email: 'bob@here.com',
      password: 'bobbyTables',
      repeat: 'bobbyTables',
      name: 'Bob Bobalooba',
      redirect: 'http://redirect.org/',
    };

    const project_id = await createNotebook('Test Notebook', uispec, {});
    const role = 'user';

    if (project_id) {
      const invite = await createInvite(project_id, role);
      const code = invite._id;

      const agent = request.agent(app);

      await agent
        .get(`/register/${code}?redirect=${payload.redirect}`)
        .expect(200);

      return agent
        .post('/register/local/')
        .send(payload)
        .expect(302)
        .then(response => {
          // this would be an error condition, redirect to home
          expect(response.header.location[0]).not.to.equal('/');
          // check correct redirect
          const location = new URL(response.header.location);
          expect(location.hostname).to.equal('redirect.org');
          expect(location.search).to.match(/token/);
        });
    }
  });
});
