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
 * Filename: routes.ts
 * Description:
 *   This module exports the configuration of the build, including things like
 *   which server to use and whether to include test data
 */
import {add_auth_providers} from './auth_providers';
import {add_auth_routes} from './auth_routes';
import {generateUserToken} from './authkeys/create';
import {
  ANDROID_APP_URL,
  CONDUCTOR_AUTH_PROVIDERS,
  IOS_APP_URL,
  WEBAPP_PUBLIC_URL,
} from './buildconfig';
import {app} from './core';
import {
  databaseValidityReport,
  initialiseDbAndKeys,
  verifyCouchDBConnection,
} from './couchdb';

export {app};

add_auth_providers(CONDUCTOR_AUTH_PROVIDERS);
add_auth_routes(app, CONDUCTOR_AUTH_PROVIDERS);

/**
 * POST to /fallback-initialise does initialisation on the databases
 * - this does not have any auth requirement because it should be used
 *   to set up the users database and create the admin user
 *   if databases exist, this is a no-op
 *   Extra guard, if the db report says everything is ok we don't
 *   even call initialiseDatabases, just redirect home
 */
app.post('/fallback-initialise', async (req, res) => {
  if (!databaseValidityReport.valid) {
    console.log('running initialise');
    await initialiseDbAndKeys({});
    const vv = await verifyCouchDBConnection();
    console.log('updated valid', databaseValidityReport, vv);
  }
  res.redirect('/auth/');
});

app.get('/send-token/', (req, res) => {
  if (req.user) {
    res.render('send-token', {
      user: req.user,
      web_url: WEBAPP_PUBLIC_URL,
      android_url: ANDROID_APP_URL,
      ios_url: IOS_APP_URL,
      app_id: 'org.fedarch.faims3', // only needed for compatibility with old versions of the app
    });
  } else {
    res.redirect('/auth/');
  }
});

/**
 *
 * For a logged in user (via session), generates a new token and returns the result.
 */
app.get('/get-token/', async (req, res) => {
  if (req.user) {
    try {
      // No need for a refresh here
      const token = await generateUserToken(req.user, false);
      res.send(token);
    } catch {
      res.status(500).send('Signing key not set up');
    }
  } else {
    res.status(403).end();
  }
  return;
});

app.get('/up/', (req, res) => {
  res.status(200).json({up: 'true'});
});
