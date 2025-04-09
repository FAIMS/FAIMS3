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
  PostLocalAuthQuerySchema,
  PostRegisterLocalInputSchema,
} from '@faims3/data-model';
import {NextFunction, Request, Response, Router} from 'express';
import {body, validationResult} from 'express-validator';
import passport from 'passport';
import {z} from 'zod';
import {processRequest} from 'zod-express-middleware';
import {AUTH_PROVIDER_DETAILS} from './auth_providers';
import {
  validateAndApplyInviteToUser,
  registerLocalUser,
} from './auth_providers/helpers';
import {
  generateUserToken,
  upgradeCouchUserToExpressUser,
} from './authkeys/create';
import {AuthProvider, WEBAPP_PUBLIC_URL} from './buildconfig';
import {consumeInvite, getInvite, isInviteValid} from './couchdb/invites';
import {getCouchUserFromEmailOrUsername} from './couchdb/users';
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
function buildRenderProviders(handlers: AuthProvider[]) {
  const providers = [];
  for (const handler of handlers) {
    providers.push({
      // Validate label vs name?
      label: AUTH_PROVIDER_DETAILS[handler].id,
      name: AUTH_PROVIDER_DETAILS[handler].id,
    });
  }
  return providers;
}

passport.serializeUser((user, done) => {
  done(null, user.user_id);
});

passport.deserializeUser((id, done) => {
  getCouchUserFromEmailOrUsername(id as string)
    .then(user_data => {
      if (!user_data) {
        return Promise.reject('User could not be found!');
      } else {
        return upgradeCouchUserToExpressUser({dbUser: user_data});
      }
    })
    .then(user => {
      done(null, user);
    })
    .catch(err => done(err, null));
});

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
    '/auth/',
    processRequest({
      query: z.object({
        redirect: z
          .string()
          .url('Redirect URL must be a valid HTTP/HTTPS address.')
          .optional(),
      }),
    }),
    async (req, res) => {
      const redirect = validateRedirect(
        // TODO desired behaviour in case of no redirect?
        req.query.redirect ?? WEBAPP_PUBLIC_URL
      );

      // TODO remove this
      if (req.user) {
        await redirectWithToken({res, user: req.user, redirect});
      }

      const providers = buildRenderProviders(handlers);
      res.render('auth', {
        providers: providers.length > 0 ? providers : undefined,
        localAuth: true,
        redirect: redirect,
        layout: 'auth',
      });
    }
  );

  /**
   * Generate a function to handle logging in a user and returning
   * a redirect with token
   *
   * @param req Express request
   * @param res Express response
   * @param next Express next function
   * @param redirect URL to redirect to
   * @returns a handler function
   */
  const authenticateFunction = (
    req: Request,
    res: Response,
    next: NextFunction,
    redirect: string
  ) => {
    // returns a function which logs in a user if the req.user is present, then
    // redirects with the token
    return (err: any, user: Express.User) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        return res.redirect('/auth/?redirect=' + redirect);
      }

      req.login(user, async (loginErr: any) => {
        if (loginErr) {
          return next(loginErr);
        }
        const fullUser = await upgradeCouchUserToExpressUser({dbUser: user});
        return redirectWithToken({res, user: fullUser, redirect});
      });
    };
  };

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
      query: PostLocalAuthQuerySchema,
    }),
    (req, res, next: NextFunction) => {
      console.log('Getting /auth/local post!');
      const redirect = validateRedirect(req.query.redirect || '/');
      return passport.authenticate(
        'local',
        authenticateFunction(req, res, next, redirect)
      )(req, res, next);
    }
  );

  /**
   * Register for a notebook or team using an invite, if no existing account
   * then ask them to register.  User is authenticated in either case.
   * Return a redirect response to the given URL
   */
  app.get(
    '/register/:invite_id/',
    processRequest({
      params: z.object({invite_id: z.string()}),
      query: GetRegisterByInviteQuerySchema,
    }),
    async (req, res) => {
      // This is assuming the session plugin is functioning
      const sessionData = req.session as CustomSessionData;

      // Check the redirect is valid
      const redirect = validateRedirect(req.query.redirect || '/');

      // Pull out the invite ID
      const inviteId = req.params.invite_id;

      // Store the invite into the session
      sessionData.invite = inviteId;

      // Validate the invite is okay
      const invite = await getInvite({inviteId});

      // If invite is not present
      if (!invite) {
        return res.render('invite-error', {redirect});
      }

      // If invite is invalid
      const {isValid} = isInviteValid({invite});

      if (!isValid) {
        return res.render('invite-error', {redirect});
      }

      // This is a case where the user is logged in

      // TODO this will be removed
      if (req.user) {
        // Consume the invite
        await consumeInvite({user: req.user, invite});

        // and redirect
        return redirectWithToken({res, user: req.user, redirect});
      }

      // need to sign up the user, show the registration page
      const providers = buildRenderProviders(handlers);
      const encodedRedirect = encodeURIComponent(
        `/register/${inviteId}?redirect=${redirect}`
      );

      res.render('register', {
        invite: inviteId,
        loginURL: `/auth?redirect=${encodedRedirect}`,
        providers: providers.length > 0 ? providers : undefined,
        redirect: redirect,
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
    async (req: any, res: any, next: NextFunction) => {
      // decode session data and ensure invite is present
      const sessionData = req.session as CustomSessionData;
      const inviteId = sessionData.invite;
      if (!inviteId) {
        res.status(400);
        req.flash('error', {
          registration: 'No invite provided for registration.',
        });
        res.redirect('/');
        return;
      }

      // In the form, the username is =
      let username = req.body.username;
      const password = req.body.password;
      const repeat = req.body.repeat;
      const name = req.body.name;
      const email = req.body.email;
      const redirect = validateRedirect(req.body.redirect || '/');

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
        res.redirect(
          '/register/' + sessionData.invite + `?redirect=${redirect}`
        );
        return;
      }

      if (password !== repeat) {
        req.flash('error', {repeat: {msg: "Password and repeat don't match."}});
        req.flash('username', username);
        req.flash('email', email);
        req.flash('name', name);
        res.status(400);
        res.redirect(
          '/register/' + req.session.invite + `?redirect=${redirect}`
        );
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
          res.redirect(
            '/register/' + req.session.invite + `?redirect=${redirect}`
          );
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
      req.login(createdDbUser, async (err: any) => {
        if (err) {
          return next(err);
        }
        // Upgrade by drilling permissions/associations
        const expressUser = await upgradeCouchUserToExpressUser({
          dbUser: createdDbUser,
        });
        return redirectWithToken({res, user: expressUser, redirect});
      });
    }
  );

  // set up handlers for OAuth providers
  for (const handler of handlers) {
    const handlerDetails = AUTH_PROVIDER_DETAILS[handler];

    app.get(
      `/auth/${handler}/`,
      processRequest({
        query: z.object({redirect: z.string().optional()}),
      }),
      (req, res, next) => {
        // pull out session data
        const sessionData = req.session as CustomSessionData;

        // check redirect and store in session
        const redirect = validateRedirect(req.query?.redirect || '/send-token');
        sessionData.redirect = redirect;

        // passport authenticate route for this handler
        passport.authenticate(
          handlerDetails.id,
          authenticateFunction(req, res, next, redirect)
        )(req, res, next);
      }
    );

    // the callback URL for this provider
    app.get(handlerDetails.relativeLoginCallbackUrl, (req, res, next) => {
      // pull out session data
      const sessionData = req.session as CustomSessionData;

      // check redirect
      const redirect = validateRedirect(sessionData.redirect || '/send-token');

      // authenticate using the associated validate function
      passport.authenticate(
        handlerDetails.id,
        authenticateFunction(req, res, next, redirect)
      )(req, res, next);
    });

    app.get(
      `/register/:id/${handlerDetails.id}/`,
      processRequest({
        query: z.object({redirect: z.string().optional()}),
        params: z.object({id: z.string()}),
      }),
      (req, res, next) => {
        // pull out session data
        const sessionData = req.session as CustomSessionData;
        // save the invite and redirect in the session so we can refer to them later
        sessionData['invite'] = req.params.id;
        sessionData['redirect'] = req.query.redirect;
        return passport.authenticate(handlerDetails.id)(req, res, next);
      }
    );
  }
}
