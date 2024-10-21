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
 * Filename: api.test.ts
 * Description:
 *   Tests for the API
 */

import {expect} from 'chai';
import PouchDB from 'pouchdb';
import request from 'supertest';
import {generateUserToken} from '../src/authkeys/create';
import {
  createNewRefreshToken,
  deleteRefreshToken,
  getAllTokens,
  getTokenByToken,
  getTokenByTokenId,
  getTokensByUserId,
  invalidateToken,
  validateRefreshToken,
} from '../src/couchdb/refreshTokens';
import {getUserFromEmailOrUsername} from '../src/couchdb/users';
import {app} from '../src/routes';
import {
  adminToken,
  adminUserName,
  beforeApiTests,
  localUserName,
  localUserToken,
  notebookUserName,
  requestAuthAndType,
} from './utils';
import {
  PostRefreshTokenInput,
  PostRefreshTokenResponseSchema,
} from '@faims3/data-model';
import {listTemplates} from './template.test';

PouchDB.plugin(require('pouchdb-adapter-memory')); // enable memory adapter for testing
PouchDB.plugin(require('pouchdb-find'));

describe('token refresh tests', () => {
  beforeEach(beforeApiTests);

  //======= TEMPLATES ===========
  //=============================

  it('generate refresh token', async () => {
    const adminUser = await getUserFromEmailOrUsername(adminUserName);
    expect(adminUser).to.be.not.undefined;

    // true indicates generation of refresh token
    const tokens = await generateUserToken(adminUser!, true);

    // expect a refresh token to be present
    expect(tokens.refreshToken).to.be.not.undefined;
  });

  it('check that refresh token CRUD methods work', async () => {
    // methods to check
    // get tokens by user id
    // get token by token
    // get token by token id
    // get all tokens

    // setup user profiles
    const adminUser = (await getUserFromEmailOrUsername(adminUserName))!;
    const localUser = (await getUserFromEmailOrUsername(localUserName))!;
    const notebookUser = (await getUserFromEmailOrUsername(notebookUserName))!;

    // check there are no tokens for all list methods
    let allTokens = await getAllTokens();
    expect(allTokens.length).to.equal(0);

    const adminUserTokens = await getTokensByUserId(adminUser.user_id!);
    expect(adminUserTokens.length).to.equal(0);

    // generate a token for each user and check that the query methods work as expected

    // generate refresh tokens
    const adminUserRefresh = (await generateUserToken(adminUser, true))
      .refreshToken!;
    const localUserRefresh = (await generateUserToken(localUser, true))
      .refreshToken!;
    const notebookUserRefresh = (await generateUserToken(notebookUser, true))
      .refreshToken!;

    // get admin user's token
    let tokenList = [];
    tokenList = await getTokensByUserId(adminUser.user_id);
    expect(tokenList.length).to.equal(1);
    expect(tokenList[0].token).to.equal(adminUserRefresh);

    // get local user's token
    tokenList = await getTokensByUserId(localUser.user_id);
    expect(tokenList.length).to.equal(1);
    expect(tokenList[0].token).to.equal(localUserRefresh);

    // get notebook user's token
    tokenList = await getTokensByUserId(notebookUser.user_id);
    expect(tokenList.length).to.equal(1);
    expect(tokenList[0].token).to.equal(notebookUserRefresh);

    // try fetching tokens directly by token and then by token doc ID
    let fetchedTokenDoc;

    // admin
    fetchedTokenDoc = (await getTokenByToken(adminUserRefresh))!;
    expect(fetchedTokenDoc).to.not.be.undefined;
    expect(fetchedTokenDoc?.token).to.eq(adminUserRefresh);

    fetchedTokenDoc = await getTokenByTokenId(fetchedTokenDoc._id);
    expect(fetchedTokenDoc).to.not.be.undefined;
    expect(fetchedTokenDoc?.token).to.eq(adminUserRefresh);

    // local
    fetchedTokenDoc = (await getTokenByToken(localUserRefresh))!;
    expect(fetchedTokenDoc).to.not.be.undefined;
    expect(fetchedTokenDoc?.token).to.eq(localUserRefresh);

    fetchedTokenDoc = await getTokenByTokenId(fetchedTokenDoc._id);
    expect(fetchedTokenDoc).to.not.be.undefined;
    expect(fetchedTokenDoc?.token).to.eq(localUserRefresh);

    // notebook
    fetchedTokenDoc = (await getTokenByToken(notebookUserRefresh))!;
    expect(fetchedTokenDoc).to.not.be.undefined;
    expect(fetchedTokenDoc?.token).to.eq(notebookUserRefresh);

    fetchedTokenDoc = await getTokenByTokenId(fetchedTokenDoc._id);
    expect(fetchedTokenDoc).to.not.be.undefined;
    expect(fetchedTokenDoc?.token).to.eq(notebookUserRefresh);

    // now get all tokens

    allTokens = await getAllTokens();
    let rawTokenList = allTokens.map(t => t.token);
    expect(allTokens.length).to.equal(3);

    // check each token is present to make sure not duplicated or other issue
    for (const t of [adminUserRefresh, notebookUserRefresh, localUserRefresh]) {
      expect(rawTokenList).to.include(t);
    }

    // delete a token by token and ensure that works
    await deleteRefreshToken('token', localUserRefresh);

    allTokens = await getAllTokens();
    rawTokenList = allTokens.map(t => t.token);
    expect(allTokens.length).to.equal(2);
    for (const t of [adminUserRefresh, notebookUserRefresh]) {
      expect(rawTokenList).to.include(t);
    }

    fetchedTokenDoc = (await getTokenByToken(notebookUserRefresh))!;
    await deleteRefreshToken('id', fetchedTokenDoc._id);

    allTokens = await getAllTokens();
    rawTokenList = allTokens.map(t => t.token);
    expect(allTokens.length).to.equal(1);
    for (const t of [adminUserRefresh]) {
      expect(rawTokenList).to.include(t);
    }
  });

  it('refresh token validity expiry and enabled', async () => {
    // Get local user profile and setup refresh
    const localUser = (await getUserFromEmailOrUsername(localUserName))!;
    const adminUser = (await getUserFromEmailOrUsername(adminUserName))!;

    let refresh = (await generateUserToken(localUser, true)).refreshToken!;

    // check it's valid currently
    let valid = await validateRefreshToken(refresh);

    // check valid
    expect(valid.valid).to.be.true;
    expect(valid.validationError).to.be.undefined;

    // also check its valid if we use correct user ID
    valid = await validateRefreshToken(refresh, localUser.user_id);

    // check valid
    expect(valid.valid).to.be.true;
    expect(valid.validationError).to.be.undefined;

    // also check its invalid if we use wrong user ID (but still a valid user ID)
    valid = await validateRefreshToken(refresh, adminUser.user_id);

    // check invalid
    expect(valid.valid).to.be.false;
    expect(valid.validationError).to.not.be.undefined;

    // Now invalidate the token
    await invalidateToken(refresh);
    valid = await validateRefreshToken(refresh, adminUser.user_id);
    expect(valid.valid).to.be.false;
    expect(valid.validationError).to.not.be.undefined;

    // Now generate a new token with a very short expiry
    refresh = (await createNewRefreshToken(localUser._id!, 10)).token;

    // Wait until it expires
    await new Promise(resolve => setTimeout(resolve, 100));

    valid = await validateRefreshToken(refresh);
    expect(valid.valid).to.be.false;
    expect(valid.validationError).to.not.be.undefined;
    expect(valid.validationError).to.include('expired');
  });

  it('use refresh token to generate new token', async () => {
    // Get local user profile and setup refresh
    const localUser = (await getUserFromEmailOrUsername(localUserName))!;
    const refresh = (await generateUserToken(localUser, true)).refreshToken!;

    // now run the refresh method
    const newToken = await requestAuthAndType(
      request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: refresh,
        } as PostRefreshTokenInput),
      localUserToken
    )
      .expect(200)
      .then(res => {
        const response = PostRefreshTokenResponseSchema.parse(res.body);
        return response.token;
      });

    // and check this token works - do some authenticated action e.g. list templates
    // this will fail if auth is not okay
    await listTemplates(app, newToken);
  });

  it('user ID must match if requested as a logged in user', async () => {
    // Get local user profile and setup refresh
    const localUser = (await getUserFromEmailOrUsername(localUserName))!;
    const refresh = (await generateUserToken(localUser, true)).refreshToken!;

    // now run the refresh method - this should work
    await requestAuthAndType(
      request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: refresh,
        } as PostRefreshTokenInput),
      localUserToken
    ).expect(200);

    // now use the incorrect token
    await requestAuthAndType(
      request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: refresh,
        } as PostRefreshTokenInput),
      adminToken
    ).expect(400);
  });
});
