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

import passport from 'passport';

import {CONDUCTOR_AUTH_PROVIDERS, CONDUCTOR_PUBLIC_URL} from './buildconfig';
import {DoneFunction} from './types';
import {getUserFromEmailOrUsername} from './couchdb/users';
import {registerLocalUser} from './auth_providers/local';
import {body, validationResult} from 'express-validator';
import {getInvite} from './couchdb/invites';
import {acceptInvite} from './registration';
import {generateUserToken} from './authkeys/create';
import {NextFunction, Request, Response, Router} from 'express';

interface RequestQueryRedirect {
  redirect: string;
}
interface PostRegisterRequestBody {
  username: string;
  password: string;
  email: string;
  repeat: string;
  name: string;
}

const AVAILABLE_AUTH_PROVIDER_DISPLAY_INFO: {[name: string]: any} = {
  google: {
    name: 'Google',
  },
};

const HANDLER_OPTIONS: {[name: string]: any} = {
  google: {
    prompt: 'select_account',
  },
};

passport.serializeUser((user: Express.User, done: DoneFunction) => {
  done(null, user.user_id);
});

passport.deserializeUser((id: string, done: DoneFunction) => {
  getUserFromEmailOrUsername(id)
    .then(user_data => {
      done(null, user_data);
    })
    .catch(err => done(err, null));
});

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
 * Mainly want to avoid a non-url redirect. Without a whitlist of
 * app URLs we can't really block any but check that it starts with 'http'
 * For mobile we redirect to the custom URL scheme for the app
 * currently hard-coded as `org.fedarch.faims3` but should be configurable
 *
 * @param redirect URL to redirect to
 * @returns a valid URl to redirect to, default to '/' if
 *   the one passed in is bad
 */
function validateRedirect(redirect: string) {
  if (redirect.startsWith('http')) {
    // could match against a whitelist of allowed URLs but for now...
    return redirect;
  } else if (
    redirect.startsWith('/') ||
    redirect.startsWith('org.fedarch.faims3://')
  ) {
    return redirect;
  } else {
    return '/';
  }
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

    if (req.user) {
      await redirect_with_token(res, req.user, redirect);
    }

    const available_provider_info = [];
    for (const handler of handlers) {
      available_provider_info.push({
        label: handler,
        name: AVAILABLE_AUTH_PROVIDER_DISPLAY_INFO[handler].name,
      });
    }
    res.render('auth', {
      providers: available_provider_info,
      localAuth: true, // maybe make this configurable?
      messages: req.flash(),
      redirect: redirect,
    });
  });

  /**
   * Define the logout route. Optionally redirect to a given URL
   * after logout to account for logout from the app
   */
  app.get<{}, {}, {}, RequestQueryRedirect>(
    '/logout/',
    (req, res, next: any) => {
      const redirect = validateRedirect(req.query?.redirect || '/');

      if (req.user) {
        req.logout((err: any) => {
          if (err) {
            return next(err);
          }
        });
      }
      res.redirect(redirect);
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
        req.flash('message', 'Invalid username or password');
        return res.redirect('/auth/?redirect=' + redirect);
      }

      req.login(user, async (loginErr: any) => {
        if (loginErr) {
          return next(loginErr);
        }
        return redirect_with_token(res, user, redirect);
      });
    };
  };

  /**
   * Generate a redirect response with a token for a logged in user
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
    // Generate a token
    const token = await generateUserToken(user);
    // Append the token to the redirect URL
    const redirectUrlWithToken = `${redirect}?token=${token.token}`;

    // Redirect to the app with the token
    return res.redirect(redirectUrlWithToken);
  };

  /**
   * Handle local login request with username and password
   */
  app.post<{}, {}, {}, RequestQueryRedirect>(
    '/auth/local',
    (req, res, next: NextFunction) => {
      const redirect = validateRedirect(req.query?.redirect || '/');
      passport.authenticate(
        'local',
        authenticate_return(req, res, next, redirect)
      )(req, res, next);
    }
  );

  /**
   * Register for a notebook using an invite, if no existing account
   * then ask them to register.  User is authenticated in either case.
   * Return a redirect response to the given URL
   */
  app.get<{invite_id: string}, {}, {}, RequestQueryRedirect>(
    '/register/:invite_id/',
    async (req, res) => {
      const redirect = validateRedirect(req.query?.redirect || '/');
      const invite_id = req.params.invite_id;
      req.session['invite'] = invite_id;
      const invite = await getInvite(invite_id);
      if (!invite) {
        res.render('invite-error', {redirect});
      } else if (req.user) {
        // user already registered, sign them up for this notebook
        // should there be conditions on this? Eg. check the email.
        await acceptInvite(req.user, invite);
        req.flash(
          'message',
          'You will now have access to the ${invite.notebook} notebook.'
        );
        redirect_with_token(res, req.user, redirect);
      } else {
        // need to sign up the user, show the registration page
        const available_provider_info = [];
        for (const handler of CONDUCTOR_AUTH_PROVIDERS) {
          available_provider_info.push({
            label: handler,
            name: AVAILABLE_AUTH_PROVIDER_DISPLAY_INFO[handler].name,
          });
        }
        res.render('register', {
          invite: invite_id,
          providers: available_provider_info,
          redirect: redirect,
          localAuth: true, // maybe make this configurable?
          messages: req.flash(),
        });
      }
    }
  );

  app.post<{}, {}, PostRegisterRequestBody, RequestQueryRedirect>(
    '/register/local',
    body('username').trim(),
    body('password')
      .isLength({min: 10})
      .withMessage('Must be at least 10 characters'),
    body('email').isEmail().withMessage('Must be a valid email address'),
    async (req: any, res: any, next: any) => {
      // create a new local account if we have a valid invite
      const username = req.body.username;
      const password = req.body.password;
      const repeat = req.body.repeat;
      const name = req.body.name;
      const email = req.body.email;
      const redirect = validateRedirect(req.body.redirect || '/');

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

      const invite = await getInvite(req.session.invite);

      if (!invite) {
        res.status(400);
        req.flash('error', {registration: 'No valid invite for registration.'});
        res.redirect('/');
      } else if (password === repeat) {
        const [user, error] = await registerLocalUser(
          username,
          email,
          name,
          password
        );
        if (user) {
          await acceptInvite(user, invite);
          req.flash('message', 'Registration successful. Please login below.');
          req.login(user, (err: any) => {
            if (err) {
              return next(err);
            }
            return redirect_with_token(res, user, redirect);
          });
        } else {
          req.flash('error', {registration: error});
          req.flash('username', username);
          req.flash('email', email);
          req.flash('name', name);
          res.status(400);
          res.redirect(
            '/register/' + req.session.invite + `?redirect=${redirect}`
          );
        }
      } else {
        req.flash('error', {repeat: {msg: "Password and repeat don't match."}});
        req.flash('username', username);
        req.flash('email', email);
        req.flash('name', name);
        res.status(400);
        res.redirect(
          '/register/' + req.session.invite + `?redirect=${redirect}`
        );
      }
    }
  );

  // set up handlers for OAuth providers
  for (const handler of handlers) {
    app.get(`/auth/${handler}/`, (req: any, res: any, next: any) => {
      const redirect = validateRedirect(req.query?.redirect || '/');
      if (
        typeof req.query?.state === 'string' ||
        typeof req.query?.state === 'undefined'
      ) {
        passport.authenticate(
          handler + '-validate',
          authenticate_return(req, res, next, redirect)
          //          HANDLER_OPTIONS[handler]
        )(req, res, next);
        console.log('TODO: may need to insert:', HANDLER_OPTIONS[handler]);
      } else {
        throw Error(
          `state must be a string, or not set, not ${typeof req.query?.state}`
        );
      }
    });

    app.get(
      // This should line up with determine_callback_url above
      `/auth-return/${handler}/`,
      passport.authenticate(handler + '-validate', {
        successRedirect: '/send-token/',
        failureRedirect: '/auth',
        failureFlash: true,
        successFlash: 'Welcome!',
      })
    );

    console.log('adding route', `/register/${handler}/`);
    app.get(`/register/:id/${handler}/`, (req: any, res: any, next: any) => {
      req.session['invite'] = req.params.id;
      return passport.authenticate(handler + '-register', () => next())(
        req,
        res,
        next
      );
    });

    app.get(
      // This should line up with determine_callback_url above
      `/register-return/${handler}/`,
      passport.authenticate(handler + '-register', {
        successRedirect: '/',
        failureRedirect: '/auth',
      })
    );
  }
}
