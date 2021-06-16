import EventEmitter from 'events';
import {setupExampleActive} from '../dummyData';
import {
  process_listings,
  process_projects,
  process_directory,
} from './process-initialization';
import {active_db, directory_connection_info} from './databases';
import {DirectoryEmitter} from './events';
import {attach_all_listeners} from './event-handler-registration';

export const initializeEvents: DirectoryEmitter = new EventEmitter();

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

  const initialized = new Promise(resolve => {
    initializeEvents.once('projects_created', resolve);
  });
  console.log('sync/initialize: starting');
  initialize_dbs();
  await initialized;
  console.log('sync/initialize: finished');
}

function initialize_dbs(): DirectoryEmitter {
  // Main sync propagation downwards to individual projects:
  initializeEvents
    .on('directory_local', listings => process_listings(listings, true))
    .on('directory_paused', listings => process_listings(listings, false))
    .on('listing_local', (...args) => process_projects(...args, true))
    .on('listing_paused', (...args) => process_projects(...args, false));

  attach_all_listeners(initializeEvents);

  // It all starts here, once the events are all registered
  console.log('sync/initialize: listeners registered');
  process_directory(directory_connection_info).catch(err =>
    initializeEvents.emit('directory_error', err)
  );
  return initializeEvents;
}
