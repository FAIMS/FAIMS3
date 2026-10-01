// SPDX-License-Identifier: Apache-2.0
import {describe, expect, it} from 'vitest';
import request from 'supertest';
import {attachFullApi} from '../src/expressSetup';
import {createHealthApp} from '../src/healthApp';

describe('health-only app', () => {
  const app = createHealthApp();

  it('GET /health is 200 without Couch', async () => {
    const result = await request(app).get('/health');
    expect(result.statusCode).toBe(200);
    expect(result.body).toEqual({status: 'ok'});
  });

  it('deprecated GET / is 200 without Couch', async () => {
    const result = await request(app).get('/');
    expect(result.statusCode).toBe(200);
    expect(result.body).toEqual({status: 'ok'});
  });

  it('does not register API routes', async () => {
    const result = await request(app).get('/api/notebooks');
    expect(result.statusCode).toBe(404);
  });

  it('does not register /up/', async () => {
    const result = await request(app).get('/up/');
    expect(result.statusCode).toBe(404);
  });
});

describe('health-only then attachFullApi', () => {
  it('GET / is liveness, then the same app redirects to /login; /health stays 200', async () => {
    const app = createHealthApp();

    const rootBefore = await request(app).get('/');
    expect(rootBefore.statusCode).toBe(200);
    expect(rootBefore.body).toEqual({status: 'ok'});

    const healthBefore = await request(app).get('/health');
    expect(healthBefore.statusCode).toBe(200);
    expect(healthBefore.body).toEqual({status: 'ok'});

    attachFullApi(app);

    const rootAfter = await request(app).get('/');
    expect(rootAfter.statusCode).toBe(302);
    expect(rootAfter.headers.location).toMatch(/\/login/);
    expect(rootAfter.body).not.toEqual({status: 'ok'});

    const healthAfter = await request(app).get('/health');
    expect(healthAfter.statusCode).toBe(200);
    expect(healthAfter.body).toEqual({status: 'ok'});

    const upAfter = await request(app).get('/up/');
    expect(upAfter.statusCode).toBe(200);
    expect(upAfter.body).toEqual({up: 'true'});
  });
});
