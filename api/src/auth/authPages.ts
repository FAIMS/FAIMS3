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
 * Filename: src/auth_routes.ts
 * Description:
 *   This module exports the configuration of the build, including things like
 *   which server to use and whether to include test data
 */

import {
  AuthContext,
  CodeInputSchema,
  IdInputSchema,
  RedirectInputSchema,
} from '@faims3/data-model';
import {Router} from 'express';
import {z} from 'zod';
import validate from '../middleware/validate';
import {getInvite, isInviteValid} from '../couchdb/invites';
import {AuthAction} from '../types';
import {DEFAULT_REDIRECT_URL} from './authRoutes';
import {
  buildQueryString,
  providersToRenderDetails,
  validateRedirect,
} from './helpers';
import {verifyEmailWithCode} from '../api/verificationChallenges';
import patch from '../utils/patchExpressAsync';
import {validateEmailCode} from '../couchdb/emailReset';
import {RegisteredAuthProviders} from './strategies/applyStrategies';
import {config} from '../buildconfig';

// This must occur before express app is used
patch();

/**
 * Add authentication routes for local and federated login
 * The list of handlers are the ids of the configured federated handlers (eg. ['google'])
 * routes will be set up for each of these for auth and registration
 * See `auth_providers/index.ts` for registration of providers.
 *
 * @param app Express router
 * @param socialProviders an array of login provider identifiers
 */
export function addAuthPages(
  app: Router,
  socialProviders: RegisteredAuthProviders | null
) {
  // PAGES
  // =====

  // PAGE: This is the base auth handlebars route which is a login form +
  // providers if present
  app.get(
    '/login',
    validate({
      query: z.object({
        redirect: RedirectInputSchema.optional(),
        inviteId: IdInputSchema.optional(),
      }),
    }),
    (req, res) => {
      // Pull out the invite ID
      const inviteId = req.query.inviteId;

      const {valid, redirect} = validateRedirect(
        req.query.redirect || DEFAULT_REDIRECT_URL
      );

      if (!valid) {
        return res.render('redirect-error', {redirect});
      }

      const action: AuthAction = 'login';

      const providers = providersToRenderDetails({
        handlers: socialProviders,
        redirectUrl: redirect,
        inviteId,
        action,
      });

      const messages = req.flash();

      return res.render('login', {
        providers: providers.length > 0 ? providers : undefined,
        // Where should the POST endpoint be for the local login form?
        postUrl: '/auth/local',
        localLoginPostPayload: {
          action: 'login',
          inviteId: inviteId,
          redirect: redirect,
        } satisfies AuthContext,
        localAuth: config.localLoginEnabled,
        redirect,
        messages: messages,
      });
    }
  );

  /**
   * PAGE: Register for a notebook or team using an invite, if no existing
   * account then ask them to register.  User is authenticated in either case.
   * Return a redirect response to the given URL
   */
  app.get(
    '/register',
    validate({
      query: z.object({
        redirect: RedirectInputSchema.optional(),
        inviteId: IdInputSchema.optional(),
      }),
    }),
    async (req, res) => {
      // Check the redirect is valid
      const {valid, redirect} = validateRedirect(
        req.query.redirect || DEFAULT_REDIRECT_URL
      );

      if (!valid) {
        return res.render('redirect-error', {redirect});
      }

      // Pull out the invite ID
      const inviteId = req.query.inviteId;

      // Check it's present
      if (!inviteId) {
        return res.render('invite-error', {redirect});
      }

      // Validate the invite is okay
      const invite = await getInvite({inviteId});

      // If invite is not present or invalid
      if (!invite || !isInviteValid({invite}).isValid) {
        return res.render('invite-error', {redirect});
      }

      // need to sign up the user, show the registration page
      const providers = providersToRenderDetails({
        handlers: socialProviders,
        inviteId,
        redirectUrl: redirect,
        action: 'register',
      });

      return res.render('register', {
        invite: inviteId,
        // pass through on POST -> note that inviteId and redirect are hidden
        // form elements injected below
        postUrl: '/auth/local',
        // This is the URL which will be used for 'already have an account, sign
        // in' button
        loginURL: `/login${buildQueryString({
          values: {
            redirect,
            inviteId,
          },
        })}`,
        providers: providers.length > 0 ? providers : undefined,
        localRegisterPostPayload: {
          redirect,
          inviteId,
          action: 'register',
        } satisfies AuthContext,
        localAuth: config.localLoginEnabled,
        messages: req.flash(),
      });
    }
  );

  /**
   * PAGE: Change password form for local users
   */
  app.get(
    '/change-password',
    validate({
      query: z.object({
        // Where should we go once finished?
        redirect: RedirectInputSchema.optional(),
        // Require username as query param - this lets us know who the user is
        username: IdInputSchema,
      }),
    }),
    (req, res) => {
      const username = req.query.username;

      const {valid, redirect} = validateRedirect(
        req.query.redirect || DEFAULT_REDIRECT_URL
      );

      if (!valid) {
        return res.render('redirect-error', {redirect});
      }

      // Render the change password form
      return res.render('change-password', {
        // The POST endpoint to handle password change
        postUrl: '/auth/changePassword',
        changePasswordPostPayload: {
          username,
          redirect,
        },
        username,
        messages: req.flash(),
      });
    }
  );

  /*
   * PAGE: Email verification landing page
   * GET with code: shows a confirmation step (do not verify yet - avoids email
   * scanners consuming the code). User must click "Verify" to submit.
   * POST: performs verification and shows success or error.
   */
  app.get(
    '/verify-email',
    validate({
      query: z.object({
        code: CodeInputSchema.optional(),
        redirect: RedirectInputSchema.optional(),
      }),
    }),
    async (req, res) => {
      // Check the redirect is valid
      const {valid, redirect} = validateRedirect(
        req.query.redirect || DEFAULT_REDIRECT_URL
      );

      if (!valid) {
        return res.render('redirect-error', {redirect});
      }

      // Pull out the verification code
      const code = req.query.code;

      // If no code was provided, show an error
      if (!code) {
        req.flash('error', 'No verification code was provided.');
        return res.render('verify-email', {
          success: false,
          pending: false,
          redirect,
          messages: req.flash(),
        });
      }

      // Show confirmation step only; do not verify yet (user must click button)
      return res.render('verify-email', {
        pending: true,
        code,
        redirect: valid ? redirect : DEFAULT_REDIRECT_URL,
      });
    }
  );

  app.post(
    '/verify-email',
    validate({
      body: z.object({
        code: CodeInputSchema,
        redirect: RedirectInputSchema.optional(),
      }),
    }),
    async (req, res) => {
      const {code, redirect: redirectParam} = req.body;
      const {valid, redirect} = validateRedirect(
        redirectParam || DEFAULT_REDIRECT_URL
      );

      if (!valid) {
        return res.render('redirect-error', {redirect});
      }

      const result = await verifyEmailWithCode({code});

      if (!result.success) {
        return res.render('verify-email', {
          success: false,
          pending: false,
          redirect,
          messages: {
            error:
              result.error ||
              'Failed to verify email. The code may be invalid or expired.',
          },
        });
      }

      return res.render('verify-email', {
        success: true,
        pending: false,
        email: result.email,
        redirect,
      });
    }
  );

  /**
   * PAGE: Forgot password form
   * Allows the user to enter their email to receive a password reset link
   */
  app.get(
    '/forgot-password',
    validate({
      query: z.object({
        redirect: RedirectInputSchema.optional(),
      }),
    }),
    async (req, res) => {
      const {valid, redirect} = validateRedirect(
        req.query.redirect || DEFAULT_REDIRECT_URL
      );

      if (!valid) {
        return res.render('redirect-error', {redirect});
      }

      return res.render('forgot-password', {
        postUrl: '/auth/forgotPassword',
        forgotPasswordPostPayload: {
          redirect,
        },
        messages: req.flash(),
      });
    }
  );

  /**
   * PAGE: Reset password form
   * Allows the user to set a new password using a reset code
   */
  app.get(
    '/auth/reset-password',
    validate({
      query: z.object({
        code: CodeInputSchema,
        redirect: RedirectInputSchema,
      }),
    }),
    async (req, res) => {
      const code = req.query.code;
      const {valid, redirect} = validateRedirect(req.query.redirect);

      if (!valid) {
        return res.render('redirect-error', {redirect});
      }

      // Validate the code
      const validationResult = await validateEmailCode(code);

      if (!validationResult.valid || !validationResult.user) {
        return res.render('reset-password-error', {
          error: validationResult.validationError || 'Invalid reset code.',
          loginUrl: '/login',
          forgotPasswordUrl: '/forgot-password',
        });
      }

      return res.render('reset-password', {
        postUrl: '/auth/resetPassword',
        resetCode: code,
        redirect,
        messages: req.flash(),
      });
    }
  );
}
