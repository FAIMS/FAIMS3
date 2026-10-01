// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: index.ts
 * Description:
 *   Staged API boot: validate local config, bind /health, migrate, then attach
 *   the full Express API on the same listener so ALB can probe during migrate.
 */

import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
PouchDB.plugin(PouchDBFind);
PouchDB.plugin(require('pouchdb-security-helper'));

import {registerClient} from '@faims3/data-model';
import type {Express} from 'express';
import {assertLocalStartupConfig, config} from './buildconfig';
import {getDataDb} from './couchdb';
import {runStartupMigrations} from './couchdb/startupMigrations';
import {createHealthApp} from './healthApp';

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

function listenHealth(app: Express): Promise<void> {
  return new Promise((resolve, reject) => {
    const server = app.listen(config.conductorInternalPort, '0.0.0.0', () => {
      console.log(
        `Conductor health is listening on port http://0.0.0.0:${config.conductorInternalPort}/health`
      );
      resolve();
    });
    server.once('error', reject);
  });
}

// a) local config  b) /health only  c) migrate  d) attach full API (same server)
const startup = async () => {
  assertLocalStartupConfig();

  const app = createHealthApp();
  await listenHealth(app);

  await runStartupMigrations();

  const {attachFullApi} = await import('./expressSetup.js');
  attachFullApi(app);
  console.log('COUCHDB_INTERNAL_URL', config.couchdbInternalUrl);
  console.log('CONDUCTOR_PUBLIC_URL', config.conductorPublicUrl);
  console.log(
    `Conductor API is attached on port http://0.0.0.0:${config.conductorInternalPort}/`
  );
};

startup().catch(error => {
  console.error('startup failed', error);
  process.exit(1);
});
