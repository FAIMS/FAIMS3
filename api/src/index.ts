// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: index.ts
 * Description:
 *   Staged API boot: validate local config, bind /up, migrate, then attach
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

/** Node 18+ defaults `requestTimeout` to 5 minutes and would abort a 2 GB upload. */
const MAP_ASSET_HTTP_REQUEST_TIMEOUT_MS = 60 * 60 * 1000;

function listenHealth(app: Express): Promise<void> {
  return new Promise((resolve, reject) => {
    const server = app.listen(config.conductorInternalPort, '0.0.0.0', () => {
      console.log(
        `Conductor health is listening on port http://0.0.0.0:${config.conductorInternalPort}/up`
      );
      resolve();
    });
    server.requestTimeout = MAP_ASSET_HTTP_REQUEST_TIMEOUT_MS;
    // headersTimeout must stay above requestTimeout or Node closes the socket.
    server.headersTimeout = MAP_ASSET_HTTP_REQUEST_TIMEOUT_MS + 5 * 1000;
    server.once('error', reject);
  });
}

// a) local config  b) /up only  c) migrate  d) attach full API (same server)
const startup = async () => {
  assertLocalStartupConfig();

  const app = createHealthApp();
  await listenHealth(app);

  await runStartupMigrations();

  const {attachFullApi} = await import('./expressSetup.js');
  attachFullApi(app);
  const {startMapAssetProcessingSweeper} =
    await import('./couchdb/mapAssets/store.js');
  startMapAssetProcessingSweeper();
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
