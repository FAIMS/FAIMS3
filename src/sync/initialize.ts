/*
 * Copyright 2021,2022 Macquarie University
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
import PouchDB from 'pouchdb';

import {setupExampleActive} from '../dummyData';
import {USE_REAL_DATA, DEBUG_POUCHDB} from '../buildconfig';
import {
  process_listings,
  process_projects,
  process_directory,
} from './process-initialization';
import {active_db, directory_connection_info} from './databases';
import {DirectoryEmitter, events} from './events';
import {attach_all_listeners} from './event-handler-registration';

/**
 * To prevent initialize() being called multiple times
 * This is false when the app starts,
 * True when initialize() has finished, and
 * the initialize promise when it's still in the process of initializing
 */
let initialize_state: boolean | Promise<void> = false;

/**
 *
 * @returns Promise that resolve when all project PouchDB objects have been created and metadata DBs synced
 */
export function initialize() {
  if (initialize_state === true) {
    return Promise.resolve(); //Already initialized
  } else if (initialize_state === false) {
    // Real initialization
    return (initialize_state = initialize_nocheck());
  } else {
    // Already initializing
    return initialize_state;
  }
}

async function initialize_nocheck() {
  if (!USE_REAL_DATA) await setupExampleActive(active_db);
  if (DEBUG_POUCHDB) PouchDB.debug.enable('*');

  const initialized = new Promise(resolve => {
    events.once('projects_created', resolve);
  });
  console.log('sync/initialize: starting');
  initialize_dbs();
  await initialized;
  console.log('sync/initialize: finished');
}

function initialize_dbs(): DirectoryEmitter {
  // Main sync propagation downwards to individual projects:
  events
    .on('directory_local', listings => process_listings(listings, true))
    .on('directory_paused', listings => process_listings(listings, false))
    .on('listing_local', (...args) => process_projects(...args, false))
    .on(
      'listing_paused',
      (listing, projects, projects_db, default_connection) =>
        process_projects(
          listing,
          projects,
          projects_db,
          default_connection,
          true
        )
    );

  attach_all_listeners(events);

  // It all starts here, once the events are all registered
  console.log('sync/initialize: listeners registered');
  process_directory(directory_connection_info).catch(err =>
    events.emit('directory_error', err)
  );
  console.log('sync/initialize: processed directory');
  return events;
}
