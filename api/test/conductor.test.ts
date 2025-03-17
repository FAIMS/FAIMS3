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
 * Filename: conductor.test.ts
 * Description:
 *   Tests of the main routes in conductor
 */

import PouchDB from 'pouchdb';
PouchDB.plugin(require('pouchdb-adapter-memory')); // enable memory adapter for testing
import PouchDBFind from 'pouchdb-find';
PouchDB.plugin(PouchDBFind);

import {expect} from 'chai';
import fs from 'fs';
import request from 'supertest';
import {CONDUCTOR_AUTH_PROVIDERS, LOCAL_COUCHDB_AUTH} from '../src/buildconfig';
import {createNotebook} from '../src/couchdb/notebooks';
import {app} from '../src/routes';
import {beforeApiTests} from './utils';

it('check is up', async () => {
  const result = await request(app).get('/up');
  expect(result.statusCode).to.equal(200);
});

const localUserName = 'bobalooba';
const localUserPassword = 'bobalooba';
const adminPassword = LOCAL_COUCHDB_AUTH ? LOCAL_COUCHDB_AUTH.password : '';

const notebookUser = 'notebook';
const notebookPassword = 'notebook';

describe('Auth', () => {
  beforeEach(beforeApiTests);

  it('redirect to auth', done => {
    request(app)
      .get('/')
      .expect(302)
      .expect('Location', /\/auth/, done);
  });

  it('auth returns HTML', done => {
    request(app)
      .get('/auth')
      .expect(200)
      .expect('Content-Type', /text\/html/, done);
  });

  it('shows local login form', done => {
    request(app)
      .get('/auth')
      .expect(200)
      .then(response => {
        expect(response.text).to.include('Welcome');
        done();
      });
  });

  it('shows the configured login button(s)', done => {
    request(app)
      .get('/auth')
      .expect(200)
      .then(response => {
        CONDUCTOR_AUTH_PROVIDERS.forEach((provider: string) => {
          expect(response.text).to.include(provider);
        });
        done();
      });
  });

  it('redirects with a token on login', done => {
    const redirect = 'http://redirect.org/';
    request(app)
      .post(`/auth/local/?redirect=${redirect}`)
      .send({username: 'admin', password: adminPassword})
      .expect(302)
      .then(response => {
        const location = new URL(response.header.location);
        expect(location.hostname).to.equal('redirect.org');
        expect(location.search).to.match(/token/);
        done();
      });
  });
});

describe('Pages', () => {
  beforeEach(beforeApiTests);

  it('shows the notebooks page', async () => {
    const filename = 'notebooks/sample_notebook.json';
    const jsonText = fs.readFileSync(filename, 'utf-8');
    const {metadata, 'ui-specification': uiSpec} = JSON.parse(jsonText);

    await createNotebook('test-notebook', uiSpec, metadata);
    const agent = request.agent(app);

    await agent
      .post('/auth/local/')
      .send({username: 'admin', password: adminPassword})
      .expect(302);

    await agent
      .get('/notebooks/')
      .expect(200)
      .then(response => {
        expect(response.text).to.include('test-notebook');
        expect(response.text).to.include('New Notebook');
      });
  });

  it("doesn't show the notebooks page when not logged in", async () => {
    const agent = request.agent(app);
    // expect a redirect to login
    await agent.get('/notebooks/').expect(302);
  });

  it('shows the add notebook option for a notebook-creater user', async () => {
    const agent = request.agent(app);

    await agent
      .post('/auth/local/')
      .send({username: notebookUser, password: notebookPassword})
      .expect(302);

    await agent
      .get('/notebooks/')
      .expect(200)
      .then(response => {
        expect(response.text).to.include('New Notebook');
      });
  });

  it("doesn't show the add notebook option for a regular user", async () => {
    const agent = request.agent(app);

    await agent
      .post('/auth/local/')
      .send({username: localUserName, password: localUserPassword})
      .expect(302);

    await agent
      .get('/notebooks/')
      .expect(200)
      .then(response => {
        expect(response.text).not.to.include('Upload a Notebook');
      });
  });

  it('shows page for one notebook', async () => {
    const filename = 'notebooks/sample_notebook.json';
    const jsonText = fs.readFileSync(filename, 'utf-8');
    const {metadata, 'ui-specification': uiSpec} = JSON.parse(jsonText);

    const project_id = await createNotebook('test-notebook', uiSpec, metadata);
    const agent = request.agent(app);

    await agent
      .post('/auth/local/')
      .send({username: 'admin', password: adminPassword})
      .expect(302);

    await agent
      .get(`/notebooks/${project_id}/`)
      .expect(200)
      .then(response => {
        expect(response.text).to.include('test-notebook');
      });
  });

  it('shows notebook users page for admin user', async () => {
    const filename = 'notebooks/sample_notebook.json';
    const jsonText = fs.readFileSync(filename, 'utf-8');
    const {metadata, 'ui-specification': uiSpec} = JSON.parse(jsonText);

    const project_id = await createNotebook('test-notebook', uiSpec, metadata);
    const agent = request.agent(app);

    await agent
      .post('/auth/local/')
      .send({username: 'admin', password: adminPassword})
      .expect(302);

    await agent
      .get(`/notebooks/${project_id}/users`)
      .expect(200)
      .then(response => {
        expect(response.text).to.include('admin');
      });
  });

  it('get home page logged in', async () => {
    const filename = 'notebooks/sample_notebook.json';
    const jsonText = fs.readFileSync(filename, 'utf-8');
    const {metadata, 'ui-specification': uiSpec} = JSON.parse(jsonText);

    await createNotebook('test-notebook', uiSpec, metadata);
    const agent = request.agent(app);

    await agent
      .post('/auth/local/')
      .send({username: 'admin', password: adminPassword})
      .expect(302);

    await agent
      .get('/')
      .expect(200)
      .then(response => {
        expect(response.text).to.include('Admin User');
      });
  });

  it('shows users page for admin user', async () => {
    const agent = request.agent(app);

    await agent
      .post('/auth/local/')
      .send({username: 'admin', password: adminPassword})
      .expect(302);

    await agent
      .get('/users')
      .expect(200)
      .then(response => {
        expect(response.text).to.include('admin');
      });
  });

  it('does not show the users page for regular user', async () => {
    const agent = request.agent(app);

    await agent
      .post('/auth/local/')
      .send({username: localUserName, password: localUserPassword})
      .expect(302);

    await agent.get('/users').expect(401);
  });

  it('shows templates page for admin user', async () => {
    const agent = request.agent(app);

    await agent
      .post('/auth/local/')
      .send({username: 'admin', password: adminPassword})
      .expect(302);

    await agent
      .get('/templates')
      .expect(200)
      .then(response => {
        expect(response.text).to.include('Admin User');
      });
  });

  it('does not show the templates page for regular user', async () => {
    const agent = request.agent(app);

    await agent
      .post('/auth/local/')
      .send({username: localUserName, password: localUserPassword})
      .expect(302);

    await agent.get('/templates').expect(401);
  });
});
