import {expect} from 'chai';

import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
PouchDB.plugin(require('pouchdb-adapter-memory')); // enable memory adapter for testing
PouchDB.plugin(PouchDBFind);

import {
  PostRequestEmailVerificationRequest,
  PutConfirmEmailVerificationRequest,
} from '@faims3/data-model';
import request from 'supertest';
import {
  getExpressUserFromEmailOrUserId,
  updateUserEmailVerificationStatus,
} from '../src/couchdb/users';
import {
  checkCanCreateVerificationChallenge,
  consumeVerificationChallenge,
  createVerificationChallenge,
  getVerificationChallengeByCode,
  getVerificationChallengesByEmail,
  getVerificationChallengesByUserId,
  validateVerificationChallenge,
} from '../src/couchdb/verificationChallenges';
import {app} from '../src/expressSetup';
import {hashChallengeCode} from '../src/utils';
import {
  beforeApiTests,
  localEmail,
  localUserName,
  localUserToken,
  requestAuthAndType,
} from './utils';

describe('Email Verification Tests', () => {
  beforeEach(beforeApiTests);

  // ===== Service Layer Tests =====
  describe('Service Layer', () => {
    it('creates verification challenge correctly', async () => {
      const localUser = await getExpressUserFromEmailOrUserId(localUserName);
      expect(localUser).to.not.be.null;

      const testEmail = 'test@example.com';
      const {code, record} = await createVerificationChallenge({
        userId: localUser!.user_id,
        email: testEmail,
      });

      expect(code).to.be.a('string');
      expect(record).to.not.be.null;
      expect(record.documentType).to.equal('verification');
      expect(record.userId).to.equal(localUser!.user_id);
      expect(record.email).to.equal(testEmail);
      expect(record.used).to.be.false;
      expect(record.expiryTimestampMs).to.be.a('number');
      expect(record.createdTimestampMs).to.be.a('number');
    });

    it('retrieves verification challenges by user ID', async () => {
      const localUser = await getExpressUserFromEmailOrUserId(localUserName);

      // Create a couple of verification challenges
      const testEmail1 = 'test1@example.com';
      const testEmail2 = 'test2@example.com';

      await createVerificationChallenge({
        userId: localUser!.user_id,
        email: testEmail1,
      });

      await createVerificationChallenge({
        userId: localUser!.user_id,
        email: testEmail2,
      });

      // Retrieve challenges by user ID
      const challenges = await getVerificationChallengesByUserId({
        userId: localUser!.user_id,
      });

      expect(challenges).to.be.an('array');
      expect(challenges.length).to.be.at.least(2);
      expect(challenges.some(c => c.email === testEmail1)).to.be.true;
      expect(challenges.some(c => c.email === testEmail2)).to.be.true;
    });

    it('retrieves verification challenges by email', async () => {
      const localUser = await getExpressUserFromEmailOrUserId(localUserName);
      const testEmail = 'specific@example.com';

      // Create a verification challenge
      await createVerificationChallenge({
        userId: localUser!.user_id,
        email: testEmail,
      });

      // Retrieve challenges by email
      const challenges = await getVerificationChallengesByEmail({
        email: testEmail,
      });

      expect(challenges).to.be.an('array');
      expect(challenges.length).to.be.at.least(1);
      expect(challenges[0].email).to.equal(testEmail);
      expect(challenges[0].userId).to.equal(localUser!.user_id);
    });

    it('validates verification challenges correctly', async () => {
      const localUser = await getExpressUserFromEmailOrUserId(localUserName);
      const testEmail = 'validate@example.com';

      // Create a verification challenge
      const {code} = await createVerificationChallenge({
        userId: localUser!.user_id,
        email: testEmail,
      });

      // Validate with correct information
      let validation = await validateVerificationChallenge({
        code,
      });

      expect(validation.valid).to.be.true;
      expect(validation.user).to.not.be.undefined;
      expect(validation.challenge).to.not.be.undefined;
      expect(validation.challenge!.email).to.equal(testEmail);

      // Validate with user ID
      validation = await validateVerificationChallenge({
        code,
        userId: localUser!.user_id,
      });

      expect(validation.valid).to.be.true;

      // Validate with email
      validation = await validateVerificationChallenge({
        code,
        email: testEmail,
      });

      expect(validation.valid).to.be.true;

      // Validate with incorrect user ID
      validation = await validateVerificationChallenge({
        code,
        userId: 'wrong-user-id',
      });

      expect(validation.valid).to.be.false;

      // Validate with incorrect email
      validation = await validateVerificationChallenge({
        code,
        email: 'wrong@example.com',
      });

      expect(validation.valid).to.be.false;

      // Consume the verification challenge
      await consumeVerificationChallenge({
        code,
      });

      // Validate used code
      validation = await validateVerificationChallenge({
        code,
      });

      expect(validation.valid).to.be.false;
      expect(validation.validationError).to.include('already been used');
    });

    it('handles rate limiting correctly', async () => {
      const localUser = await getExpressUserFromEmailOrUserId(localUserName);
      const testEmail = 'ratelimit@example.com';

      // Check initial state (should be allowed)
      let canCreate = await checkCanCreateVerificationChallenge({
        userId: localUser!.user_id,
        email: testEmail,
        maxAttempts: 2, // Set low for testing
      });

      expect(canCreate.canCreate).to.be.true;

      // Create first challenge
      await createVerificationChallenge({
        userId: localUser!.user_id,
        email: testEmail,
      });

      // Check after first challenge (still allowed)
      canCreate = await checkCanCreateVerificationChallenge({
        userId: localUser!.user_id,
        email: testEmail,
        maxAttempts: 2,
      });

      expect(canCreate.canCreate).to.be.true;

      // Create second challenge
      await createVerificationChallenge({
        userId: localUser!.user_id,
        email: testEmail,
      });

      // Check after second challenge (should be rate limited)
      canCreate = await checkCanCreateVerificationChallenge({
        userId: localUser!.user_id,
        email: testEmail,
        maxAttempts: 2,
        // Short cooldown for testing
        cooldownMs: 100,
      });

      expect(canCreate.canCreate).to.be.false;
      expect(canCreate.reason).to.include('Too many verification attempts');
      expect(canCreate.nextAttemptAllowedAt).to.be.a('number');

      // Wait for cooldown
      await new Promise(resolve => setTimeout(resolve, 200));

      // Check after cooldown (should be allowed again)
      canCreate = await checkCanCreateVerificationChallenge({
        userId: localUser!.user_id,
        email: testEmail,
        maxAttempts: 2,
        cooldownMs: 100,
      });

      expect(canCreate.canCreate).to.be.true;
    });

    it('consumes verification challenges correctly', async () => {
      const localUser = await getExpressUserFromEmailOrUserId(localUserName);
      const testEmail = 'consume@example.com';

      // Create a verification challenge
      const {code} = await createVerificationChallenge({
        userId: localUser!.user_id,
        email: testEmail,
      });

      // Verify it's not used
      const hashedCode = hashChallengeCode(code);
      let challenge = await getVerificationChallengeByCode({
        code: hashedCode,
      });

      expect(challenge).to.not.be.null;
      expect(challenge!.used).to.be.false;

      // Consume the challenge
      const consumedChallenge = await consumeVerificationChallenge({
        code,
      });

      expect(consumedChallenge.used).to.be.true;

      // Verify it's marked as used in the database
      challenge = await getVerificationChallengeByCode({
        code: hashedCode,
      });

      expect(challenge).to.not.be.null;
      expect(challenge!.used).to.be.true;
    });

    it('updates user email verification status correctly', async () => {
      const localUser = await getExpressUserFromEmailOrUserId(localUserName);
      expect(localUser).to.not.be.null;

      // Ensure we have at least one email that's not verified
      const userEmail = localUser!.emails[0].email;
      await updateUserEmailVerificationStatus({
        userId: localUser!.user_id,
        email: userEmail,
        verified: false,
      });

      // Get fresh user data
      let updatedUser = await getExpressUserFromEmailOrUserId(localUserName);
      expect(updatedUser!.emails.find(e => e.email === userEmail)!.verified).to
        .be.false;

      // Update verification status
      await updateUserEmailVerificationStatus({
        userId: localUser!.user_id,
        email: userEmail,
        verified: true,
      });

      // Verify the status was updated
      updatedUser = await getExpressUserFromEmailOrUserId(localUserName);
      expect(updatedUser!.emails.find(e => e.email === userEmail)!.verified).to
        .be.true;
    });
  });

  // ===== API Tests =====
  describe('API Layer', () => {
    it('initiate email verification requires authentication', async () => {
      const localUser = await getExpressUserFromEmailOrUserId(localUserName);
      const userEmail = localUser!.emails[0].email;

      // Should fail without auth token
      await request(app)
        .post('/api/verify')
        .send({
          email: userEmail,
          userId: localUser!.user_id,
        } as PostRequestEmailVerificationRequest)
        .expect(401);
    });

    it('initiate email verification for own email succeeds', async () => {
      const localUser = await getExpressUserFromEmailOrUserId(localUserName);
      const userEmail = localUser!.emails[0].email;

      const response = await requestAuthAndType(
        request(app)
          .post('/api/verify')
          .send({
            email: userEmail,
            userId: localUser!.user_id,
          } as PostRequestEmailVerificationRequest),
        localUserToken
      ).expect(200);

      expect(response.body.message).to.include(
        'Verification email has been sent'
      );
      expect(response.body.email).to.equal(userEmail);
      expect(response.body.expiresAt).to.be.a('number');
    });

    it('initiate email verification fails for non-owned email', async () => {
      const localUser = await getExpressUserFromEmailOrUserId(localUserName);

      await requestAuthAndType(
        request(app)
          .post('/api/verify')
          .send({
            email: 'notmyemail@example.com',
            userId: localUser!.user_id,
          } as PostRequestEmailVerificationRequest),
        localUserToken
      ).expect(401);
    });

    it('confirm email verification with valid code succeeds', async () => {
      const localUser = await getExpressUserFromEmailOrUserId(localUserName);
      const userEmail = localUser!.emails[0].email;

      // Ensure email is not verified
      await updateUserEmailVerificationStatus({
        userId: localUser!.user_id,
        email: userEmail,
        verified: false,
      });

      // Create a verification challenge
      const {code} = await createVerificationChallenge({
        userId: localUser!.user_id,
        email: userEmail,
      });

      // Confirm verification
      const response = await request(app)
        .put('/api/verify')
        .send({
          code,
        } as PutConfirmEmailVerificationRequest)
        .expect(200);

      expect(response.body.message).to.include('successfully verified');
      expect(response.body.email).to.equal(userEmail);

      // Verify the email is now marked as verified
      const updatedUser = await getExpressUserFromEmailOrUserId(localUserName);
      expect(updatedUser!.emails.find(e => e.email === userEmail)!.verified).to
        .be.true;

      // Verify the code is now marked as used
      const hashedCode = hashChallengeCode(code);
      const challenge = await getVerificationChallengeByCode({
        code: hashedCode,
      });

      expect(challenge).to.not.be.null;
      expect(challenge!.used).to.be.true;
    });

    it('confirm email verification with expired code fails', async () => {
      const localUser = await getExpressUserFromEmailOrUserId(localUserName);
      const userEmail = localUser!.emails[0].email;

      // Create a verification challenge with short expiry
      const {code} = await createVerificationChallenge({
        userId: localUser!.user_id,
        email: userEmail,
        expiryMs: 10, // 10ms expiry
      });

      // Wait for expiry
      await new Promise(resolve => setTimeout(resolve, 100));

      // Attempt to confirm verification
      await request(app)
        .put('/api/verify')
        .send({
          code,
        } as PutConfirmEmailVerificationRequest)
        .expect(401);
    });

    it('confirm email verification with invalid code fails', async () => {
      await request(app)
        .put('/api/verify')
        .send({
          code: 'invalid-code',
        } as PutConfirmEmailVerificationRequest)
        .expect(401);
    });

    it('confirm email verification with used code fails', async () => {
      const localUser = await getExpressUserFromEmailOrUserId(localUserName);
      const userEmail = localUser!.emails[0].email;

      // Create a verification challenge
      const {code} = await createVerificationChallenge({
        userId: localUser!.user_id,
        email: userEmail,
      });

      // Consume the code
      await consumeVerificationChallenge({
        code,
      });

      // Attempt to confirm verification
      await request(app)
        .put('/api/verify')
        .send({
          code,
        } as PutConfirmEmailVerificationRequest)
        .expect(401);
    });

    it('handles rate limiting at API level', async () => {
      const localUser = await getExpressUserFromEmailOrUserId(localUserName);
      const userEmail = localEmail;

      await updateUserEmailVerificationStatus({
        userId: localUser!.user_id,
        email: userEmail,
        verified: false,
      });

      // Create verification challenges up to the limit
      for (let i = 0; i < 5; i++) {
        await createVerificationChallenge({
          userId: localUser!.user_id,
          email: userEmail,
        });
      }

      // The next request should be rate limited
      await requestAuthAndType(
        request(app)
          .post('/api/verify')
          .send({
            email: userEmail,
            userId: localUser!.user_id,
          } as PostRequestEmailVerificationRequest),
        localUserToken
      ).expect(429);
    });
  });
});
