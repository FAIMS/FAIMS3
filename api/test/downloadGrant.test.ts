import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
PouchDB.plugin(PouchDBFind);
PouchDB.plugin(require('pouchdb-adapter-memory'));

import {Role} from '@faims3/data-model';
import request from 'supertest';
import {beforeEach, describe, expect, it} from 'vitest';
import {generateJwtFromUser} from '../src/auth/keySigning/create';
import {keyService} from '../src/buildconfig';
import {getAuthDB} from '../src/couchdb';
import {restoreFromBackup} from '../src/couchdb/backupRestore';
import {
  consumeDownloadGrant,
  createDownloadGrant,
  getDownloadGrant,
} from '../src/couchdb/downloadGrants';
import {createNewLongLivedToken} from '../src/couchdb/longLivedTokens';
import {getExpressUserFromEmailOrUserId} from '../src/couchdb/users';
import {app} from '../src/expressSetup';
import {callbackObject} from './mocks';
import {registerClient} from '@faims3/data-model';
import {
  adminToken,
  beforeApiTests,
  localUserName,
  localUserToken,
  requestAuthAndType,
} from './utils';

registerClient(callbackObject);

const PROJECT_ID = '1693291182736-campus-survey-demo';
const EXPORT_PATH = `/api/notebooks/${PROJECT_ID}/records/export?viewID=FORM2&format=csv`;

/** Pathname of an absolute or relative mint `url`. */
const downloadPath = (url: string): string =>
  url.startsWith('http') ? new URL(url).pathname : url;

/** `Set-Cookie` header values as an array (supertest may return a string). */
const cookieHeader = (res: request.Response): string[] => {
  const raw = res.headers['set-cookie'];
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
};

describe('Download grants', () => {
  beforeEach(async () => {
    await beforeApiTests();
    await restoreFromBackup({filename: 'test/backup.jsonl'});
  });

  /** Mint a CSV grant as admin (sets the download cookie). */
  const mintAdminExport = () =>
    requestAuthAndType(request(app).get(EXPORT_PATH)).expect(200);

  it('redeems with owner Bearer and no cookie (headless API path)', async () => {
    const issued = await mintAdminExport();
    const url = downloadPath((issued.body as {url: string}).url);
    expect(url.split('/').pop()!).not.toContain('.');

    const csv = await request(app)
      .get(url)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(csv.text).toContain('identifier');
  });

  it('marks mint and redeem responses uncacheable', async () => {
    const issued = await mintAdminExport();
    expect(issued.headers['cache-control']).toMatch(/no-store/);
    expect(issued.headers['pragma']).toBe('no-cache');
    expect(issued.headers['vary']).toMatch(/Authorization/i);
    expect(issued.headers['vary']).toMatch(/Cookie/i);

    const url = downloadPath((issued.body as {url: string}).url);
    const csv = await request(app)
      .get(url)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(csv.headers['cache-control']).toMatch(/no-store/);
    expect(csv.headers['pragma']).toBe('no-cache');
    expect(csv.headers['vary']).toMatch(/Authorization/i);
    expect(csv.headers['vary']).toMatch(/Cookie/i);
  });

  it('rejects a grant id with no authenticator', async () => {
    const issued = await mintAdminExport();
    const url = downloadPath((issued.body as {url: string}).url);
    await request(app).get(url).expect(401);
  });

  it('rejects a JWT-shaped download path', async () => {
    await request(app)
      .get('/api/notebooks/download/aaa.bbb.ccc')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(401);
  });

  it('rejects a different user Bearer', async () => {
    const issued = await mintAdminExport();
    const url = downloadPath((issued.body as {url: string}).url);
    await request(app)
      .get(url)
      .set('Authorization', `Bearer ${localUserToken}`)
      .expect(403);
  });

  it('rejects replay after consume', async () => {
    const issued = await mintAdminExport();
    const url = downloadPath((issued.body as {url: string}).url);
    await request(app)
      .get(url)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    await request(app)
      .get(url)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(401);
  });

  it('redeems with the download cookie and no Bearer', async () => {
    const issued = await mintAdminExport();
    const url = downloadPath((issued.body as {url: string}).url);
    const cookies = cookieHeader(issued);
    expect(cookies.length).toBeGreaterThan(0);

    const csv = await request(app).get(url).set('Cookie', cookies).expect(200);
    expect(csv.text).toContain('identifier');
  });

  it('rejects cookie for grant A used on grant B', async () => {
    const first = await mintAdminExport();
    const second = await mintAdminExport();
    const urlB = downloadPath((second.body as {url: string}).url);
    await request(app)
      .get(urlB)
      .set('Cookie', cookieHeader(first))
      .expect(401);
  });

  it('rejects after the grant owner is disabled', async () => {
    await request(app)
      .post(`/api/notebooks/${PROJECT_ID}/users/`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        username: localUserName,
        role: Role.PROJECT_MANAGER,
        addrole: true,
      })
      .expect(200);

    const localUser = await getExpressUserFromEmailOrUserId(localUserName);
    const signingKey = await keyService.getSigningKey();
    const managerToken = await generateJwtFromUser({
      user: localUser!,
      signingKey,
    });

    const issued = await requestAuthAndType(
      request(app).get(EXPORT_PATH),
      managerToken
    ).expect(200);
    const url = downloadPath((issued.body as {url: string}).url);
    const cookies = cookieHeader(issued);

    await request(app)
      .post(`/api/users/${localUserName}/disable`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    await request(app)
      .get(url)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(401);
    await request(app).get(url).set('Cookie', cookies).expect(401);
  });

  it('rejects after the grant owner is deleted', async () => {
    await request(app)
      .post(`/api/notebooks/${PROJECT_ID}/users/`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        username: localUserName,
        role: Role.PROJECT_MANAGER,
        addrole: true,
      })
      .expect(200);

    const localUser = await getExpressUserFromEmailOrUserId(localUserName);
    const signingKey = await keyService.getSigningKey();
    const managerToken = await generateJwtFromUser({
      user: localUser!,
      signingKey,
    });

    const issued = await requestAuthAndType(
      request(app).get(EXPORT_PATH),
      managerToken
    ).expect(200);
    const url = downloadPath((issued.body as {url: string}).url);
    const cookies = cookieHeader(issued);

    await request(app)
      .delete(`/api/users/${localUserName}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    await request(app)
      .get(url)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(401);
    await request(app).get(url).set('Cookie', cookies).expect(401);
  });

  it('rejects after EXPORT_PROJECT_DATA is removed', async () => {
    await request(app)
      .post(`/api/notebooks/${PROJECT_ID}/users/`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        username: localUserName,
        role: Role.PROJECT_MANAGER,
        addrole: true,
      })
      .expect(200);

    const localUser = await getExpressUserFromEmailOrUserId(localUserName);
    const signingKey = await keyService.getSigningKey();
    const managerToken = await generateJwtFromUser({
      user: localUser!,
      signingKey,
    });

    const issued = await requestAuthAndType(
      request(app).get(EXPORT_PATH),
      managerToken
    ).expect(200);
    const url = downloadPath((issued.body as {url: string}).url);

    await request(app)
      .post(`/api/notebooks/${PROJECT_ID}/users/`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        username: localUserName,
        role: Role.PROJECT_MANAGER,
        addrole: false,
      })
      .expect(200);

    await request(app)
      .get(url)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(403);
  });

  it('rejects an expired grant', async () => {
    const {grantId} = await createDownloadGrant({
      userId: 'admin',
      projectID: PROJECT_ID,
      format: 'csv',
      viewID: 'FORM2',
    });
    const grant = await getDownloadGrant(grantId);
    expect(grant).not.toBeNull();
    await getAuthDB().put({
      ...grant!,
      expiryTimestampMs: Date.now() - 1,
    });

    await request(app)
      .get(`/api/notebooks/download/${grantId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(401);
  });

  it('exchanges a long-lived token then mints and downloads with Bearer only', async () => {
    const adminUser = await getExpressUserFromEmailOrUserId('admin');
    const {token} = await createNewLongLivedToken({
      userId: adminUser!.user_id,
      title: 'Export token',
      description: 'headless export',
      expiryTimestampMs: Date.now() + 86_400_000,
    });

    const exchanged = await request(app)
      .post('/api/auth/exchange-long-lived-token')
      .send({token})
      .expect(200);
    const accessToken = (exchanged.body as {token: string}).token;

    const issued = await requestAuthAndType(
      request(app).get(EXPORT_PATH),
      accessToken
    ).expect(200);
    const url = downloadPath((issued.body as {url: string}).url);

    const csv = await request(app)
      .get(url)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(csv.text).toContain('identifier');
  });

  it('consumes a grant once at the module layer', async () => {
    const created = await createDownloadGrant({
      userId: 'admin',
      projectID: PROJECT_ID,
      format: 'csv',
      viewID: 'FORM2',
    });
    const first = await consumeDownloadGrant({grantId: created.grantId});
    expect(first.ok).toBe(true);
    const second = await consumeDownloadGrant({grantId: created.grantId});
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.reason).toBe('used');
    }
  });
});
