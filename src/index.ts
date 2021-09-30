import express from 'express';
import {self_listing_info, users_db} from './sync/databases';
import passport from 'passport';
import OAuth2Strategy from 'passport-oauth2';
import {initialize} from './sync/initialize';
import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
import {add_initial_listener} from './sync/event-handler-registration';
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

app.get('/auth/:auth_id', (req, res) => {
  passport.authenticate(req.params.auth_id)(req, res);
});

app.get(
  '/auth/example/callback',
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
  for (const auth_id in auth_mechanisms) {
    passport.use(
      'default',
      new OAuth2Strategy(
        auth_mechanisms[auth_id].strategy,
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
  app.listen(8080, () => {
    console.log('The hello is listening on port 8080!');
  });
});
