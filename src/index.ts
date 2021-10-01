import express from 'express';
import {self_listing_info, users_db} from './sync/databases';
import passport from 'passport';
import OAuth2Strategy from 'passport-oauth2';
import {initialize} from './sync/initialize';
import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
import {add_initial_listener} from './sync/event-handler-registration';
import json_stringify from 'fast-json-stable-stringify';
import {
  register_listings_known,
  register_projects_known,
  register_metas_complete,
  register_projects_created,
} from './sync/state';
import {auth_mechanisms} from './authconfig';

process.on('unhandledRejection', error => {
  console.error(error); // This prints error with stack included (as for normal errors)
  throw error; // Following best practices re-throw error and let the process exit with error code
});

const app = express();

const created_auth_mechanisms = new Set<string>();
function create_oauth_mechanism(auth_id: string, state: string | null): string {
  const key = json_stringify(state === null ? auth_id : [auth_id, state]);

  if (!created_auth_mechanisms.has(key)) {
    passport.use(
      key,
      new OAuth2Strategy(
        {...auth_mechanisms[auth_id].strategy, state: state},
        (
          accessToken: string,
          refreshToken: string,
          profile: any,
          cb: (err?: Error | null, user?: Express.User, info?: unknown) => void
        ) => {
          console.debug(
            accessToken,
            refreshToken,
            profile,
            JSON.stringify(profile)
          );
          cb(null, undefined, undefined);
        }
      )
    );
  }
  return key;
}

app.get('/auth/:auth_id', (req, res) => {
  if (
    typeof req.query?.state === 'string' ||
    typeof req.query?.state === 'undefined'
  ) {
    const state_param: string | null = req.query?.state ?? null;

    passport.authenticate(
      create_oauth_mechanism(req.params.auth_id, state_param)
    )(req, res, (err?: {}) => {
      throw err ?? Error('Authentication failed (next, no error)');
    });
  } else {
    throw Error(
      `state must be a string, or not set, not ${typeof req.query?.state}`
    );
  }
});

app.get(
  '/auth-return',
  passport.authenticate('oauth2', {failureRedirect: '/login'}),
  (req, res) => {
    // Successful authentication, redirect home.
    res.redirect('/');
  }
);

app.get('/', async (req, res) => {
  res.send(await users_db.allDocs({include_docs: true, endkey: '_'}));
});

PouchDB.plugin(PouchDBFind);

add_initial_listener(register_listings_known, 'listings_known');
add_initial_listener(register_projects_known, 'projects_known');
add_initial_listener(register_metas_complete);
add_initial_listener(register_projects_created);

initialize().then(async () => {
  app.listen(8080, () => {
    console.log('The hello is listening on port 8080!');
  });
});
