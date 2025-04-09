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
  GetRegisterByInviteQuerySchema,
  PeopleDBDocument,
  PostLocalAuthInputSchema,
  PostRegisterLocalInputSchema,
} from '@faims3/data-model';
import {NextFunction, Response, Router} from 'express';
import {body, validationResult} from 'express-validator';
import passport from 'passport';
import {z} from 'zod';
import {processRequest} from 'zod-express-middleware';
import {AUTH_PROVIDER_DETAILS} from './auth_providers';
import {
  registerLocalUser,
  validateAndApplyInviteToUser,
} from './auth_providers/helpers';
import {
  generateUserToken,
  upgradeCouchUserToExpressUser,
} from './authkeys/create';
import {
  AuthProvider,
  CONDUCTOR_PUBLIC_URL,
  WEBAPP_PUBLIC_URL,
} from './buildconfig';
import {getInvite, isInviteValid} from './couchdb/invites';
import {
  getCouchUserFromEmailOrUsername,
  saveExpressUser,
} from './couchdb/users';
import {CustomSessionData} from './types';

/**
 * Check that a redirect URL is one that we allow
 * Mainly want to avoid a non-url redirect so just check
 * that we can parse it as a URL.
 * Could have a whitelist here but hard to manage in config
 * and might restrict how we use auth in the project.
 *
 * @param redirect URL to redirect to
 * @returns a valid URl to redirect to, default to '/' if
 *   the one passed in is bad
 */
function validateRedirect(redirect: string) {
  if (URL.canParse(redirect)) return redirect;
  else return '/';
}

/**
 * Builds render details for providers
 */
function buildRenderProviders({
  handlers,
  redirectUrl,
  inviteId,
}: {
  handlers: AuthProvider[];
  redirectUrl: string;
  inviteId?: string;
}) {
  const providers = [];
  for (const handler of handlers) {
    const details = AUTH_PROVIDER_DETAILS[handler];
    providers.push({
      // Validate label vs name?
      label: details.id,
      name: details.id,
      targetUrl: `/auth/${details.id}?redirect=${redirectUrl}${inviteId ? '&inviteId=' + inviteId : ''}`,
    });
  }
  return providers;
}

/**
 * Add authentication routes for local and federated login
 * The list of handlers are the ids of the configured federated handlers (eg. ['google'])
 * routes will be set up for each of these for auth and registration
 * See `auth_providers/index.ts` for registration of providers.
 *
 * @param app Express router
 * @param handlers an array of login provider identifiers
 */
export function addAuthRoutes(app: Router, handlers: AuthProvider[]) {
  // This is the base auth handlebars route which is a login form + providers if
  // present
  app.get(
    '/auth',
    processRequest({
      query: z.object({
        redirect: z.string().optional(),
        inviteId: z.string().optional(),
      }),
    }),
    async (req, res) => {
      // Pull out the invite ID
      const inviteId = req.query.inviteId;

      const redirect = validateRedirect(
        // TODO desired behaviour in case of no redirect?
        req.query.redirect ?? WEBAPP_PUBLIC_URL
      );

      const providers = buildRenderProviders({
        handlers,
        redirectUrl: redirect,
        inviteId,
      });
      res.render('auth', {
        providers: providers.length > 0 ? providers : undefined,
        postUrl: `/auth/local?redirect=${redirect}${inviteId ? '&inviteId=' + inviteId : ''}`,
        localAuth: true,
        redirect: redirect,
        layout: 'auth',
      });
    }
  );

  /**
   * Generate a redirect response with a token and refresh token for a logged in
   * user
   *
   * @param res Express response
   * @param user Express user
   * @param redirect URL to redirect to
   * @returns a redirect response with a suitable token
   */
  const redirectWithToken = async ({
    res,
    user,
    redirect,
  }: {
    res: Response;
    user: Express.User;
    redirect: string;
  }) => {
    // there is a case where the redirect url will already
    // have a token (register >> login >>  register)
    if (redirect.indexOf('?token=') >= 0) {
      return res.redirect(redirect);
    }

    // Generate a token (include refresh)
    const token = await generateUserToken(user, true);

    // Append the token to the redirect URL
    const redirectUrlWithToken = `${redirect}?token=${token.token}&refreshToken=${token.refreshToken}`;

    // Redirect to the app with the token
    return res.redirect(redirectUrlWithToken);
  };

  /**
   * Handle local login request with username and password
   */
  app.post(
    '/auth/local',
    processRequest({
      body: PostLocalAuthInputSchema,
      query: z.object({
        // redirect when done?
        redirect: z.string().optional(),
        // is there an invite to accept too?
        inviteId: z.string().optional(),
      }),
    }),
    (req, res, next: NextFunction) => {
      const redirect = validateRedirect(req.query.redirect || '/');
      const inviteId = req.query.inviteId;
      return passport.authenticate(
        // local strategy (user/pass)
        'local',
        // do not use session (JWT only - no persistence)
        {session: false},
        // custom success function which signs JWT and redirects
        async (err: string | Error | null, user: Express.User) => {
          // We have logged in - do we also want to consume an invite?
          if (inviteId) {
            // We have an invite to consume - go ahead and use it
            await validateAndApplyInviteToUser({
              inviteCode: inviteId,
              dbUser: user,
            });
            console.log('Applied invitation successfully');
            // avoid saving unwanted details here
            await saveExpressUser(user);
          }
          if (err) {
            return next(err);
          }
          return redirectWithToken({res, user, redirect});
        }
      )(req, res, next);
    }
  );

  /**
   * Register for a notebook or team using an invite, if no existing account
   * then ask them to register.  User is authenticated in either case.
   * Return a redirect response to the given URL
   */
  app.get(
    '/register/:inviteId/',
    processRequest({
      params: z.object({inviteId: z.string()}),
      query: GetRegisterByInviteQuerySchema,
    }),
    async (req, res) => {
      // Check the redirect is valid
      const redirect = validateRedirect(req.query.redirect || '/');

      // Pull out the invite ID
      const inviteId = req.params.inviteId;

      // Validate the invite is okay
      const invite = await getInvite({inviteId});

      // If invite is not present or invalid
      if (!invite || !isInviteValid({invite}).isValid) {
        return res.render('invite-error', {redirect});
      }

      // need to sign up the user, show the registration page
      const providers = buildRenderProviders({
        handlers,
        inviteId,
        redirectUrl: redirect,
      });
      const encodedRedirect = encodeURIComponent(redirect);

      res.render('register', {
        invite: inviteId,
        // pass through on POST -> note that inviteId and redirect are hidden
        // form elements injected below
        postUrl: `/register/local`,
        loginURL: `${CONDUCTOR_PUBLIC_URL}/auth?redirect=${encodedRedirect}&inviteId=${inviteId}`,
        providers: providers.length > 0 ? providers : undefined,
        redirect: redirect,
        inviteId: inviteId,
        localAuth: true,
        messages: req.flash(),
        layout: 'auth',
      });
    }
  );

  app.post(
    '/register/local',
    processRequest({
      body: PostRegisterLocalInputSchema,
    }),
    body('password')
      .isLength({min: 10})
      .withMessage('Must be at least 10 characters'),
    body('email').isEmail().withMessage('Must be a valid email address'),
    async (req, res) => {
      const inviteId = req.body.inviteId;
      const redirect = validateRedirect(req.body.redirect || '/');

      if (!inviteId) {
        res.status(400);
        req.flash('error', {
          registration: 'No invite provided for registration.',
        });
        res.redirect('/');
        return;
      }

      let username = req.body.username;
      const password = req.body.password;
      const repeat = req.body.repeat;
      const name = req.body.name;
      const email = req.body.email;

      // If the username was not provided, use the email
      if (username === undefined || username === null) {
        username = email;
      }

      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        req.flash('error', errors.mapped());
        req.flash('username', username);
        req.flash('email', email);
        req.flash('name', name);
        res.status(400);
        res.redirect('/register/' + inviteId + `?redirect=${redirect}`);
        return;
      }

      if (password !== repeat) {
        req.flash('error', {repeat: {msg: "Password and repeat don't match."}});
        req.flash('username', username);
        req.flash('email', email);
        req.flash('name', name);
        res.status(400);
        res.redirect('/register/' + inviteId + `?redirect=${redirect}`);
        return;
      }

      const createUser = async () => {
        // this will throw if the user already exists
        const [user, error] = await registerLocalUser(
          username,
          email,
          name,
          password
        );
        if (!user) {
          req.flash('error', {registration: error});
          req.flash('username', username);
          req.flash('email', email);
          req.flash('name', name);
          res.status(400);
          res.redirect('/register/' + inviteId + `?redirect=${redirect}`);
          throw Error(
            'User could not be created due to an issue writing to the database!'
          );
        }
        return user;
      };

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
        req.flash('error', {registration: 'No valid invite for registration.'});
        res.redirect('/');
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
  );

  // set up handlers for OAuth providers
  for (const handler of handlers) {
    const handlerDetails = AUTH_PROVIDER_DETAILS[handler];

    // **Login** method for this handler - this will result in a redirection to
    // the configured providers URL, then called back to the configured callback
    // (see below)
    app.get(
      `/auth/${handler}/`,
      processRequest({
        query: z.object({
          redirect: z.string().optional(),
          inviteId: z.string().optional(),
        }),
      }),
      (req, res, next) => {
        // pull out session data
        const sessionData = req.session as CustomSessionData;

        // check redirect and store in session
        const redirect = validateRedirect(
          // confirm default behaviour here?
          req.query?.redirect || WEBAPP_PUBLIC_URL
        );
        const inviteId = req.query.inviteId;

        // Store into session (we are about to be redirected! Bye bye)
        sessionData.redirect = redirect;
        if (inviteId) sessionData.inviteId = inviteId;

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
      // authenticate using the associated validate function
      passport.authenticate(
        handlerDetails.id,
        // custom success function which signs JWT and redirects
        async (err: string | Error | null, user: Express.User) => {
          // Everything has already been processed - just check for errors etc here
          if (err) {
            return next(err);
          }
          const redirect = validateRedirect(
            (req.session as CustomSessionData)?.redirect || WEBAPP_PUBLIC_URL
          );

          return redirectWithToken({res, user, redirect});
        }
      )(req, res, next);
    });
  }
}
