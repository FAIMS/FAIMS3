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
import PouchDBFind from 'pouchdb-find';
PouchDB.plugin(require('pouchdb-adapter-memory')); // enable memory adapter for testing
PouchDB.plugin(PouchDBFind);

import {expect} from 'chai';
import request from 'supertest';
import {LOCAL_COUCHDB_AUTH} from '../src/buildconfig';
import {app} from '../src/expressSetup';
import {beforeApiTests} from './utils';
import {PostLoginInput} from '@faims3/data-model';
import {get} from 'http';
import {getAuthProviderConfig} from '../src/auth/strategies/applyStrategies';

const adminPassword = LOCAL_COUCHDB_AUTH ? LOCAL_COUCHDB_AUTH.password : '';

it('check is up', async () => {
  const result = await request(app).get('/up');
  expect(result.statusCode).to.equal(200);
});

describe('Auth', () => {
  beforeEach(beforeApiTests);

  it('redirect to login', done => {
    request(app)
      .get('/')
      .expect(302)
      .expect('Location', /\/login/, done);
  });

  it('login returns HTML', done => {
    request(app)
      .get('/login')
      .expect(200)
      .expect('Content-Type', /text\/html/, done);
  });
  it('register returns HTML', done => {
    request(app)
      .get('/register')
      .expect(200)
      .expect('Content-Type', /text\/html/, done);
  });
  it('shows local login form', done => {
    request(app)
      .get('/login')
      .expect(200)
      .then(response => {
        expect(response.text).to.include('Welcome');
        done();
      });
  });

  it('shows the configured login button(s)', done => {
    const providers = getAuthProviderConfig();
    request(app)
      .get('/login')
      .expect(200)
      .then(response => {
        Object.values(providers || {}).forEach(provider => {
          if (providers) expect(response.text).to.include(provider.displayName);
        });
        done();
      });
  });

  it('redirects with a token on login', done => {
    const redirect = 'http://localhost:8080/';
    request(app)
      .post('/auth/local')
      .send({
        email: 'admin',
        password: adminPassword,
        action: 'login',
        redirect,
      } satisfies PostLoginInput)
      .expect(302)
      .then(response => {
        const location = new URL(response.header.location);
        expect(location.hostname).to.equal('localhost');
        expect(location.search).to.match(/exchangeToken/);
        done();
      });
  });
});
