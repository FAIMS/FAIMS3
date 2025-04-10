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
import {applyPassportAuthProviders} from './auth/strategies/socialProviders';
import {addAuthPages} from './auth/authPages';
import {CONDUCTOR_AUTH_PROVIDERS, COUCHDB_INTERNAL_URL} from './buildconfig';
import {app} from './core';
import {
  databaseValidityReport,
  initialiseDbAndKeys,
  verifyCouchDBConnection,
} from './couchdb';
import {addAuthRoutes} from './auth/authRoutes';

export {app};

// This sets up passport to use the social strategies
applyPassportAuthProviders(CONDUCTOR_AUTH_PROVIDERS);

// This adds the views/pages related to auth (/login, /register)
addAuthPages(app, CONDUCTOR_AUTH_PROVIDERS);

// This adds the endpoints for auth (/auth/local, [/auth/<handler>])
addAuthRoutes(app, CONDUCTOR_AUTH_PROVIDERS);

/**
 * Home Page
 */
app.get('/', async (req, res) => {
  if (databaseValidityReport.valid) {
    res.redirect('/login');
  } else {
    res.render('fallback', {
      report: databaseValidityReport,
      couchdb_url: COUCHDB_INTERNAL_URL,
      layout: 'fallback',
    });
  }
});

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
  res.redirect('/');
});

app.get('/up/', (req, res) => {
  res.status(200).json({up: 'true'});
});
