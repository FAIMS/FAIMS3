import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
PouchDB.plugin(PouchDBFind);
PouchDB.plugin(require('pouchdb-adapter-memory'));

import {registerClient} from '@faims3/data-model';
import {Request} from 'express';
import request from 'supertest';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {
  config,
  DEFAULT_EXPORT_RATE_LIMITER_PER_WINDOW,
} from '../src/buildconfig';
import {restoreFromBackup} from '../src/couchdb/backupRestore';
import {
  EXPORT_RATE_LIMITER,
  exportRateLimitKey,
} from '../src/exportRateLimiter';
import {app} from '../src/expressSetup';
import {callbackObject} from './mocks';
import {beforeApiTests, requestAuthAndType} from './utils';

registerClient(callbackObject);

const PROJECT_ID = '1693291182736-campus-survey-demo';
const EXPORT_PATH = `/api/notebooks/${PROJECT_ID}/records/export?viewID=FORM2&format=csv`;

describe('exportRateLimitKey', () => {
  it('prefers an authenticated user id', () => {
    expect(
      exportRateLimitKey({
        user: {user_id: 'alice'},
        ip: '203.0.113.10',
      } as Request)
    ).toBe('user:alice');
  });

  it('falls back to the request IP', () => {
    expect(
      exportRateLimitKey({
        ip: '203.0.113.10',
        socket: {remoteAddress: '198.51.100.1'},
      } as Request)
    ).toBe('203.0.113.10');
  });
});

describe('Export rate limiter', () => {
  beforeEach(async () => {
    await beforeApiTests();
    await restoreFromBackup({filename: 'test/backup.jsonl'});
    config.exportRateLimiterEnabled = true;
    config.exportRateLimiterPerWindow = 2;
  });

  afterEach(() => {
    config.exportRateLimiterEnabled = false;
    config.exportRateLimiterPerWindow = DEFAULT_EXPORT_RATE_LIMITER_PER_WINDOW;
    EXPORT_RATE_LIMITER.resetKey(`user:admin`);
    EXPORT_RATE_LIMITER.resetKey('127.0.0.1');
    EXPORT_RATE_LIMITER.resetKey('::ffff:127.0.0.1');
    EXPORT_RATE_LIMITER.resetKey('::1');
  });

  it('limits mint requests per authenticated user', async () => {
    await requestAuthAndType(request(app).get(EXPORT_PATH)).expect(200);
    await requestAuthAndType(request(app).get(EXPORT_PATH)).expect(200);
    const limited = await requestAuthAndType(request(app).get(EXPORT_PATH));
    expect(limited.status).toBe(429);
    expect(limited.text).toMatch(/too many export/i);
  });

  it('limits unauthenticated download probes per IP', async () => {
    await request(app).get('/api/notebooks/download/not-a-grant').expect(401);
    await request(app).get('/api/notebooks/download/not-a-grant').expect(401);
    const limited = await request(app).get(
      '/api/notebooks/download/not-a-grant'
    );
    expect(limited.status).toBe(429);
    expect(limited.text).toMatch(/too many export/i);
  });

  it('does not count other notebook routes toward the export quota', async () => {
    await requestAuthAndType(request(app).get(EXPORT_PATH)).expect(200);
    await requestAuthAndType(request(app).get(EXPORT_PATH)).expect(200);
    await requestAuthAndType(
      request(app).get(`/api/notebooks/${PROJECT_ID}`)
    ).expect(200);
    const limited = await requestAuthAndType(request(app).get(EXPORT_PATH));
    expect(limited.status).toBe(429);
  });
});
