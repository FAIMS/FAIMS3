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
  AuthContextSchema,
  PeopleDBDocument,
  PostLoginInput,
  PostLoginInputSchema,
  PostRegisterInput,
  PostRegisterInputSchema,
} from '@faims3/data-model';
import {NextFunction, Router} from 'express';
import passport from 'passport';
import {processRequest} from 'zod-express-middleware';
import {upgradeCouchUserToExpressUser} from './keySigning/create';
import {AuthProvider, WEBAPP_PUBLIC_URL} from '../buildconfig';
import {
  getCouchUserFromEmailOrUsername,
  saveCouchUser,
  saveExpressUser,
} from '../couchdb/users';
import {AuthAction, CustomSessionData} from '../types';
import {
  buildQueryString,
  handleZodErrors,
  redirectWithToken,
  registerLocalUser,
  validateAndApplyInviteToUser,
  validateRedirect,
} from './helpers';
import {AUTH_PROVIDER_DETAILS} from './strategies/applyStrategies';

import patch from '../utils/patchExpressAsync';

// This must occur before express app is used
patch();

// This is the place to go if all else fails - it will have a token!
export const DEFAULT_REDIRECT_URL = WEBAPP_PUBLIC_URL + '/auth-return';

/**
 * Add authentication routes for local and federated login
 * The list of handlers are the ids of the configured federated handlers (eg. ['google'])
 * routes will be set up for each of these for auth and registration
 * See `auth_providers/index.ts` for registration of providers.
 *
 * @param app Express router
 * @param socialProviders an array of login provider identifiers
 */
export function addAuthRoutes(app: Router, socialProviders: AuthProvider[]) {
  /**
   * Handle local login OR register request with username and password
   */
  app.post('/auth/local', async (req, res, next: NextFunction) => {
    // determine the action first
    const action = req.body.action as AuthAction;

    if (action === 'login') {
      // LOGIN
      // ========

      // parse the body as the login schema
      let loginPayload: PostLoginInput;

      const errorRedirect = `/login${buildQueryString({
        values: {
          inviteId: req.body.inviteId,
          redirect: req.body.redirect,
        },
      })}`;

      // If anything goes wrong - flash back to form fields
      try {
        loginPayload = PostLoginInputSchema.parse(req.body);
      } catch (validationError) {
        const handled = handleZodErrors({
          error: validationError,
          // type hacking here due to override not being picked up
          req: req as unknown as Request,
          res,
          formData: {email: req.body.email, name: req.body.name},
          redirect: errorRedirect,
        });
        if (!handled) {
          console.error('Auth error:', validationError);
          req.flash('error', 'An unexpected error occurred');
          res.status(500).redirect(errorRedirect);
          return;
        }
        return;
      }

      // Now we have a validated login payload - proceed

      // Are we redirecting?
      const redirect = validateRedirect(
        loginPayload.redirect || DEFAULT_REDIRECT_URL
      );
      // Is there an invite present?
      const inviteId = loginPayload.inviteId;

      // Login with local passport strategy - catching the on success to apply
      // invite (if present) and redirect with token back to client
      // application (at redirect URL requested)
      return passport.authenticate(
        // local strategy (user/pass)
        'local',
        // do not use session (JWT only - no persistence)
        {session: false},
        // custom success function which signs JWT and redirects
        async (err: string | Error | null, user: Express.User) => {
          if (err) {
            req.flash('error', {loginError: {msg: err}});
            return res.redirect(errorRedirect);
          }
          // We have logged in - do we also want to consume an invite?
          if (inviteId) {
            // We have an invite to consume - go ahead and use it
            await validateAndApplyInviteToUser({
              inviteCode: inviteId,
              dbUser: user,
            });
            // avoid saving unwanted details here
            await saveExpressUser(user);
          }
          // No longer login user with session - now redirect straight back with
          // token
          return redirectWithToken({res, user, redirect});
        }
      )(req, res, next);
    } else if (action === 'register') {
      // REGISTER
      // ========

      // parse the body as the login schema
      let registerPayload: PostRegisterInput;

      const errorRedirect = `/register${buildQueryString({
        values: {
          inviteId: req.body.inviteId,
          redirect: req.body.redirect,
        },
      })}`;

      // If anything goes wrong - flash back to form fields
      try {
        registerPayload = PostRegisterInputSchema.parse(req.body);
      } catch (validationError) {
        const handled = handleZodErrors({
          error: validationError,
          // type hacking here due to override not being picked up
          req: req as unknown as Request,
          res,
          formData: {email: req.body.email, name: req.body.name},
          redirect: errorRedirect,
        });
        if (!handled) {
          req.flash('error', 'An unexpected error occurred');
          res.status(500).redirect(errorRedirect);
          return;
        }
        return;
      }

      // Now we have a validated register payload - proceed

      // Are we redirecting?
      const redirect = validateRedirect(
        registerPayload.redirect || DEFAULT_REDIRECT_URL
      );
      // Is there an invite present?
      const inviteId = registerPayload.inviteId;

      if (!inviteId) {
        // 400 error as this is an invalid request
        res.status(400);
        req.flash('error', {
          registration: 'No invite provided for registration.',
        });
        // go back to auth homepage
        res.redirect('/auth');
        return;
      }

      // Check our payload for required fields
      const password = registerPayload.password;
      const repeat = registerPayload.repeat;
      const name = registerPayload.name;
      const email = registerPayload.email;

      if (password !== repeat) {
        req.flash('error', {
          repeat: {msg: "Password and repeat don't match."},
        });
        req.flash('email', email);
        req.flash('name', name);
        res.status(400);

        // This is the registration page - let's go back with full auth
        // context
        res.redirect(errorRedirect);
        return;
      }

      // Build the user creation hook which will run once the invite is
      // accepted and consumed
      const createUser = async () => {
        // this will throw if the user already exists
        const [user, error] = await registerLocalUser(
          // Email is used as username
          {username: email, email, name, password}
        );
        if (!user) {
          req.flash('error', {registration: error});
          req.flash('email', email);
          req.flash('name', name);
          res.status(400);
          res.redirect(errorRedirect);
          throw Error(
            'User could not be created due to an issue writing to the database!'
          );
        }
        return user;
      };

      // Do we have an existing user if so - reuse our login behaviour instead!
      // (This checks the password is correct)
      if (await getCouchUserFromEmailOrUsername(email)) {
        return passport.authenticate(
          // local strategy (user/pass)
          'local',
          // do not use session (JWT only - no persistence)
          {session: false},
          // custom success function which signs JWT and redirects
          async (err: string | Error | null, user: Express.User) => {
            if (err) {
              req.flash('error', {registrationError: {msg: err}});
              return res.redirect(errorRedirect);
            }
            // We have logged in - do we also want to consume an invite?
            if (inviteId) {
              // We have an invite to consume - go ahead and use it
              await validateAndApplyInviteToUser({
                inviteCode: inviteId,
                dbUser: user,
              });
              // avoid saving unwanted details here
              await saveExpressUser(user);
            }
            // No longer login user with session - now redirect straight back with
            // token
            return redirectWithToken({res, user, redirect});
          }
        )(req, res, next);
      }

      let createdDbUser: PeopleDBDocument;
      try {
        createdDbUser = await validateAndApplyInviteToUser({
          // We don't have this yet
          dbUser: undefined,
          // instead we generate it once invite is OK
          createUser,
          // Pass in the invite - it's all validated
          inviteCode: inviteId,
        });
      } catch (e) {
        res.status(400);
        req.flash('error', {
          registrationError:
            'Invite is not valid for registration! Is it expired, or has been used too many times?',
        });
        res.redirect(errorRedirect);
        return;
      }

      req.flash('message', 'Registration successful');

      // Upgrade to express.User by drilling permissions/associations
      const expressUser = await upgradeCouchUserToExpressUser({
        dbUser: createdDbUser,
      });

      // No longer req.login - instead redirect directly with token!
      return redirectWithToken({res, user: expressUser, redirect});
    }
  });

  // For each handler, deploy an auth route + auth return route
  for (const handler of socialProviders) {
    const handlerDetails = AUTH_PROVIDER_DETAILS[handler];

    // **Login OR register** method for this handler - this will result in a
    // redirection to the configured providers URL, then called back to the
    // configured callback (see below)
    app.get(
      `/auth/${handler}`,
      processRequest({
        query: AuthContextSchema,
      }),

      /**
       * The purpose of this handler is to store necessary information into the
       * session before passport manages the redirection off to the provider.
       * The callback function will then be called (below).
       */
      (req, res, next) => {
        // pull out session data
        const sessionData = req.session as CustomSessionData;

        // check redirect and store in session
        const redirect = validateRedirect(
          req.query.redirect || DEFAULT_REDIRECT_URL
        );
        const inviteId = req.query.inviteId;
        const action = req.query.action;

        // Store into session (we are about to be redirected! Bye bye)
        sessionData.redirect = redirect;
        if (inviteId) sessionData.inviteId = inviteId;
        if (action) sessionData.action = action;

        // passport authenticate route for this handler (bye bye)
        passport.authenticate(handlerDetails.id, {scope: handlerDetails.scope})(
          req,
          res,
          next
        );
      }
    );

    // the callback URL for this provider - all we need to do is call the
    // validate function again since we will have come back with enough info now
    app.get(handlerDetails.relativeLoginCallbackUrl, (req, res, next) => {
      // we expect these values! (Or some of them e.g. invite may not be
      // present)
      const redirectValues = {
        inviteId: (req.session as CustomSessionData).inviteId,
        redirect: (req.session as CustomSessionData).redirect,
        action: (req.session as CustomSessionData).action,
      };
      const loginErrorRedirect = `/login${buildQueryString({
        values: redirectValues,
      })}`;
      const registerErrorRedirect = `/register${buildQueryString({
        values: redirectValues,
      })}`;
      // authenticate using the associated validate function
      passport.authenticate(
        handlerDetails.id,
        // custom success function which signs JWT and redirects
        async (err: string | Error | null, user: Express.User) => {
          // We have come back from EITHER login or registration. In either case
          // we have either a newly minted user, or an updated existing one -
          // now we just apply an invite if present

          // firstly throw error if needed (flash it out and redirect to the
          // right place returning with full context for another attempt)
          if (err) {
            if ((req.session as CustomSessionData).action === 'login') {
              req.flash('error', {loginError: {msg: err}});
              return res.redirect(loginErrorRedirect);
            } else {
              req.flash('error', {registrationError: {msg: err}});
              return res.redirect(registerErrorRedirect);
            }
          }

          const inviteId = (req.session as CustomSessionData).inviteId;
          if (inviteId) {
            // apply invite
            const updatedUser = await validateAndApplyInviteToUser({
              inviteCode: inviteId,
              dbUser: user,
            });
            // save
            await saveCouchUser(updatedUser);
          }

          const redirect = validateRedirect(
            (req.session as CustomSessionData)?.redirect || DEFAULT_REDIRECT_URL
          );

          return redirectWithToken({res, user, redirect});
        }
      )(req, res, next);
    });
  }
}
