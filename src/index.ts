import express from 'express';
import {users_db} from './sync/databases';
import passport from 'passport';
import OAuth2Strategy from 'passport-oauth2';

process.on('unhandledRejection', error => {
  console.error(error); // This prints error with stack included (as for normal errors)
  throw error; // Following best practices re-throw error and let the process exit with error code
});

passport.use(
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
  res.send(await users_db.allDocs({include_docs: true}));
});
app.listen(8080, () => {
  console.log('The hello is listening on port 8080!');
});
