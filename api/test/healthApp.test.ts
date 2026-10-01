// SPDX-License-Identifier: Apache-2.0
import {describe, expect, it} from 'vitest';
import request from 'supertest';
import {attachFullApi} from '../src/expressSetup';
import {createHealthApp} from '../src/healthApp';

describe('health-only app', () => {
  const app = createHealthApp();

  it('GET /up is 200 without Couch', async () => {
    const result = await request(app).get('/up');
    expect(result.statusCode).toBe(200);
    expect(result.body).toEqual({status: 'ok'});
  });

  it('does not register GET / as liveness', async () => {
    const result = await request(app).get('/');
    expect(result.statusCode).toBe(404);
  });

  it('does not register API routes', async () => {
    const result = await request(app).get('/api/notebooks');
    expect(result.statusCode).toBe(404);
  });

  it('does not register /health or /ready', async () => {
    expect((await request(app).get('/health')).statusCode).toBe(404);
    expect((await request(app).get('/ready')).statusCode).toBe(404);
  });
});

describe('health-only then attachFullApi', () => {
  it('GET /up stays liveness; GET / is login after attach; /ready appears then', async () => {
    const app = createHealthApp();

    const rootBefore = await request(app).get('/');
    expect(rootBefore.statusCode).toBe(404);

    const upBefore = await request(app).get('/up');
    expect(upBefore.statusCode).toBe(200);
    expect(upBefore.body).toEqual({status: 'ok'});

    expect((await request(app).get('/ready')).statusCode).toBe(404);

    attachFullApi(app);

    const rootAfter = await request(app).get('/');
    expect(rootAfter.statusCode).toBe(302);
    expect(rootAfter.headers.location).toMatch(/\/login/);

    const upAfter = await request(app).get('/up');
    expect(upAfter.statusCode).toBe(200);
    expect(upAfter.body).toEqual({status: 'ok'});

    const readyAfter = await request(app).get('/ready');
    expect(readyAfter.statusCode).toBe(200);
    expect(readyAfter.body).toEqual({ready: true});
  });
});
