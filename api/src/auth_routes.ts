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
  PostLocalAuthInputSchema,
  PostLocalAuthQuerySchema,
  PostRegisterLocalInputSchema,
} from '@faims3/data-model';
import {NextFunction, Request, Response, Router} from 'express';
import {body, validationResult} from 'express-validator';
import passport from 'passport';
import {z} from 'zod';
import {processRequest} from 'zod-express-middleware';
import {registerLocalUser} from './auth_providers/local';
import {
  generateUserToken,
  upgradeCouchUserToExpressUser,
} from './authkeys/create';
import {CONDUCTOR_AUTH_PROVIDERS, CONDUCTOR_PUBLIC_URL} from './buildconfig';
import {getInvite, useInvite} from './couchdb/invites';

interface RequestQueryRedirect {
  redirect: string;
}
const AVAILABLE_AUTH_PROVIDER_DISPLAY_INFO: {[name: string]: any} = {
  google: {
    name: 'Google',
  },
};

export function determine_callback_urls(provider_name: string): {
  login_callback: string;
  register_callback: string;
} {
  return {
    login_callback: `${CONDUCTOR_PUBLIC_URL}/auth-return/${provider_name}`,
    register_callback: `${CONDUCTOR_PUBLIC_URL}/register-return/${provider_name}`,
  };
}

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
 * Add authentication routes for local and federated login
 * The list of handlers are the ids of the configured federated handlers (eg. ['google'])
 * routes will be set up for each of these for auth and registration
 * See `auth_providers/index.ts` for registration of providers.
 *
 * @param app Express router
 * @param handlers an array of login provider identifiers
 */
export function add_auth_routes(app: Router, handlers: string[]) {
  // In the following generic type signatures for routes the
  // order of types is:
  //  <Params, ResBody, ReqBody, ReqQuery, Locals>
  // Params: Route parameters
  // ResBody: Response body
  // ReqBody: Request body
  // ReqQuery: Query string parameters
  // Locals: Response local variables

  app.get<{}, {}, {}, RequestQueryRedirect>('/auth/', async (req, res) => {
    const redirect = validateRedirect(req.query?.redirect || '/');
    const available_provider_info = [];
    for (const handler of handlers) {
      available_provider_info.push({
        label: handler,
        name: AVAILABLE_AUTH_PROVIDER_DISPLAY_INFO[handler].name,
      });
    }
    res.render('auth', {
      providers:
        available_provider_info.length > 0
          ? available_provider_info
          : undefined,
      localAuth: true,
      redirect: redirect,
      layout: 'auth',
    });
  });

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
  const authenticate_return = (
    req: Request<any, any, any, any, Record<string, any>>,
    res: Response,
    next: NextFunction,
    redirect: string
  ) => {
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
        return redirect_with_token(res, fullUser, redirect);
      });
    };
  };

  /**
   * Generate a redirect response with a token and refresh token for a logged in
   * user
   *
   * TODO restrict the generation of refresh tokens to initial login
   * @param res Express response
   * @param user Express user
   * @param redirect URL to redirect to
   * @returns a redirect response with a suitable token
   */
  const redirect_with_token = async (
    res: Response,
    user: Express.User,
    redirect: string
  ) => {
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
      const redirect = validateRedirect(req.query.redirect || '/');
      passport.authenticate(
        'local',
        authenticate_return(req, res, next, redirect)
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
      const redirect = validateRedirect(req.query.redirect || '/');
      const invite_id = req.params.invite_id;
      (req.session as any)['invite'] = invite_id;
      console.log('Getting invite id ' + invite_id);
      const invite = await getInvite({inviteId: invite_id});
      if (!invite) {
        console.log("Couldn't find!" + invite_id);
        res.render('invite-error', {redirect});
      } else if (req.user) {
        console.log('Already user for found invite: ' + invite_id);
        // user already registered, sign them up for this notebook
        // should there be conditions on this? Eg. check the email.
        await useInvite({user: req.user, invite});
        redirect_with_token(res, req.user, redirect);
      } else {
        console.log('New user for found invite ' + invite_id);
        // need to sign up the user, show the registration page
        const available_provider_info = [];
        for (const handler of CONDUCTOR_AUTH_PROVIDERS) {
          available_provider_info.push({
            label: handler,
            name: AVAILABLE_AUTH_PROVIDER_DISPLAY_INFO[handler].name,
          });
        }
        const encodedRedirect = encodeURIComponent(
          `/register/${invite_id}?redirect=${redirect}`
        );
        res.render('register', {
          invite: invite_id,
          loginURL: `/auth?redirect=${encodedRedirect}`,
          providers:
            available_provider_info.length > 0
              ? available_provider_info
              : undefined,
          redirect: redirect,
          localAuth: true, // maybe make this configurable?
          messages: req.flash(),
          layout: 'auth',
        });
      }
    }
  );

  app.post(
    '/register/local',
    processRequest({
      body: PostRegisterLocalInputSchema,
    }),
    // TODO move this validation to Zod - right now this is depended on by
    // handlebars since the errors are 'flashed' in the function below
    body('password')
      .isLength({min: 10})
      .withMessage('Must be at least 10 characters'),
    body('email').isEmail().withMessage('Must be a valid email address'),
    async (req: any, res: any, next: NextFunction) => {
      // create a new local account if we have a valid invite

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
          '/register/' + req.session.invite + `?redirect=${redirect}`
        );
        return;
      }

      // Check the invite TODO Validate usages/expiry etc
      const invite = await getInvite({inviteId: req.session.invite});

      if (!invite) {
        res.status(400);
        req.flash('error', {registration: 'No valid invite for registration.'});
        res.redirect('/');
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
        return;
      }

      // This also saves the user!
      await useInvite({user, invite});

      req.flash('message', 'Registration successful. Please login below.');
      req.login(user, async (err: any) => {
        if (err) {
          return next(err);
        }
        // Upgrade by drilling permissions/associations
        const expressUser = await upgradeCouchUserToExpressUser({dbUser: user});
        return redirect_with_token(res, expressUser, redirect);
      });
    }
  );

  // set up handlers for OAuth providers
  for (const handler of handlers) {
    app.get(`/auth/${handler}/`, (req: any, res: any, next: any) => {
      const redirect = validateRedirect(req.query?.redirect || '/send-token');
      req.session['redirect'] = req.query.redirect;
      if (
        typeof req.query?.state === 'string' ||
        typeof req.query?.state === 'undefined'
      ) {
        passport.authenticate(
          handler + '-validate',
          authenticate_return(req, res, next, redirect)
        )(req, res, next);
      } else {
        throw Error(
          `state must be a string, or not set, not ${typeof req.query?.state}`
        );
      }
    });

    app.get(
      // This should line up with determine_callback_url above
      `/auth-return/${handler}/`,
      (req: any, res: any, next: any) => {
        const redirect = req.session['redirect'] || '/send-token';
        passport.authenticate(
          handler + '-validate',
          authenticate_return(req, res, next, redirect)
        )(req, res, next);
      }
    );

    console.log('adding route', `/register/${handler}/`);
    app.get(`/register/:id/${handler}/`, (req: any, res: any, next: any) => {
      // save the invite and redirect in the session so we can refer to them later
      req.session['invite'] = req.params.id;
      req.session['redirect'] = req.query.redirect;
      return passport.authenticate(handler + '-register', () => next())(
        req,
        res,
        next
      );
    });

    app.get(
      // This should line up with determine_callback_url above
      `/register-return/${handler}/`,
      (req: any, res: any, next: any) => {
        const redirect = req.session['redirect'] || '/send-token';
        // need to add token to redirect
        passport.authenticate(
          handler + '-register',
          authenticate_return(req, res, next, redirect)
        )(req, res, next);
      }
    );
  }
}
