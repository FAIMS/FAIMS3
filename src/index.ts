import express from 'express';
import {users_db} from './sync/databases';
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

process.on('unhandledRejection', error => {
  console.error(error); // This prints error with stack included (as for normal errors)
  throw error; // Following best practices re-throw error and let the process exit with error code
});

const auth_strategies: {[listing_id: string]: OAuth2Strategy} = {};

passport.use(
  'default',
  new OAuth2Strategy(
    {
      authorizationURL:
        'https://auth.datacentral.org.au/cas/oauth2.0/authorize',
      tokenURL: 'https://auth.datacentral.org.au/cas/oauth2.0/accessToken',
      clientID: '5c1dca8c5c10f7b96f50e5829816a260-datacentral.org.au',
      clientSecret:
        '3478721c4c92e9e6118aaa315712854087ebc4b01abb9e7977bd17dc66d0c67c',
      callbackURL: 'http://localhost:3000/signin-return/',
    },
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

const app = express();
app.get('/', async (req, res) => {
  res.send(await users_db.allDocs({include_docs: true, endkey: '_'}));
});

PouchDB.plugin(PouchDBFind);

add_initial_listener(register_listings_known, 'listings_known');
add_initial_listener(register_projects_known, 'projects_known');
add_initial_listener(register_metas_complete);
add_initial_listener(register_projects_created);

initialize().then(() => {
  app.listen(8080, () => {
    console.log('The hello is listening on port 8080!');
  });
});
