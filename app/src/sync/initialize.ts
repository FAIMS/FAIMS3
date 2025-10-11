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
 *   TODO
 */
import PouchDB from 'pouchdb-browser';
import {DEBUG_POUCHDB, MIGRATE_OLD_DATABASES} from '../buildconfig';
import {store} from '../context/store';
import {
  compileSpecs,
  initialiseAllProjects,
  initialiseServers,
  markInitialised,
  rebuildDbs,
} from '../context/slices/projectSlice';
import {MapTileDatabase} from '../gui/components/map/tile-source';
import pouchdbDebug from 'pouchdb-debug';
import {logError} from '../logging';
PouchDB.plugin(pouchdbDebug);

/**
 * If we are installed on a device that was previously running
 * v1.0 of the app, the database structure has changed
 * such that no existing data will be recognised.
 *
 * Here we try to make the smallest change possible to
 * allow the data to be seen which is to rename databases
 * to use the new naming convention.   The user will
 * need to re-activate the notebooks but should then see
 * their data.
 */
const migrateOldDatabases = async () => {
  if (indexedDB.databases === undefined) {
    console.warn(
      'IndexedDB databases API not supported, cannot migrate old databases'
    );
    return;
  }
  const getDataDbsPrimitive = async () => {
    const PREFIX = '_pouch_data_';
    const dbList = await indexedDB.databases();
    const dbs = dbList.filter(
      db => db.name && db.name.startsWith(PREFIX) && db.name.includes('||')
    );
    return dbs.map(db => {
      const name = db.name!;
      // get the pouchdb database name from the IDB name
      const dbName = name.replace(PREFIX, '');
      const [projectId, serverId] = dbName.split('||');
      return {
        projectId,
        serverId,
        dbName: 'data_' + dbName, // name of old PouchDB database
      };
    });
  };

  const dbNames = await getDataDbsPrimitive();

  // Migrate each of the old databases and then delete it
  for (const {serverId, projectId, dbName: oldDbName} of dbNames) {
    // If it matches, we need to rename it
    const newDbName = `${serverId}_${projectId}_data`;
    const oldDb = new PouchDB(oldDbName);
    const newDb = new PouchDB(newDbName);
    console.log(`Migrating old database ${oldDbName} to new name ${newDbName}`);
    try {
      await PouchDB.replicate(oldDb, newDb, {
        live: false,
      });
      console.log(
        `Migrated old database ${oldDbName} to new name ${newDbName}`
      );
      console.log('Deleting old database:', oldDbName);
      indexedDB.deleteDatabase('_pouch_' + oldDbName);
    } catch (err) {
      console.error(err);
      logError(`Error migrating old database ${oldDbName}`);
    }
  }
};

/**
 *
 * @returns creates all project PouchDB objects and metadata
 * DBs synced
 */
export async function initialise() {
  if (DEBUG_POUCHDB) PouchDB.debug.enable('*');
  else PouchDB.debug.disable();

  // first migrate old databases if configured to do so
  if (MIGRATE_OLD_DATABASES) await migrateOldDatabases();

  // Get current state/dispatch const state = store.getState();

  // Rebuild all of the databases (synchronously)
  await rebuildDbs(store.getState().projects);

  // Compile all ui specs (synchronously)
  compileSpecs(store.getState().projects);

  // This initialises and potentially updates the servers by fetching their data
  // from corresponding API
  await store.dispatch(initialiseServers());

  // Then we want to initialise all the projects too
  await store.dispatch(initialiseAllProjects());

  // Once this is done - mark initialisation complete
  store.dispatch(markInitialised());

  // TODO bring this back?
  // register_basic_automerge_resolver(events);

  // initialise the tile store used for offline maps
  await MapTileDatabase.getInstance().initDB();
}
