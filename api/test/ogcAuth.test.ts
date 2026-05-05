/*
 * Integration tests: OGC accepts JWT or long-lived Bearer; REST accepts JWT only.
 */

import {expect} from 'chai';
import request from 'supertest';
import {createNewLongLivedToken} from '../src/couchdb/longLivedTokens';
import {getExpressUserFromEmailOrUserId} from '../src/couchdb/users';
import {app} from '../src/expressSetup';
import {
  adminUserName,
  beforeApiTests,
  requestAuthAndType,
} from './utils';

describe('OGC authentication (JWT or long-lived)', () => {
  beforeEach(beforeApiTests);

  const DEFAULT_EXPIRY = Date.now() + 30 * 24 * 60 * 60 * 1000;

  it('returns 401 for /ogc/ without Authorization', async () => {
    await request(app).get('/ogc/').expect(401);
  });

  it('allows /ogc/ with admin JWT', async () => {
    const res = await requestAuthAndType(request(app).get('/ogc/')).expect(200);
    expect(res.body).to.have.property('title');
  });

  it('allows /ogc/ with raw long-lived token for that user', async () => {
    const adminUser = await getExpressUserFromEmailOrUserId(adminUserName);
    expect(adminUser).to.not.be.null;
    const {token: rawLongLived} = await createNewLongLivedToken({
      userId: adminUser!.user_id!,
      title: 'OGC test token',
      description: 'For ogcAuth.test',
      expiryTimestampMs: DEFAULT_EXPIRY,
    });

    const res = await request(app)
      .get('/ogc/')
      .set('Authorization', `Bearer ${rawLongLived}`)
      .expect(200);
    expect(res.body).to.have.property('title');
  });

  it('does not allow /api/hello/ with long-lived Bearer (JWT only on REST)', async () => {
    const adminUser = await getExpressUserFromEmailOrUserId(adminUserName);
    expect(adminUser).to.not.be.null;
    const {token: rawLongLived} = await createNewLongLivedToken({
      userId: adminUser!.user_id!,
      title: 'REST rejection test',
      description: 'Should not work on /api',
      expiryTimestampMs: DEFAULT_EXPIRY,
    });

    await request(app)
      .get('/api/hello/')
      .set('Authorization', `Bearer ${rawLongLived}`)
      .expect(401);
  });
});
