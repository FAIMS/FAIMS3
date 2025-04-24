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

import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
PouchDB.plugin(require('pouchdb-adapter-memory')); // enable memory adapter for testing
PouchDB.plugin(PouchDBFind);

import {
  PostExchangeTokenInput,
  PostExchangeTokenResponseSchema,
  PostRefreshTokenInput,
  PostRefreshTokenResponseSchema,
} from '@faims3/data-model';
import {expect} from 'chai';
import request from 'supertest';
import {generateUserToken} from '../src/auth/keySigning/create';
import {
  createNewRefreshToken,
  deleteRefreshToken,
  getAllTokens,
  getTokenByToken,
  getTokenByTokenId,
  getTokensByExchangeTokenHash,
  getTokensByUserId,
  invalidateToken,
  validateRefreshToken,
} from '../src/couchdb/refreshTokens';
import {getExpressUserFromEmailOrUserId} from '../src/couchdb/users';
import {app} from '../src/expressSetup';
import {hashVerificationCode} from '../src/utils';
import {listTemplates} from './template.test';
import {
  adminToken,
  adminUserName,
  beforeApiTests,
  localUserName,
  localUserToken,
  notebookUserName,
  requestAuthAndType,
} from './utils';

describe('token refresh tests', () => {
  beforeEach(beforeApiTests);

  //======= REFRESH TOKENS ===========
  //==================================

  it('generate refresh token', async () => {
    const adminUser = await getExpressUserFromEmailOrUserId(adminUserName);
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
    const adminUser = (await getExpressUserFromEmailOrUserId(adminUserName))!;
    const localUser = (await getExpressUserFromEmailOrUserId(localUserName))!;
    const notebookUser =
      (await getExpressUserFromEmailOrUserId(notebookUserName))!;

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
    const localUser = (await getExpressUserFromEmailOrUserId(localUserName))!;
    const adminUser = (await getExpressUserFromEmailOrUserId(adminUserName))!;

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
    refresh = (
      await createNewRefreshToken({userId: localUser._id!, refreshExpiryMs: 10})
    ).refresh.token;

    // Wait until it expires
    await new Promise(resolve => setTimeout(resolve, 100));

    valid = await validateRefreshToken(refresh);
    expect(valid.valid).to.be.false;
    expect(valid.validationError).to.not.be.undefined;
    expect(valid.validationError).to.include('expired');
  });

  it('use refresh token to generate new token', async () => {
    // Get local user profile and setup refresh
    const localUser = (await getExpressUserFromEmailOrUserId(localUserName))!;

    // This should work now
    await listTemplates(app, localUserToken);

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
    const localUser = (await getExpressUserFromEmailOrUserId(localUserName))!;
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

  //======= EXCHANGE TOKEN TESTS ===========
  //========================================

  it('should successfully create a refresh token with exchange token', async () => {
    // Get local user profile
    const localUser = (await getExpressUserFromEmailOrUserId(localUserName))!;

    // Create refresh token with exchange token using the existing function
    const {refresh, exchangeToken} = await createNewRefreshToken({
      userId: localUser.user_id!,
    });

    // Verify the tokens exist and are strings
    expect(exchangeToken).to.be.a('string');
    expect(refresh.token).to.be.a('string');

    // Verify the refresh token document has the correct exchange token hash and is not used
    expect(refresh.exchangeTokenHash).to.be.a('string');
    expect(refresh.exchangeTokenUsed).to.be.false;

    // Verify we can look up the token by its ID and token
    const tokenByToken = await getTokenByToken(refresh.token);
    expect(tokenByToken).to.not.be.undefined;
    expect(tokenByToken!.token).to.equal(refresh.token);

    // Verify we can find the token by the exchange token hash
    // Use the hash verification code function to check hash lookup
    const hash = hashVerificationCode(exchangeToken);
    const tokensByExchangeHash = await getTokensByExchangeTokenHash({
      exchangeTokenHash: hash,
    });
    expect(tokensByExchangeHash.length).to.equal(1);
    expect(tokensByExchangeHash[0]).to.not.be.undefined;
    expect(tokensByExchangeHash[0].token).to.equal(refresh.token);
  });

  it('should successfully exchange token for refresh and access tokens', async () => {
    // Get local user profile
    const localUser = (await getExpressUserFromEmailOrUserId(localUserName))!;

    // Create refresh token with exchange token
    const {refresh, exchangeToken} = await createNewRefreshToken({
      userId: localUser.user_id!,
    });

    // Exchange the token for access and refresh tokens
    const response = await request(app)
      .post('/api/auth/exchange')
      .send({
        exchangeToken: exchangeToken,
      } satisfies PostExchangeTokenInput)
      .expect(200)
      .then(res => {
        return PostExchangeTokenResponseSchema.parse(res.body);
      });

    // Verify both tokens are returned
    expect(response.accessToken).to.be.a('string');
    expect(response.refreshToken).to.equal(refresh.token);

    // Verify the exchange token is now marked as used
    const tokenDoc = await getTokenByToken(refresh.token);
    expect(tokenDoc).to.not.be.undefined;
    expect(tokenDoc!.exchangeTokenUsed).to.be.true;

    // Verify the access token works by using it to access a protected resource
    await listTemplates(app, response.accessToken);
  });

  it('should fail when attempting to use an exchange token more than once', async () => {
    // Get local user profile
    const localUser = (await getExpressUserFromEmailOrUserId(localUserName))!;

    // Create refresh token with exchange token
    const {exchangeToken} = await createNewRefreshToken({
      userId: localUser.user_id!,
    });

    // First exchange should succeed
    await request(app)
      .post('/api/auth/exchange')
      .send({
        exchangeToken: exchangeToken,
      } satisfies PostExchangeTokenInput)
      .expect(200);

    // Second exchange with the same token should fail
    await request(app)
      .post('/api/auth/exchange')
      .send({
        exchangeToken,
      } satisfies PostExchangeTokenInput)
      .expect(400);
  });

  it('should fail when attempting to use an invalid exchange token', async () => {
    await request(app)
      .post('/api/auth/exchange')
      .send({
        exchangeToken: 'invalid-exchange-token',
      } satisfies PostExchangeTokenInput)
      .expect(400);
  });

  it('should verify user ID when exchanging token while authenticated', async () => {
    // Get local user profile
    const localUser = (await getExpressUserFromEmailOrUserId(localUserName))!;

    // Create refresh token with exchange token for local user
    const {exchangeToken} = await createNewRefreshToken({
      userId: localUser.user_id!,
    });

    // Exchange should succeed when not authenticated
    await request(app)
      .post('/api/auth/exchange')
      .send({
        exchangeToken: exchangeToken,
      } satisfies PostExchangeTokenInput)
      .expect(200);

    // Create another token for testing with authentication
    const {exchangeToken: secondExchangeToken} = await createNewRefreshToken({
      userId: localUser.user_id!,
    });

    // Exchange should succeed when authenticated as the same user
    await requestAuthAndType(
      request(app)
        .post('/api/auth/exchange')
        .send({
          exchangeToken: secondExchangeToken,
        } satisfies PostExchangeTokenInput),
      localUserToken
    ).expect(200);

    // Create a third token for testing with wrong authentication
    const {exchangeToken: thirdExchangeToken} = await createNewRefreshToken({
      userId: localUser.user_id!,
    });

    // Exchange should fail when authenticated as a different user
    await requestAuthAndType(
      request(app)
        .post('/api/auth/exchange')
        .send({
          exchangeToken: thirdExchangeToken,
        } satisfies PostExchangeTokenInput),
      adminToken
    ).expect(400);
  });

  it('should integrate with refresh token workflow', async () => {
    // Get local user profile
    const localUser = (await getExpressUserFromEmailOrUserId(localUserName))!;

    // Create refresh token with exchange token
    const {exchangeToken} = await createNewRefreshToken({
      userId: localUser.user_id!,
    });

    // Exchange the token for access and refresh tokens
    const exchangeResponse = await request(app)
      .post('/api/auth/exchange')
      .send({
        exchangeToken: exchangeToken,
      } satisfies PostExchangeTokenInput)
      .expect(200)
      .then(res => {
        return PostExchangeTokenResponseSchema.parse(res.body);
      });

    // Now use the refresh token to generate a new access token
    const refreshResponse = await request(app)
      .post('/api/auth/refresh')
      .send({
        refreshToken: exchangeResponse.refreshToken,
      } satisfies PostRefreshTokenInput)
      .expect(200)
      .then(res => {
        return PostRefreshTokenResponseSchema.parse(res.body);
      });

    // Verify the new access token works
    expect(refreshResponse.token).to.be.a('string');
    await listTemplates(app, refreshResponse.token);
  });

  it('should fail when the refresh token is invalidated after exchange', async () => {
    // Get local user profile
    const localUser = (await getExpressUserFromEmailOrUserId(localUserName))!;

    // Create refresh token with exchange token
    const {refresh, exchangeToken} = await createNewRefreshToken({
      userId: localUser.user_id!,
    });

    // Exchange the token for access and refresh tokens
    const exchangeResponse = await request(app)
      .post('/api/auth/exchange')
      .send({
        exchangeToken: exchangeToken,
      } as PostExchangeTokenInput)
      .expect(200)
      .then(res => {
        return PostExchangeTokenResponseSchema.parse(res.body);
      });

    // Invalidate the refresh token
    await invalidateToken(refresh.token);

    // Attempt to use the invalidated refresh token
    await request(app)
      .post('/api/auth/refresh')
      .send({
        refreshToken: exchangeResponse.refreshToken,
      } satisfies PostRefreshTokenInput)
      .expect(400);
  });

  it('should create a new refresh token with exchange token with custom expiry', async () => {
    // Get local user profile
    const localUser = (await getExpressUserFromEmailOrUserId(localUserName))!;

    // Create a refresh token with a short expiry
    const {exchangeToken} = await createNewRefreshToken({
      userId: localUser.user_id!,
      refreshExpiryMs: 500,
    });

    // Immediately exchange it (should work)
    await request(app)
      .post('/api/auth/exchange')
      .send({
        exchangeToken: exchangeToken,
      } satisfies PostExchangeTokenInput)
      .expect(200);

    // Create another with even shorter expiry for testing expiration
    const {exchangeToken: shortExchangeToken} = await createNewRefreshToken({
      userId: localUser.user_id!,
      refreshExpiryMs: 10,
    });

    // Wait for it to expire
    await new Promise(resolve => setTimeout(resolve, 100));

    // Attempt to use expired exchange token
    await request(app)
      .post('/api/auth/exchange')
      .send({
        exchangeToken: shortExchangeToken,
      } satisfies PostExchangeTokenInput)
      .expect(400);

    // Create a refresh token with a short exchange expiry
    const {exchangeToken: shortExchangeToken2} = await createNewRefreshToken({
      userId: localUser.user_id!,
      exchangeExpiryMs: 500,
    });

    // Immediately exchange it (should work)
    await request(app)
      .post('/api/auth/exchange')
      .send({
        exchangeToken: shortExchangeToken2,
      } satisfies PostExchangeTokenInput)
      .expect(200);

    // Create another with even shorter exchange expiry for testing expiration
    const {exchangeToken: veryShortExchangeToken} = await createNewRefreshToken(
      {
        userId: localUser.user_id!,
        exchangeExpiryMs: 10,
      }
    );

    // Wait for it to expire
    await new Promise(resolve => setTimeout(resolve, 100));

    // Attempt to use expired exchange token
    await request(app)
      .post('/api/auth/exchange')
      .send({
        exchangeToken: veryShortExchangeToken,
      } satisfies PostExchangeTokenInput)
      .expect(400);
  });
});
