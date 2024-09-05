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
 *
 * @param redirect URL to redirect to
 * @returns a valid URl to redirect to, default to '/' if
 *   the one passed in is bad
 */
function validateRedirect(redirect: string) {
  if (redirect.startsWith('http')) {
    // should match against a whitelist of allowed URLs
    return redirect;
  } else if (redirect.startsWith('/')) {
    return redirect;
  } else {
    return '/';
  }
}

export function add_auth_routes(app: any, handlers: any) {
  app.get('/auth/', (req: any, res: any) => {
    const redirect = validateRedirect(req.query?.redirect || '/');
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

  // app.post('/auth/local', (req: any, res: any, next: any) => {
  //   const redirect = validateRedirect(req.query?.redirect || '/');
  //   passport.authenticate('local', {
  //     successRedirect: redirect,
  //     failureRedirect: `/login?redirect=${redirect}`,
  //   })(req, res, next);
  // });

  const authenticate_return = (
    req: any,
    res: any,
    next: any,
    redirect: string
  ) => {
    return (err: any, user: any, info: any) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        return res.status(401).json({message: 'Authentication failed'});
      }

      req.login(user, async (loginErr: any) => {
        if (loginErr) {
          return next(loginErr);
        }
        // Generate a token
        const token = await generateUserToken(user);
        // Append the token to the redirect URL
        const redirectUrlWithToken = `${redirect}?token=${token.token}`;

        // Redirect to the app with the token
        return res.redirect(redirectUrlWithToken);
      });
    };
  };

  app.post('/auth/local', (req: any, res: any, next: any) => {
    const redirect = validateRedirect(req.query?.redirect || '/');
    passport.authenticate(
      'local',
      authenticate_return(req, res, next, redirect)
    )(req, res, next);
  });

  // accept an invite, auth not required, we invite them to
  // register if they aren't already
  app.get('/register/:invite_id/', async (req: any, res: any) => {
    const invite_id = req.params.invite_id;
    req.session['invite'] = invite_id;
    const invite = await getInvite(invite_id);
    if (!invite) {
      res.sendStatus(404);
      return;
    }
    if (req.user) {
      // user already registered, sign them up for this notebook
      // should there be conditions on this? Eg. check the email.
      await acceptInvite(req.user, invite);
      req.flash(
        'message',
        'You will now have access to the ${invite.notebook} notebook.'
      );
      res.redirect('/');
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
        localAuth: true, // maybe make this configurable?
        messages: req.flash(),
      });
    }
  });

  app.post(
    '/register/local',
    body('username').trim(),
    body('password')
      .isLength({min: 10})
      .withMessage('Must be at least 10 characters'),
    body('email').isEmail().withMessage('Must be a valid email address'),
    async (req: any, res: any) => {
      // create a new local account if we have a valid invite
      const username = req.body.username;
      const password = req.body.password;
      const repeat = req.body.repeat;
      const name = req.body.name;
      const email = req.body.email;

      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        req.flash('error', errors.mapped());
        req.flash('username', username);
        req.flash('email', email);
        req.flash('name', name);
        res.status(400);
        res.redirect('/register/' + req.session.invite);
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
          res.redirect('/');
        } else {
          req.flash('error', {registration: error});
          req.flash('username', username);
          req.flash('email', email);
          req.flash('name', name);
          res.status(400);
          res.redirect('/register/' + req.session.invite);
        }
      } else {
        req.flash('error', {repeat: {msg: "Password and repeat don't match."}});
        req.flash('username', username);
        req.flash('email', email);
        req.flash('name', name);
        res.status(400);
        res.redirect('/register/' + req.session.invite);
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
