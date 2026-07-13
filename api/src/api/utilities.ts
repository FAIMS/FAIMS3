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
 * Description:
 *   This module contains utility routes at /api
 */

import {
  Action,
  ErrorResponse,
  PostExchangeTokenInputSchema,
  PostExchangeTokenResponse,
  PostLongLivedTokenExchangeInputSchema,
  PostLongLivedTokenExchangeResponse,
  PostRefreshTokenInputSchema,
  PostRefreshTokenResponse,
  PublicServerInfo,
} from '@faims3/data-model';
import express, {Response} from 'express';
import multer from 'multer';
import validate from '../middleware/validate';
import {z} from 'zod';
import {
  generateUserToken,
  upgradeCouchUserToExpressUser,
} from '../auth/keySigning/create';
import {config, emailService} from '../buildconfig';
import {initialiseDbAndKeys} from '../couchdb';
import {restoreFromBackup} from '../couchdb/backupRestore';
import {getUserProjectsDirectory} from '../couchdb/notebooks';
import {
  consumeExchangeTokenForRefreshToken,
  validateRefreshToken,
} from '../couchdb/refreshTokens';
import * as Exceptions from '../exceptions';
import {
  isAllowedToMiddleware,
  optionalAuthenticationJWT,
  requireAuthenticationAPI,
} from '../middleware';
import patch from '../utils/patchExpressAsync';
import {validateLongLivedToken} from '../couchdb/longLivedTokens';
import {nowIso} from '../time';
import {hashChallengeCode} from '../utils';

// TODO: configure this directory
// Cap the restore upload size (configurable via RESTORE_UPLOAD_MAX_BYTES)
const upload = multer({
  dest: '/tmp/',
  limits: {fileSize: config.restoreUploadMaxBytes},
});

// This must occur before express api is used
patch();

export const api: express.Router = express.Router();

api.get('/hello/', requireAuthenticationAPI, (_req: any, res: any) => {
  res.send({message: 'hello from the api!'});
});

/**
 * POST to /api/initialise does initialisation on the databases
 * - this does not have any auth requirement because it should be used
 *   to set up the users database and create the admin user
 *   if databases exist, this is a no-op
 */
api.post('/initialise/', async (req, res) => {
  initialiseDbAndKeys({force: false});
  res.json({success: true});
});

/**
 * Forcefully re-initialise the DB i.e. disable checks for existing design
 * documents.
 */
api.post(
  '/forceInitialise',
  requireAuthenticationAPI,
  isAllowedToMiddleware({action: Action.INITIALISE_SYSTEM_API}),
  async (req, res) => {
    await initialiseDbAndKeys({force: true});
    res.json({success: true});
  }
);

/**
 * Handle info requests, basic identifying information for this server
 */
api.get('/info', async (req, res) => {
  const response: PublicServerInfo = {
    id: config.conductorServerId,
    name: config.conductorInstanceName,
    conductor_url: config.conductorPublicUrl,
    description: config.instanceDescription,
    prefix: config.shortCodePrefix,
    // Report the server version e.g. 1.3.1
    serverVersion: config.apiVersion,
  };
  res.json(response);
});

api.get(
  '/directory/',
  requireAuthenticationAPI,
  isAllowedToMiddleware({action: Action.LIST_PROJECTS}),
  validate({
    query: z.object({
      /** When `"true"`, includes surveys with status ARCHIVED. Default excludes them. */
      includeArchived: z.enum(['true', 'false']).optional(),
    }),
  }),
  async (req, res) => {
    if (!req.user) {
      throw new Exceptions.UnauthorizedException();
    }
    const includeArchived = req.query.includeArchived === 'true';
    const projects = await getUserProjectsDirectory(req.user, includeArchived);
    res.json(projects);
  }
);

/**
 * Token exchange - trade an exchange token for a refresh + access token.
 */
api.post(
  '/auth/exchange',
  optionalAuthenticationJWT,
  validate({body: PostExchangeTokenInputSchema}),
  async (
    {user, body: {exchangeToken}},
    res: Response<PostExchangeTokenResponse>
  ) => {
    // If the user is logged in - then record the user ID as an additional
    // security measure - don't allow a user who currently has a JWT of user
    // A, to use a refresh token for user B, but if the user is not logged in
    // at all (e.g. JWT expired) we still want to ensure they can generate a
    // fresh JWT
    const userId: string | undefined = user?._id;

    // validate the token
    const {
      valid,
      user: resultingUser,
      refreshDocument,
    } = await consumeExchangeTokenForRefreshToken({exchangeToken, userId});

    // If the refresh token / exchange token is not valid, let user know (ambiguously)
    if (!valid || !refreshDocument || !resultingUser) {
      throw new Exceptions.InvalidRequestException(
        'Validation of exchange token failed.'
      );
    }

    // We know the refresh is valid, generate a JWT (no refresh) for this
    // existing user.
    // From the db user, drill and generate permissions
    const expressUser = await upgradeCouchUserToExpressUser({
      dbUser: resultingUser,
    });
    const {token} = await generateUserToken(expressUser, false, {
      impersonatingUserId: refreshDocument.impersonatingUserId,
    });

    // return the tokens
    res.json({accessToken: token, refreshToken: refreshDocument.token});
  }
);

/**
 * Refresh - get a new JWT using a refresh token.
 *
 * Anyone can use this route, since your access token may have expired
 */
api.post(
  '/auth/refresh',
  optionalAuthenticationJWT,
  validate({body: PostRefreshTokenInputSchema}),
  async (req, res: Response<PostRefreshTokenResponse | ErrorResponse>) => {
    // If the user is logged in - then record the user ID as an additional
    // security measure - don't allow a user who currently has a JWT of user
    // A, to use a refresh token for user B, but if the user is not logged in
    // at all (e.g. JWT expired) we still want to ensure they can generate a
    // fresh JWT
    const userId: string | undefined = req.user?._id;

    // validate the token
    const {valid, validationError, user, impersonatingUserId} =
      await validateRefreshToken(req.body.refreshToken, userId);

    // If the refresh token is not valid, let user know
    if (!valid) {
      // Explicitly return a response here so that we're not reporting an error eg. to BugSnag
      res.status(400).json({
        error: {
          message: `Validation of refresh token failed. Validation error: ${validationError}.`,
          status: 400,
        },
      });
      return;
    }

    // We know the refresh is valid, generate a JWT (no refresh) for this
    // existing user.
    // From the db user, drill and generate permissions
    const expressUser = await upgradeCouchUserToExpressUser({dbUser: user!});

    const {token} = await generateUserToken(expressUser, false, {
      impersonatingUserId: impersonatingUserId ?? req.user?.impersonatingUserId,
    });

    // return the token
    res.json({token});
  }
);

/**
 * Long-lived token exchange - get a new JWT using a long-lived API token.
 *
 * This endpoint allows users to authenticate using their long-lived API tokens
 * to receive a short-lived access token for API access.
 */
api.post(
  '/auth/exchange-long-lived-token',
  validate({
    body: PostLongLivedTokenExchangeInputSchema,
  }),
  async (req, res: Response<PostLongLivedTokenExchangeResponse>) => {
    const {token} = req.body;

    // Hash the provided token to match against stored hashes
    const tokenHash = hashChallengeCode(token);

    // Validate the long-lived token
    const {
      valid,
      validationError,
      user,
      token: tokenRecord,
    } = await validateLongLivedToken(
      tokenHash,
      true // Update last used timestamp
    );

    // If the token is not valid, let user know
    if (!valid || !user) {
      throw new Exceptions.UnauthorizedException(
        `Authentication with long-lived token failed. ${validationError || 'Invalid token.'}`
      );
    }

    // Generate a JWT (no refresh) for this user
    const expressUser = await upgradeCouchUserToExpressUser({dbUser: user});
    const {token: accessToken} = await generateUserToken(expressUser, false);

    // Log the token usage for security auditing
    if (!config.runningUnderTest) {
      console.log(
        `[Long-Lived Token] Token "${tokenRecord?.title}" used by user ${user._id} at ${nowIso()}`
      );
    }

    // Return the access token
    res.json({token: accessToken});
  }
);

if (config.developerMode) {
  api.post(
    '/restore',
    requireAuthenticationAPI,
    isAllowedToMiddleware({action: Action.RESTORE_FROM_BACKUP}),
    upload.single('backup'),
    async (req: any, res) => {
      await restoreFromBackup(req.file.path);
      res.json({status: 'success'});
    }
  );
}

/**
 * Email testing route to verify email service configuration
 */
api.post(
  '/admin/test-email',
  requireAuthenticationAPI,
  isAllowedToMiddleware({action: Action.SEND_TEST_EMAIL}),
  async (req, res) => {
    if (!req.user) {
      throw new Exceptions.UnauthorizedException('Authentication required.');
    }

    const startTime = Date.now();

    // Log starting the test
    if (!config.runningUnderTest) {
      console.log(
        `[Email Test] Starting email test requested by admin user ${req.user._id}`
      );
    }

    const responseData = {
      success: false,
      status: 'unknown',
      message: '',
      details: {},
      timings: {
        total: 0,
        configValidation: 0,
        emailSending: 0,
      },
    };

    try {
      // Start timing the config validation
      const configStartTime = Date.now();

      const testEmailAddress = config.testEmailAddress;
      if (!testEmailAddress) {
        throw new Error(
          'TEST_EMAIL_ADDRESS environment variable is required for testing email functionality. ' +
            'Please add this to your environment configuration.'
        );
      }

      // End timing for config validation
      const configEndTime = Date.now();
      responseData.timings.configValidation = configEndTime - configStartTime;

      // Build the debug email content
      const emailOptions = {
        to: testEmailAddress,
        subject: `Email Service Test from ${config.conductorInstanceName}`,
        html: `
          <h1>Email Service Test</h1>
          <p>This is a test email from the ${config.conductorInstanceName} server.</p>
          <h2>Service Information</h2>
          <ul>
            <li><strong>Server:</strong> ${config.conductorInstanceName}</li>
            <li><strong>Conductor URL:</strong> ${config.conductorPublicUrl}</li>
            <li><strong>Email Service Type:</strong> ${config.emailServiceType}</li>
            <li><strong>From Address:</strong> ${config.email.fromEmail}</li>
            <li><strong>From Name:</strong> ${config.email.fromName}</li>
            <li><strong>Test Address:</strong> ${testEmailAddress}</li>
            <li><strong>Time Generated:</strong> ${nowIso()}</li>
            <li><strong>Requested by:</strong> ${req.user._id}</li>
          </ul>
          <p>If you received this email, the email service is configured correctly.</p>
        `,
        text: `
Email Service Test

This is a test email from the ${config.conductorInstanceName} server.

Service Information:
- Server: ${config.conductorInstanceName}
- Conductor URL: ${config.conductorPublicUrl}
- Email Service Type: ${config.emailServiceType}
- From Address: ${config.email.fromEmail}
- From Name: ${config.email.fromName}
- Test Address: ${testEmailAddress}
- Time Generated: ${nowIso()}
- Requested by: ${req.user._id}

If you received this email, the email service is configured correctly.
        `,
      };

      // Log sending attempt
      if (!config.runningUnderTest) {
        console.log(
          `[Email Test] Attempting to send test email to ${testEmailAddress}`
        );
      }

      // Start timing the email sending
      const emailStartTime = Date.now();

      // Send the test email
      const emailResult = await emailService.sendEmail({
        options: emailOptions,
      });

      // End timing for email sending
      const emailEndTime = Date.now();
      responseData.timings.emailSending = emailEndTime - emailStartTime;

      // Email sent successfully
      responseData.success = true;
      responseData.status = 'sent';
      responseData.message = `Test email successfully sent to ${testEmailAddress}`;
      responseData.details = {
        messageId: emailResult.messageId,
        recipient: testEmailAddress,
        emailServiceType: config.emailServiceType,
        emailResponse: emailResult.response,
      };

      if (!config.runningUnderTest) {
        console.log(
          `[Email Test] Test email sent successfully. Message ID: ${emailResult.messageId}`
        );
      }
    } catch (error: any) {
      // Email failed to send
      responseData.success = false;
      responseData.status = 'error';
      responseData.message = `Failed to send test email: ${error.message}`;

      // Prepare detailed error information
      const errorDetail = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        suggestion: '',
      };

      // Check for specific error types to provide better guidance
      if (error.code === 'ECONNREFUSED') {
        errorDetail.suggestion =
          'SMTP server connection refused. Check your SMTP host and port configuration.';
      } else if (error.code === 'ETIMEDOUT') {
        errorDetail.suggestion =
          'Connection to SMTP server timed out. Check your network configuration and SMTP server availability.';
      } else if (error.code === 'EAUTH') {
        errorDetail.suggestion =
          'Authentication failed. Check your SMTP username and password.';
      } else if (error.message.includes('getaddrinfo')) {
        errorDetail.suggestion =
          'DNS resolution failed. Check your SMTP host configuration.';
      }

      responseData.details = {error: errorDetail};

      console.error('[Email Test] Failed to send test email:', error);
    } finally {
      // Calculate total execution time
      const endTime = Date.now();
      responseData.timings.total = endTime - startTime;

      // Log test completion
      if (!config.runningUnderTest) {
        console.log(
          `[Email Test] Email test complete. Status: ${responseData.status}. Duration: ${responseData.timings.total}ms`
        );
      }

      // Return the result to the client
      res.json(responseData);
    }
  }
);
