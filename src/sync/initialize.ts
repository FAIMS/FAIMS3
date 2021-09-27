/*
 * Copyright 2021 Macquarie University
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
import {setupExampleActive} from '../dummyData';
import {update_directory} from './process-initialization';
import {active_db, directory_connection_info} from './databases';
import {DirectoryEmitter, events} from './events';
import {attach_all_listeners} from './event-handler-registration';
import {all_projects_updated} from './state';

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
  await setupExampleActive(active_db);

  const initialized = new Promise<void>(resolve => {
    // Resolve once only
    let resolved = false;
    events.on('all_state', () => {
      if (all_projects_updated && !resolved) {
        resolved = true;
        resolve();
      }
    });
  });
  console.log('sync/initialize: starting');
  initialize_dbs();
  await initialized;
  console.log('sync/initialize: finished');
}

function initialize_dbs(): DirectoryEmitter {
  attach_all_listeners(events);

  // It all starts here, once the events are all registered
  console.log('sync/initialize: listeners registered');
  update_directory(directory_connection_info).catch(err =>
    events.emit('directory_error', err)
  );
  return events;
}
