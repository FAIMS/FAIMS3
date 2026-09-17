// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: conductor.test.ts
 * Description:
 *   Tests of the main routes in conductor
 */

import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
PouchDB.plugin(require('pouchdb-adapter-memory')); // enable memory adapter for testing
PouchDB.plugin(PouchDBFind);

import {PostLoginInput} from '@faims3/data-model';
import {beforeEach, describe, expect, it} from 'vitest';
import request from 'supertest';
import {getAuthProviderConfig} from '../src/auth/strategies/applyStrategies';
import {config} from '../src/buildconfig';
import {app} from '../src/expressSetup';
import {beforeApiTests} from './utils';

const adminPassword = config.localCouchdbAuth
  ? config.localCouchdbAuth.password
  : '';

it('check is up', async () => {
  const result = await request(app).get('/up');
  expect(result.statusCode).toBe(200);
});

describe('Auth', () => {
  beforeEach(beforeApiTests);

  it('redirect to login', async () => {
    await request(app)
      .get('/')
      .expect(302)
      .expect('Location', /\/login/);
  });

  it('login returns HTML', async () => {
    await request(app)
      .get('/login')
      .expect(200)
      .expect('Content-Type', /text\/html/);
  });
  it('register returns HTML', async () => {
    await request(app)
      .get('/register')
      .expect(200)
      .expect('Content-Type', /text\/html/);
  });
  it('shows login page', async () => {
    // not if we don't have local auth configured
    const response = await request(app).get('/login').expect(200);
    expect(response.text).toContain('Sign in');
  });

  it('shows the configured login button(s)', async () => {
    const providers = getAuthProviderConfig();
    const response = await request(app).get('/login').expect(200);
    Object.values(providers || {}).forEach(provider => {
      if (providers) expect(response.text).toContain(provider.displayName);
    });
  });

  it('redirects with a token on login', async () => {
    // TODO: would like to test with this both enabled and disabled
    // but the way config works just now makes this difficult.
    if (!config.localLoginEnabled) {
      return;
    }
    const redirect = 'http://localhost:8080/';
    const response = await request(app)
      .post('/auth/local')
      .send({
        email: 'admin',
        password: adminPassword,
        action: 'login',
        redirect,
      } satisfies PostLoginInput)
      .expect(302);
    const location = new URL(response.header.location);
    expect(location.hostname).toBe('localhost');
    expect(location.search).toMatch(/exchangeToken/);
  });
});
