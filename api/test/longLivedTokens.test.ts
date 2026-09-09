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
 * Filename: longLived.test.ts
 * Description:
 *   Tests for the long-lived token functionality
 */

import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
PouchDB.plugin(require('pouchdb-adapter-memory')); // enable memory adapter for testing
PouchDB.plugin(PouchDBFind);

import {
  PostCreateLongLivedTokenRequest,
  PostLongLivedTokenExchangeInput,
  PutRevokeLongLivedTokenRequest,
  PutUpdateLongLivedTokenRequest,
} from '@faims3/data-model';
import {beforeEach, describe, expect, it} from 'vitest';
import request from 'supertest';
import {config} from '../src/buildconfig';
import {getAuthDB} from '../src/couchdb';
import {
  createNewLongLivedToken,
  getMaxAllowedExpiryTimestamp,
  getTokenById,
  getTokenByTokenHash,
  revokeLongLivedToken,
  validateLongLivedToken,
} from '../src/couchdb/longLivedTokens';
import {getExpressUserFromEmailOrUserId} from '../src/couchdb/users';
import {app} from '../src/expressSetup';
import {hashChallengeCode} from '../src/utils';
import {
  adminToken,
  adminUserName,
  beforeApiTests,
  localUserName,
  localUserToken,
  requestAuthAndType,
} from './utils';

describe('Long-Lived Token Tests', () => {
  beforeEach(beforeApiTests);

  const DEFAULT_EXPIRY = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days

  describe('Core Functionality', () => {
    it('can create and retrieve a token', async () => {
      const localUser = await getExpressUserFromEmailOrUserId(localUserName);
      const {record, token} = await createNewLongLivedToken({
        userId: localUser!.user_id!,
        title: 'Test Token',
        description: 'A token for testing',
        expiryTimestampMs: DEFAULT_EXPIRY,
      });

      expect(record._id).toContain('longlived_');
      expect(record.documentType).toBe('longlived');
      expect(record.title).toBe('Test Token');
      expect(record.enabled).toBe(true);
      expect(token).toBeTypeOf('string');

      // Can retrieve by ID
      const fetched = await getTokenById(record._id);
      expect(fetched.title).toBe('Test Token');

      // Can retrieve by hash
      const tokenHash = hashChallengeCode(token);
      const fetchedByHash = await getTokenByTokenHash(tokenHash);
      expect(fetchedByHash!._id).toBe(record._id);
    });

    it('enforces expiry limits', async () => {
      const localUser = await getExpressUserFromEmailOrUserId(localUserName);

      if (config.maximumLongLivedDurationDays !== undefined) {
        const tooFarInFuture =
          getMaxAllowedExpiryTimestamp()! + 24 * 60 * 60 * 1000;

        try {
          await createNewLongLivedToken({
            userId: localUser!.user_id!,
            title: 'Invalid Token',
            description: 'This should fail',
            expiryTimestampMs: tooFarInFuture,
          });
          expect.fail('Should have thrown an error for expiry beyond limit');
        } catch (error: any) {
          expect(error.message).toContain('Invalid expiry date');
        }
      }
    });

    it('can update and revoke tokens', async () => {
      const localUser = await getExpressUserFromEmailOrUserId(localUserName);
      const {record} = await createNewLongLivedToken({
        userId: localUser!.user_id!,
        title: 'Original Title',
        description: 'Original description',
        expiryTimestampMs: DEFAULT_EXPIRY,
      });

      // Revoke the token
      const revokedToken = await revokeLongLivedToken(record._id);
      expect(revokedToken.enabled).toBe(false);
    });
  });

  describe('API Endpoints', () => {
    it('POST / creates a token via API', async () => {
      const response = await requestAuthAndType(
        request(app)
          .post('/api/long-lived-tokens')
          .send({
            title: 'API Test Token',
            description: 'Created via API',
            expiryTimestampMs: DEFAULT_EXPIRY,
          } as PostCreateLongLivedTokenRequest),
        localUserToken
      ).expect(201);

      expect(response.body.title).toBe('API Test Token');
      expect(response.body.token).toBeTypeOf('string'); // Only returned on creation
    });

    it('POST / requires authentication', async () => {
      await request(app)
        .post('/api/long-lived-tokens')
        .send({
          title: 'Unauthorized Token',
          description: 'This should fail',
          expiryTimestampMs: DEFAULT_EXPIRY,
        })
        .expect(401);
    });

    it('GET / returns user tokens only', async () => {
      // Create tokens for both users
      await createNewLongLivedToken({
        userId: (await getExpressUserFromEmailOrUserId(localUserName))!
          .user_id!,
        title: 'Local Token',
        description: 'Local user token',
        expiryTimestampMs: DEFAULT_EXPIRY,
      });

      await createNewLongLivedToken({
        userId: (await getExpressUserFromEmailOrUserId(adminUserName))!
          .user_id!,
        title: 'Admin Token',
        description: 'Admin user token',
        expiryTimestampMs: DEFAULT_EXPIRY,
      });

      const response = await requestAuthAndType(
        request(app).get('/api/long-lived-tokens'),
        localUserToken
      ).expect(200);

      expect(response.body.tokens).toHaveLength(1);
      expect(response.body.tokens[0].title).toBe('Local Token');
      expect(response.body.tokens[0].token).toBeUndefined(); // Never returned
    });

    it('GET /?all=true requires admin permissions', async () => {
      await requestAuthAndType(
        request(app).get('/api/long-lived-tokens?all=true'),
        localUserToken
      ).expect(401);

      // But admin can access it
      await requestAuthAndType(
        request(app).get('/api/long-lived-tokens?all=true'),
        adminToken
      ).expect(200);
    });

    it('prevents users from editing others tokens', async () => {
      const adminUser = await getExpressUserFromEmailOrUserId(adminUserName);
      const {record} = await createNewLongLivedToken({
        userId: adminUser!.user_id!,
        title: 'Admin Token',
        description: 'Admin token',
        expiryTimestampMs: DEFAULT_EXPIRY,
      });

      // Local user can't edit admin's token
      await requestAuthAndType(
        request(app)
          .put(`/api/long-lived-tokens/${record._id}`)
          .send({title: 'Hacked Title'} as PutUpdateLongLivedTokenRequest),
        localUserToken
      ).expect(401);

      // Local user can't revoke admin's token
      await requestAuthAndType(
        request(app)
          .delete(`/api/long-lived-tokens/${record._id}`)
          .send({} as PutRevokeLongLivedTokenRequest),
        localUserToken
      ).expect(401);

      // But admin can edit any token
      const localUser = await getExpressUserFromEmailOrUserId(localUserName);
      const {record: localRecord} = await createNewLongLivedToken({
        userId: localUser!.user_id!,
        title: 'Local Token',
        description: 'Local user token',
        expiryTimestampMs: DEFAULT_EXPIRY,
      });

      await requestAuthAndType(
        request(app)
          .put(`/api/long-lived-tokens/${localRecord._id}`)
          .send({title: 'Admin Updated'} as PutUpdateLongLivedTokenRequest),
        adminToken
      ).expect(200);
    });
  });

  describe('Token Exchange', () => {
    it('successfully exchanges valid token for access token', async () => {
      const localUser = await getExpressUserFromEmailOrUserId(localUserName);
      const {token} = await createNewLongLivedToken({
        userId: localUser!.user_id!,
        title: 'Exchange Token',
        description: 'For testing exchange',
        expiryTimestampMs: DEFAULT_EXPIRY,
      });

      const response = await request(app)
        .post('/api/auth/exchange-long-lived-token')
        .send({token} as PostLongLivedTokenExchangeInput)
        .expect(200);

      expect(response.body.token).toBeTypeOf('string');

      // Verify the access token works
      await request(app)
        .get('/api/long-lived-tokens')
        .set('Authorization', `Bearer ${response.body.token}`)
        .expect(200);
    });

    it('updates last used timestamp on exchange', async () => {
      const localUser = await getExpressUserFromEmailOrUserId(localUserName);
      const {record, token} = await createNewLongLivedToken({
        userId: localUser!.user_id!,
        title: 'Exchange Token',
        description: 'For testing last used',
        expiryTimestampMs: DEFAULT_EXPIRY,
      });

      expect(record.lastUsedTimestampMs).toBeUndefined();

      await request(app)
        .post('/api/auth/exchange-long-lived-token')
        .send({token} as PostLongLivedTokenExchangeInput)
        .expect(200);

      const updatedRecord = await getTokenById(record._id);
      expect(updatedRecord.lastUsedTimestampMs).toBeTypeOf('number');
    });

    it('rejects invalid, revoked, and expired tokens', async () => {
      // Invalid token
      await request(app)
        .post('/api/auth/exchange-long-lived-token')
        .send({token: 'invalid-token'} as PostLongLivedTokenExchangeInput)
        .expect(401);

      const localUser = await getExpressUserFromEmailOrUserId(localUserName);

      // Revoked token
      const {record, token: validToken} = await createNewLongLivedToken({
        userId: localUser!.user_id!,
        title: 'Token to Revoke',
        description: 'This will be revoked',
        expiryTimestampMs: DEFAULT_EXPIRY,
      });

      await revokeLongLivedToken(record._id);
      await request(app)
        .post('/api/auth/exchange-long-lived-token')
        .send({token: validToken} as PostLongLivedTokenExchangeInput)
        .expect(401);

      // Expired token
      const {token: expiredToken} = await createNewLongLivedToken({
        userId: localUser!.user_id!,
        title: 'Expired Token',
        description: 'This will expire',
        expiryTimestampMs: Date.now() + 50, // 50ms expiry
      });

      await new Promise(resolve => setTimeout(resolve, 100));
      await request(app)
        .post('/api/auth/exchange-long-lived-token')
        .send({token: expiredToken} as PostLongLivedTokenExchangeInput)
        .expect(401);
    });

    it('full lifecycle: create, exchange, revoke, fail exchange', async () => {
      // Create token via API
      const createResponse = await requestAuthAndType(
        request(app)
          .post('/api/long-lived-tokens')
          .send({
            title: 'Lifecycle Token',
            description: 'Full lifecycle test',
            expiryTimestampMs: DEFAULT_EXPIRY,
          } as PostCreateLongLivedTokenRequest),
        localUserToken
      ).expect(201);

      const tokenValue = createResponse.body.token;
      const tokenId = createResponse.body.id;

      // Exchange token for access token
      const exchangeResponse = await request(app)
        .post('/api/auth/exchange-long-lived-token')
        .send({token: tokenValue} as PostLongLivedTokenExchangeInput)
        .expect(200);

      // Use access token
      await request(app)
        .get('/api/long-lived-tokens')
        .set('Authorization', `Bearer ${exchangeResponse.body.token}`)
        .expect(200);

      // Revoke the long-lived token
      await requestAuthAndType(
        request(app)
          .delete(`/api/long-lived-tokens/${tokenId}`)
          .send({} as PutRevokeLongLivedTokenRequest),
        localUserToken
      ).expect(200);

      // Try to exchange revoked token - should fail
      await request(app)
        .post('/api/auth/exchange-long-lived-token')
        .send({token: tokenValue} as PostLongLivedTokenExchangeInput)
        .expect(401);

      // Access token should still work (doesn't get invalidated)
      await request(app)
        .get('/api/long-lived-tokens')
        .set('Authorization', `Bearer ${exchangeResponse.body.token}`)
        .expect(200);
    });
  });

  describe('Security', () => {
    it('tokens are properly hashed and not stored in plaintext', async () => {
      const localUser = await getExpressUserFromEmailOrUserId(localUserName);
      const {record, token} = await createNewLongLivedToken({
        userId: localUser!.user_id!,
        title: 'Security Test',
        description: 'For testing security',
        expiryTimestampMs: DEFAULT_EXPIRY,
      });

      // Verify the raw token is not stored
      expect(record.tokenHash).not.toBe(token);
      expect(record.tokenHash).toBeTypeOf('string');

      // Verify the hash matches expected
      const expectedHash = hashChallengeCode(token);
      expect(record.tokenHash).toBe(expectedHash);

      // Can't find by raw token
      const foundByRaw = await getTokenByTokenHash(token);
      expect(foundByRaw).toBeUndefined();

      // Can find by hash
      const foundByHash = await getTokenByTokenHash(expectedHash);
      expect(foundByHash!._id).toBe(record._id);
    });

    it('different tokens generate different hashes', async () => {
      const localUser = await getExpressUserFromEmailOrUserId(localUserName);

      const {record: record1, token: token1} = await createNewLongLivedToken({
        userId: localUser!.user_id!,
        title: 'Token 1',
        description: 'First token',
        expiryTimestampMs: DEFAULT_EXPIRY,
      });

      const {record: record2, token: token2} = await createNewLongLivedToken({
        userId: localUser!.user_id!,
        title: 'Token 2',
        description: 'Second token',
        expiryTimestampMs: DEFAULT_EXPIRY,
      });

      expect(token1).not.toBe(token2);
      expect(record1.tokenHash).not.toBe(record2.tokenHash);
    });

    it('API never returns token values after creation', async () => {
      const localUser = await getExpressUserFromEmailOrUserId(localUserName);
      const {record} = await createNewLongLivedToken({
        userId: localUser!.user_id!,
        title: 'Secret Token',
        description: 'Should not be retrievable',
        expiryTimestampMs: DEFAULT_EXPIRY,
      });

      const response = await requestAuthAndType(
        request(app).get('/api/long-lived-tokens'),
        localUserToken
      ).expect(200);

      const token = response.body.tokens.find((t: any) => t.id === record._id);
      expect(token).not.toBeUndefined();
      expect(token.token).toBeUndefined();
      expect(token.tokenHash).toBeUndefined();
    });

    it('validates tokens correctly', async () => {
      const localUser = await getExpressUserFromEmailOrUserId(localUserName);
      const {record, token} = await createNewLongLivedToken({
        userId: localUser!.user_id!,
        title: 'Valid Token',
        description: 'This should validate',
        expiryTimestampMs: DEFAULT_EXPIRY,
      });

      const tokenHash = hashChallengeCode(token);

      // Valid token
      let validation = await validateLongLivedToken(tokenHash, false);
      expect(validation.valid).toBe(true);
      expect(validation.user).not.toBeUndefined();

      // After revocation
      await revokeLongLivedToken(record._id);
      validation = await validateLongLivedToken(tokenHash, false);
      expect(validation.valid).toBe(false);
      expect(validation.validationError).toContain('revoked');
    });

    it('enforces expiry via database manipulation', async () => {
      const localUser = await getExpressUserFromEmailOrUserId(localUserName);
      const {record, token} = await createNewLongLivedToken({
        userId: localUser!.user_id!,
        title: 'Expiry Test',
        description: 'For testing expiry',
        expiryTimestampMs: DEFAULT_EXPIRY,
      });

      // Manually expire the token in the database
      const authDB = getAuthDB();
      const tokenDoc = await authDB.get(record._id);
      tokenDoc.expiryTimestampMs = Date.now() - 1000; // 1 second ago
      await authDB.put(tokenDoc);

      // Should fail validation
      const tokenHash = hashChallengeCode(token);
      const validation = await validateLongLivedToken(tokenHash, false);
      expect(validation.valid).toBe(false);
      expect(validation.validationError).toContain('expired');
    });
  });

  describe('Input Validation', () => {
    it('validates API request bodies', async () => {
      // Missing title
      await requestAuthAndType(
        request(app).post('/api/long-lived-tokens').send({
          description: 'Missing title',
          expiryTimestampMs: DEFAULT_EXPIRY,
        }),
        localUserToken
      ).expect(400);

      // Missing description
      await requestAuthAndType(
        request(app).post('/api/long-lived-tokens').send({
          title: 'Missing description',
          expiryTimestampMs: DEFAULT_EXPIRY,
        }),
        localUserToken
      ).expect(400);

      // Invalid expiry (negative)
      await requestAuthAndType(
        request(app).post('/api/long-lived-tokens').send({
          title: 'Invalid Token',
          description: 'Negative expiry',
          expiryTimestampMs: -1000,
        }),
        localUserToken
      ).expect(400);
    });

    it('rejects expiry beyond configured limits', async () => {
      if (config.maximumLongLivedDurationDays !== undefined) {
        const tooFarInFuture =
          getMaxAllowedExpiryTimestamp()! + 24 * 60 * 60 * 1000;

        await requestAuthAndType(
          request(app).post('/api/long-lived-tokens').send({
            title: 'Invalid Token',
            description: 'This should fail',
            expiryTimestampMs: tooFarInFuture,
          }),
          localUserToken
        ).expect(400);
      }
    });
  });
});
