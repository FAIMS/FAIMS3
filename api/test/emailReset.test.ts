import {expect} from 'chai';

import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
PouchDB.plugin(require('pouchdb-adapter-memory')); // enable memory adapter for testing
PouchDB.plugin(PouchDBFind);

import {
  PostRequestPasswordResetRequest,
  PutRequestPasswordResetRequest,
} from '@faims3/data-model';
import request from 'supertest';
import {
  createNewEmailCode,
  getCodeByCode,
  markCodeAsUsed,
  validateEmailCode,
} from '../src/couchdb/emailReset';
import {getExpressUserFromEmailOrUserId} from '../src/couchdb/users';
import {app} from '../src/expressSetup';
import {hashVerificationCode} from '../src/utils';
import {
  adminToken,
  adminUserName,
  beforeApiTests,
  localUserName,
  localUserToken,
  requestAuthAndType,
} from './utils';

describe('password reset tests', () => {
  beforeEach(beforeApiTests);

  it('initiate password reset requires admin authentication', async () => {
    // Should fail without auth token
    await request(app)
      .post('/api/reset')
      .send({
        email: localUserName,
      } as PostRequestPasswordResetRequest)
      .expect(401);

    // Should fail with non-admin token
    await requestAuthAndType(
      request(app)
        .post('/api/reset')
        .send({
          email: localUserName,
        } as PostRequestPasswordResetRequest),
      localUserToken
    ).expect(401);
  });

  it('initiate password reset for valid user', async () => {
    const response = await requestAuthAndType(
      request(app)
        .post('/api/reset')
        .send({
          email: localUserName,
        } as PostRequestPasswordResetRequest),
      adminToken
    ).expect(200);

    expect(response.body.code).to.be.a('string');
    expect(response.body.url).to.be.a('string');
    expect(response.body.url).to.include(response.body.code);
  });

  it('initiate password reset fails for invalid user', async () => {
    await requestAuthAndType(
      request(app)
        .post('/api/reset')
        .send({
          email: 'nonexistent@example.com',
        } as PostRequestPasswordResetRequest),
      adminToken
    ).expect(404);
  });

  it('complete password reset with valid code', async () => {
    // First get a user and create a reset code
    const localUser = await getExpressUserFromEmailOrUserId(localUserName);
    expect(localUser).to.not.be.undefined;

    const {code} = await createNewEmailCode(localUser!.user_id!);

    // Now try to reset the password
    const newPassword = 'NewSecurePassword123!';
    await request(app)
      .put('/api/reset')
      .send({
        code: code,
        newPassword: newPassword,
      } as PutRequestPasswordResetRequest)
      .expect(200);

    // Verify the code is now marked as used
    const hashedCode = hashVerificationCode(code);
    const codeDoc = await getCodeByCode(hashedCode);
    expect(codeDoc?.used).to.be.true;

    // Try to use the same code again - should fail
    await request(app)
      .put('/api/reset')
      .send({
        code: code,
        newPassword: 'AnotherPassword123!',
      } as PutRequestPasswordResetRequest)
      .expect(401);
  });

  it('complete password reset fails with invalid code', async () => {
    await request(app)
      .put('/api/reset')
      .send({
        code: 'invalid-code',
        newPassword: 'NewPassword123!',
      } as PutRequestPasswordResetRequest)
      .expect(401);
  });

  it('complete password reset fails with expired code', async () => {
    // Create a code with very short expiry
    const localUser = await getExpressUserFromEmailOrUserId(localUserName);
    const {code} = await createNewEmailCode(localUser!.user_id!, 10); // 10ms expiry

    // Wait for code to expire
    await new Promise(resolve => setTimeout(resolve, 100));

    await request(app)
      .put('/api/reset')
      .send({
        code: code,
        newPassword: 'NewPassword123!',
      } as PutRequestPasswordResetRequest)
      .expect(401);
  });

  it('email code validation works correctly', async () => {
    const localUser = await getExpressUserFromEmailOrUserId(localUserName);
    const {code} = await createNewEmailCode(localUser!.user_id!);

    // Valid code check
    let validation = await validateEmailCode(code);
    expect(validation.valid).to.be.true;
    expect(validation.user).to.not.be.undefined;
    expect(validation.validationError).to.be.undefined;

    // Check with correct user ID
    validation = await validateEmailCode(code, localUser!.user_id);
    expect(validation.valid).to.be.true;

    // Check with wrong user ID
    const adminUser = await getExpressUserFromEmailOrUserId(adminUserName);
    validation = await validateEmailCode(code, adminUser!.user_id);
    expect(validation.valid).to.be.false;

    // Mark code as used
    await markCodeAsUsed(code);
    validation = await validateEmailCode(code);
    expect(validation.valid).to.be.false;
    expect(validation.validationError).to.include('already been used');
  });
});
