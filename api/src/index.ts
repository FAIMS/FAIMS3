// SPDX-License-Identifier: Apache-2.0

/*
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
