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
 * Filename: impersonate.test.ts
 * Description:
 *   Tests for the user impersonation endpoint (POST /api/users/:id/impersonate)
 */

import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
PouchDB.plugin(require('pouchdb-adapter-memory')); // enable memory adapter for testing
PouchDB.plugin(PouchDBFind);

import {
  addGlobalRole,
  PostImpersonateUserResponseSchema,
  PostRefreshTokenInput,
  PostRefreshTokenResponseSchema,
  Role,
} from '@faims3/data-model';
import {expect} from 'chai';
import request from 'supertest';
import {
  generateJwtFromUser,
  upgradeCouchUserToExpressUser,
} from '../src/auth/keySigning/create';
import {validateToken} from '../src/auth/keySigning/read';
import {keyService} from '../src/buildconfig';
import {
  createUser,
  getCouchUserFromEmailOrUserId,
  saveCouchUser,
} from '../src/couchdb/users';
import {app} from '../src/expressSetup';
import {
  adminToken,
  adminUserName,
  beforeApiTests,
  localUserToken,
} from './utils';

// An operations admin (the intended audience) and a normal target user created
// fresh for each test.
const opsAdminUsername = 'opsadmin';
const targetUsername = 'targetuser';
let opsAdminToken = '';

/**
 * Creates a user with the given global roles and returns a signed JWT for them.
 */
const createUserWithRolesAndToken = async ({
  username,
  roles,
}: {
  username: string;
  roles: Role[];
}): Promise<string> => {
  const signingKey = await keyService.getSigningKey();
  const [dbUser, error] = await createUser({username, name: username});
  expect(dbUser, `Failed to create user ${username}: ${error}`).to.not.be.null;
  for (const role of roles) {
    addGlobalRole({user: dbUser!, role});
  }
  await saveCouchUser(dbUser!);
  const expressUser = await upgradeCouchUserToExpressUser({dbUser: dbUser!});
  return await generateJwtFromUser({user: expressUser, signingKey});
};

describe('user impersonation', () => {
  beforeEach(async () => {
    await beforeApiTests();
    // Create an operations admin and a plain target user for these tests.
    opsAdminToken = await createUserWithRolesAndToken({
      username: opsAdminUsername,
      roles: [Role.OPERATIONS_ADMIN],
    });
    await createUserWithRolesAndToken({
      username: targetUsername,
      roles: [],
    });
  });

  const impersonateUrl = (id: string) =>
    `/api/users/${encodeURIComponent(id)}/impersonate`;

  it('requires authentication', async () => {
    await request(app).post(impersonateUrl(targetUsername)).expect(401);
  });

  it('is forbidden for non-admin users', async () => {
    // localUser has no roles -> not authorised
    await request(app)
      .post(impersonateUrl(targetUsername))
      .set('Authorization', `Bearer ${localUserToken}`)
      .expect(401);
  });

  it('allows an operations admin to impersonate a normal user', async () => {
    const body = await request(app)
      .post(impersonateUrl(targetUsername))
      .set('Authorization', `Bearer ${opsAdminToken}`)
      .expect(200)
      .then(res => PostImpersonateUserResponseSchema.parse(res.body));

    expect(body.accessToken).to.be.a('string');
    expect(body.refreshToken).to.be.a('string');

    // The access token should authenticate as the TARGET user, and carry the
    // acting admin's id for auditing.
    const decoded = await validateToken(body.accessToken);
    expect(decoded, 'access token did not validate').to.not.be.undefined;
    expect(decoded!.user_id).to.equal(targetUsername);
    expect(decoded!.impersonatingUserId).to.equal(opsAdminUsername);
  });

  it('allows a general (cluster) admin to impersonate (via inheritance)', async () => {
    const body = await request(app)
      .post(impersonateUrl(targetUsername))
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .then(res => PostImpersonateUserResponseSchema.parse(res.body));

    const decoded = await validateToken(body.accessToken);
    expect(decoded!.user_id).to.equal(targetUsername);
    expect(decoded!.impersonatingUserId).to.equal(adminUserName);
  });

  it('rejects impersonating yourself', async () => {
    await request(app)
      .post(impersonateUrl(opsAdminUsername))
      .set('Authorization', `Bearer ${opsAdminToken}`)
      .expect(403);
  });

  it('rejects impersonating a disabled account', async () => {
    const target = (await getCouchUserFromEmailOrUserId(targetUsername))!;
    target.disabled = true;
    await saveCouchUser(target);

    await request(app)
      .post(impersonateUrl(targetUsername))
      .set('Authorization', `Bearer ${opsAdminToken}`)
      .expect(403);
  });

  it('rejects impersonating a cluster (GENERAL_ADMIN) account', async () => {
    // adminUserName is a GENERAL_ADMIN
    await request(app)
      .post(impersonateUrl(adminUserName))
      .set('Authorization', `Bearer ${opsAdminToken}`)
      .expect(403);
  });

  it('returns 404 for an unknown user', async () => {
    await request(app)
      .post(impersonateUrl('no-such-user'))
      .set('Authorization', `Bearer ${opsAdminToken}`)
      .expect(404);
  });

  it('returns a usable refresh token for the impersonated session', async () => {
    const body = await request(app)
      .post(impersonateUrl(targetUsername))
      .set('Authorization', `Bearer ${opsAdminToken}`)
      .expect(200)
      .then(res => PostImpersonateUserResponseSchema.parse(res.body));

    // The refresh token should mint a fresh access token that still
    // authenticates as the target user.
    const refreshed = await request(app)
      .post('/api/auth/refresh')
      .send({refreshToken: body.refreshToken} satisfies PostRefreshTokenInput)
      .expect(200)
      .then(res => PostRefreshTokenResponseSchema.parse(res.body));

    const decoded = await validateToken(refreshed.token);
    expect(decoded!.user_id).to.equal(targetUsername);
    expect(decoded!.impersonatingUserId).to.equal(opsAdminUsername);
  });
});
