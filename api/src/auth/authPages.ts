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

import {AuthContext} from '@faims3/data-model';
import {Router} from 'express';
import {z} from 'zod';
import {processRequest} from 'zod-express-middleware';
import {AuthProvider} from '../buildconfig';
import {getInvite, isInviteValid} from '../couchdb/invites';
import {AuthAction} from '../types';
import {DEFAULT_REDIRECT_URL} from './authRoutes';
import {
  buildQueryString,
  providersToRenderDetails,
  validateRedirect,
} from './helpers';

import patch from '../utils/patchExpressAsync';

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
export function addAuthPages(app: Router, socialProviders: AuthProvider[]) {
  // PAGES
  // =====

  // PAGE: This is the base auth handlebars route which is a login form +
  // providers if present
  app.get(
    '/login',
    processRequest({
      query: z.object({
        redirect: z.string().optional(),
        inviteId: z.string().optional(),
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

      return res.render('login', {
        providers: providers.length > 0 ? providers : undefined,
        // Where should the POST endpoint be for the local login form?
        postUrl: '/auth/local',
        localLoginPostPayload: {
          action: 'login',
          inviteId: inviteId,
          redirect: redirect,
        } satisfies AuthContext,
        localAuth: true,
        redirect,
        messages: req.flash(),
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
    processRequest({
      query: z.object({
        redirect: z.string().optional(),
        inviteId: z.string().optional(),
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
        localAuth: true,
        messages: req.flash(),
      });
    }
  );

  /**
   * PAGE: Change password form for local users
   */
  app.get(
    '/change-password',
    processRequest({
      query: z.object({
        // Where should we go once finished?
        redirect: z.string().optional(),
        // Require username as query param - this lets us know who the user is
        username: z.string(),
      }),
    }),
    (req, res) => {
      const {valid, redirect} = validateRedirect(
        req.query.redirect || DEFAULT_REDIRECT_URL
      );

      if (!valid) {
        return res.render('redirect-error', {redirect});
      }

      const username = req.query.username;

      // Render the change password form
      return res.render('change-password', {
        // The POST endpoint to handle password change
        postUrl: '/auth/change-password',
        changePasswordPostPayload: {
          username,
          redirect,
        },
        username,
        messages: req.flash(),
      });
    }
  );
}
