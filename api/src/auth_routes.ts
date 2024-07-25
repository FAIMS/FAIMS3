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

export function add_auth_routes(app: any, handlers: any) {
  app.get('/auth/', (req: any, res: any) => {
    // Allow the user to decide what auth mechanism to use
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
    });
  });

  // handle local login post request
  app.post(
    '/auth/local',
    passport.authenticate('local', {
      successRedirect: '/send-token',
      failureRedirect: '/auth',
    })
  );

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
    app.get(`/auth/${handler}/`, (req: any, res: any) => {
      if (
        typeof req.query?.state === 'string' ||
        typeof req.query?.state === 'undefined'
      ) {
        passport.authenticate(handler + '-validate', HANDLER_OPTIONS[handler])(
          req,
          res,
          (err?: {}) => {
            // Hack to avoid users getting caught when they're not in the right
            // groups.
            console.error('Authentication Error', err);
            // res.redirect('https://auth.datacentral.org.au/cas/logout');
            //throw err ?? Error('Authentication failed (next, no error)');
          }
        );
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
