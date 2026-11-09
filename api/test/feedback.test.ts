// SPDX-License-Identifier: Apache-2.0
import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
PouchDB.plugin(PouchDBFind);
PouchDB.plugin(require('pouchdb-adapter-memory'));

import {INPUT_LIMITS, registerClient} from '@faims3/data-model';
import {Request} from 'express';
import request from 'supertest';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {
  config,
  DEFAULT_FEEDBACK_RATE_LIMITER_PER_WINDOW,
  emailService,
} from '../src/buildconfig';
import {
  FEEDBACK_RATE_LIMITER,
  feedbackRateLimitKey,
} from '../src/feedbackRateLimiter';
import {app} from '../src/expressSetup';
import {buildFeedbackEmailOptions} from '../src/utils/emailHelpers';
import {callbackObject} from './mocks';
import {
  beforeApiTests,
  localEmail,
  localUserName,
  localUserToken,
  requestAuthAndType,
} from './utils';

registerClient(callbackObject);

const FEEDBACK_PATH = '/api/feedback';

function mockSendEmail() {
  return vi.spyOn(emailService, 'sendEmail').mockResolvedValue({
    messageId: 'feedback-test-message-id',
    response: 'sent',
    envelope: {from: 'test@example.com', to: ['support@fieldmark.au']},
  } as any);
}

describe('feedbackRateLimitKey', () => {
  it('prefers an authenticated user id', () => {
    expect(
      feedbackRateLimitKey({
        user: {user_id: 'alice'},
        ip: '203.0.113.10',
      } as Request)
    ).toBe('user:alice');
  });

  it('falls back to the request IP', () => {
    expect(
      feedbackRateLimitKey({
        ip: '203.0.113.10',
        socket: {remoteAddress: '198.51.100.1'},
      } as Request)
    ).toBe('203.0.113.10');
  });
});

describe('POST /api/feedback', () => {
  beforeEach(async () => {
    await beforeApiTests();
  });

  it('returns 200 and sends mail to the configured destination', async () => {
    const sendEmailSpy = mockSendEmail();
    const previousDestination = config.feedbackEmail;
    config.feedbackEmail = 'product@example.org';
    try {
      const result = await requestAuthAndType(
        request(app).post(FEEDBACK_PATH).send({message: 'The map is slow.'})
      );
      expect(result.status).toBe(200);
      expect(result.body).toEqual({success: true});
      expect(sendEmailSpy).toHaveBeenCalledTimes(1);
      expect(sendEmailSpy.mock.calls[0][0].options.to).toBe(
        'product@example.org'
      );
    } finally {
      config.feedbackEmail = previousDestination;
      sendEmailSpy.mockRestore();
    }
  });

  it('returns 401 without a bearer token and does not send mail', async () => {
    const sendEmailSpy = mockSendEmail();
    try {
      const result = await request(app)
        .post(FEEDBACK_PATH)
        .send({message: 'hello'});
      expect(result.status).toBe(401);
      expect(sendEmailSpy).not.toHaveBeenCalled();
    } finally {
      sendEmailSpy.mockRestore();
    }
  });

  it('returns 401 with an invalid token and does not send mail', async () => {
    const sendEmailSpy = mockSendEmail();
    try {
      const result = await request(app)
        .post(FEEDBACK_PATH)
        .set('Authorization', 'Bearer not-a-valid-token')
        .send({message: 'hello'});
      expect(result.status).toBe(401);
      expect(sendEmailSpy).not.toHaveBeenCalled();
    } finally {
      sendEmailSpy.mockRestore();
    }
  });

  it('returns 400 for empty, whitespace, over-long, invalid source, or unknown fields', async () => {
    const sendEmailSpy = mockSendEmail();
    try {
      const empty = await requestAuthAndType(
        request(app).post(FEEDBACK_PATH).send({message: ''})
      );
      expect(empty.status).toBe(400);

      const whitespace = await requestAuthAndType(
        request(app).post(FEEDBACK_PATH).send({message: '   '})
      );
      expect(whitespace.status).toBe(400);

      const tooLong = await requestAuthAndType(
        request(app)
          .post(FEEDBACK_PATH)
          .send({message: 'a'.repeat(INPUT_LIMITS.LONG_TEXT_MAX_LENGTH + 1)})
      );
      expect(tooLong.status).toBe(400);

      const invalidSource = await requestAuthAndType(
        request(app)
          .post(FEEDBACK_PATH)
          .send({message: 'hello', source: 'mobile'})
      );
      expect(invalidSource.status).toBe(400);

      const unknownFields = await requestAuthAndType(
        request(app)
          .post(FEEDBACK_PATH)
          .send({message: 'hello', user_id: 'attacker', email: 'a@b.c'})
      );
      expect(unknownFields.status).toBe(400);

      expect(sendEmailSpy).not.toHaveBeenCalled();
    } finally {
      sendEmailSpy.mockRestore();
    }
  });

  it('uses authenticated identity and HTML-escapes the message', async () => {
    const sendEmailSpy = mockSendEmail();
    try {
      const result = await requestAuthAndType(
        request(app).post(FEEDBACK_PATH).send({
          message: '<script>alert(1)</script>',
          source: 'app',
        }),
        localUserToken
      );
      expect(result.status).toBe(200);
      expect(sendEmailSpy).toHaveBeenCalledTimes(1);
      const options = sendEmailSpy.mock.calls[0][0].options;
      expect(options.html).toContain(`User ID: ${localUserName}`);
      expect(options.html).toContain(`Username: ${localUserName}`);
      expect(options.html).toContain(`Email: ${localEmail}`);
      expect(options.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
      expect(options.html).not.toContain('<script>alert(1)</script>');
      expect(options.replyTo).toBe(localEmail);
      expect(options.text).toContain('<script>alert(1)</script>');
    } finally {
      sendEmailSpy.mockRestore();
    }
  });
});

describe('Feedback rate limiter', () => {
  beforeEach(async () => {
    await beforeApiTests();
    config.feedbackRateLimiterEnabled = true;
    config.feedbackRateLimiterPerWindow = 2;
  });

  afterEach(() => {
    config.feedbackRateLimiterEnabled = false;
    config.feedbackRateLimiterPerWindow =
      DEFAULT_FEEDBACK_RATE_LIMITER_PER_WINDOW;
    FEEDBACK_RATE_LIMITER.resetKey('user:admin');
    FEEDBACK_RATE_LIMITER.resetKey('user:bobalooba');
    FEEDBACK_RATE_LIMITER.resetKey('127.0.0.1');
    FEEDBACK_RATE_LIMITER.resetKey('::ffff:127.0.0.1');
    FEEDBACK_RATE_LIMITER.resetKey('::1');
  });

  it('returns 429 after the per-user maximum and does not send a further mail', async () => {
    const sendEmailSpy = mockSendEmail();
    try {
      await requestAuthAndType(
        request(app).post(FEEDBACK_PATH).send({message: 'one'})
      ).expect(200);
      await requestAuthAndType(
        request(app).post(FEEDBACK_PATH).send({message: 'two'})
      ).expect(200);
      const limited = await requestAuthAndType(
        request(app).post(FEEDBACK_PATH).send({message: 'three'})
      );
      expect(limited.status).toBe(429);
      expect(limited.text).toMatch(/too many feedback/i);
      expect(sendEmailSpy).toHaveBeenCalledTimes(2);
    } finally {
      sendEmailSpy.mockRestore();
    }
  });
});

describe('buildFeedbackEmailOptions', () => {
  it('includes impersonator and target ids and escapes HTML in the HTML part', () => {
    const options = buildFeedbackEmailOptions({
      recipientEmail: 'support@fieldmark.au',
      message: 'See <b>this</b>',
      userId: 'target-user',
      username: 'Target',
      userEmail: 'target@example.com',
      impersonatingUserId: 'admin-user',
      source: 'web',
      category: 'bug',
      replyTo: 'target@example.com',
    });
    expect(options.html).toContain('User ID: target-user');
    expect(options.html).toContain('Impersonated by: admin-user');
    expect(options.html).toContain('See &lt;b&gt;this&lt;/b&gt;');
    expect(options.html).not.toContain('See <b>this</b>');
    expect(options.text).toContain('Impersonated by: admin-user');
  });
});
