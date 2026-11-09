// SPDX-License-Identifier: Apache-2.0

/*
 * Description:
 *   Authenticated in-app feedback. Posts a short message that Conductor
 *   emails to the configured support inbox. Identity is taken from the
 *   access token; the dedicated per-user limiter is independent of the
 *   global IP limiter.
 */

import {
  PostFeedbackRequestSchema,
  PostFeedbackResponse,
} from '@faims3/data-model';
import express, {Response} from 'express';
import {config} from '../buildconfig';
import * as Exceptions from '../exceptions';
import {feedbackRateLimit} from '../feedbackRateLimiter';
import {nowIso} from '../time';
import {requireAuthenticationAPI} from '../middleware';
import validate from '../middleware/validate';
import {sendFeedbackEmail} from '../utils/emailHelpers';
import patch from '../utils/patchExpressAsync';

patch();

export const api: express.Router = express.Router();

/**
 * Email on the authenticated account, if any. Identity is never read from
 * the request body.
 */
function submitterEmail(user: globalThis.Express.User): string | undefined {
  return user.emails[0]?.email;
}

/**
 * POST /api/feedback
 * Send a short feedback message to the configured support inbox.
 */
api.post(
  '/',
  requireAuthenticationAPI,
  feedbackRateLimit,
  validate({body: PostFeedbackRequestSchema}),
  async (req, res: Response<PostFeedbackResponse>) => {
    if (!req.user) {
      throw new Exceptions.UnauthorizedException();
    }

    const user = req.user;
    const {message, source, category, path, clientVersion, userAgent} =
      req.body;
    const userEmail = submitterEmail(user);
    const replyTo = userEmail || config.email.replyTo || config.email.fromEmail;

    if (!config.runningUnderTest) {
      console.log(
        `[Feedback] user=${user.user_id} source=${source ?? 'unspecified'} category=${category ?? 'unspecified'} at=${nowIso()}`
      );
    }

    try {
      await sendFeedbackEmail({
        recipientEmail: config.feedbackEmail,
        message,
        userId: user.user_id,
        username: user.name || user.user_id,
        userEmail,
        impersonatingUserId: user.impersonatingUserId,
        source,
        category,
        path,
        clientVersion,
        userAgent,
        replyTo,
      });
    } catch (error) {
      if (!config.runningUnderTest) {
        console.error('[Feedback] Failed to send email', error);
      }
      throw new Exceptions.ServiceUnavailableException(
        'Unable to send feedback right now. Please try again later.'
      );
    }

    res.json({success: true});
  }
);
