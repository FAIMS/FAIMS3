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
 * Filename: index.ts
 * Description:
 *   This module exports the configuration of the build, including things like
 *   which server to use and whether to include test data
 */

import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
PouchDB.plugin(PouchDBFind);
PouchDB.plugin(require('pouchdb-security-helper'));

import {registerClient} from '@faims3/data-model';
import {config} from './buildconfig';
import {getDataDb} from './couchdb';
import {validateDatabases} from './couchdb/notebooks';
import {app} from './expressSetup';

// set up the database module @faims3/data-model with our callbacks to get databases
registerClient({
  getDataDB: getDataDb,
  shouldDisplayRecord: async () => true,
});

process.on('unhandledRejection', error => {
  console.error('unhandledRejection');
  console.error(error); // This prints error with stack included (as for normal errors)
  // don't re-throw the error since we don't want to crash the server
});

// on startup, run a validation of the databases that can perform
// any required migrations

const startup = async () => {
  await validateDatabases().then(() => {
    app.listen(config.conductorInternalPort, '0.0.0.0', () => {
      console.log('COUCHDB_INTERNAL_URL', config.couchdbInternalUrl);
      console.log('CONDUCTOR_PUBLIC_URL', config.conductorPublicUrl);
      console.log(
        `Conductor is listening on port http://0.0.0.0:${config.conductorInternalPort}/`
      );
    });
  });
};

startup();
