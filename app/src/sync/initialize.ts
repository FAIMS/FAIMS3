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
import {DEBUG_POUCHDB} from '../buildconfig';
import {store} from '../context/store';
import {
  compileSpecs,
  initialiseAllProjects,
  initialiseServers,
  markInitialised,
  rebuildDbs,
} from '../context/slices/projectSlice';

/**
 *
 * @returns creates all project PouchDB objects and metadata
 * DBs synced
 */
export async function initialize() {
  if (DEBUG_POUCHDB) PouchDB.debug.enable('*');
  // Get current state/dispatch const state = store.getState();

  // TODO confirm we can rely on ordering here

  // This initialises the servers by fetching their data from corresponding API
  await store.dispatch(initialiseServers());

  // Then we want to initialise all the projects too
  await store.dispatch(initialiseAllProjects());

  // Now let's create all the DBs we need (these are persisted only as keys + config)
  store.dispatch(rebuildDbs());

  // Compile all ui specs
  store.dispatch(compileSpecs());

  // Once this is done - mark initialisation complete
  store.dispatch(markInitialised());

  // TODO bring this back?
  // register_basic_automerge_resolver(events);
}
