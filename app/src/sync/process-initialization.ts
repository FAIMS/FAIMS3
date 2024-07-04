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
import {AUTOACTIVATE_LISTINGS, DEBUG_APP} from '../buildconfig';
import {
  ProjectID,
  ListingID,
  split_full_project_id,
  NonUniqueProjectID,
  resolve_project_id,
} from 'faims3-datamodel';
import {PossibleConnectionInfo, ProjectObject} from 'faims3-datamodel';
import {logError} from '../logging';
import {getTokenForCluster} from '../users';

import {
  ConnectionInfo_create_pouch,
  materializeConnectionInfo,
  throttled_ping_sync_up,
  throttled_ping_sync_down,
  ping_sync_error,
  ping_sync_denied,
  ConnectionInfo,
} from './connection';
import {
  ListingsObject,
  active_db,
  data_dbs,
  default_changes_opts,
  DEFAULT_LISTING_ID,
  directory_db,
  ensure_local_db,
  ensure_synced_db,
  ExistingActiveDoc,
  get_default_instance,
  metadata_dbs,
  projects_dbs,
  setLocalConnection,
} from './databases';
import {events} from './events';
import {createdListings, createdProjects} from './state';

const METADATA_DBNAME_PREFIX = 'metadata-';
const DATA_DBNAME_PREFIX = 'data-';

export async function update_directory(
  directory_connection_info: ConnectionInfo
) {
  events.emit('listings_sync_state', true);

  // Only sync active listings: To do so, get all active docs,
  // then use that to select active listings from directory
  // Since multiple docs in active may be for a single listing,
  // This tracks the number of active projects that use said listings.
  const to_sync = {} as {[key: string]: number};

  // We do a new .changes() to ensure we don't miss any changes
  // and since even if active_db.changes is set to use since: 0:
  // if PouchDB were then to run between the active_db.changes is created
  // and this function running, the changes are missed.
  // So that's why active_db.changes is set to 'now' and everything needing
  // all docs + listening for docs usees its own changes object
  active_db
    .changes({...default_changes_opts, since: 0})
    .on('change', info => {
      if (DEBUG_APP) {
        console.debug('ActiveDB Info', info);
      }
      if (info.doc === undefined) {
        logError('Active doc changes has doc undefined');
        return undefined;
      }
      const listing_id = split_full_project_id(info.doc._id).listing_id;

      if (info.deleted) {
        to_sync[listing_id] -= 1;
        if (to_sync[listing_id] === 0) {
          // Some listing no longer used by anything: delete
          delete to_sync[listing_id];
          delete_listing_by_id(listing_id);
        }
      } else {
        // Some listing activated
        if (listing_id in to_sync) {
          to_sync[listing_id]++;
        } else {
          to_sync[listing_id] = 1;
          // Need to fetch it first though.
          directory_db.local
            .get(listing_id)
            // If get succeeds, undelete/create:
            .then(
              existing_listing => process_listing(false, existing_listing),
              // Even for 404 errors, since the listing is active, it should exist
              // so it's an error if it doesn't exist.
              err => events.emit('listing_error', listing_id, err)
            );
        }
      }
      return undefined;
    })
    .on('error', err => {
      logError(err);
    });

  // We just use the 1 events object
  directory_db.changes.cancel();

  // All directory docs is listened to
  // This is assumed to dispatch all events before directory_pause is triggered
  // For example data, this works because it's at the top of this function
  directory_db.changes = directory_db.local
    .changes({...default_changes_opts, since: 0})
    .on('change', info => {
      if (DEBUG_APP) {
        console.debug('DirectoryDB Info', info);
      }
      if (info.id in to_sync || AUTOACTIVATE_LISTINGS) {
        // Only active listings
        // This can delete for deletion changes
        process_listing(info.deleted || false, info.doc!);
        // } else {
        // No need to delete anything 'else' here because
        // it should either never have been added (from above)
        // or if was a change after starting FAIMS, it would have been
        // deleted from the active_db listener.
      }
    })
    .on('error', err => {
      events.emit('directory_error', err);
    });

  const directory_pause = (message?: string) => () => {
    // This code runs at a point where the directory is pretty stable
    // it should have had all changes already done, any more are from remote.
    // So that's why we put the debugging here:
    if (DEBUG_APP) {
      console.debug(
        'Active listing IDs are:',
        to_sync,
        'with message',
        message
      );
    }
    events.emit('listings_sync_state', false);
  };

  const directory_active = () => {
    if (DEBUG_APP) {
      console.debug('Directory sync started up again');
    }
    throttled_ping_sync_down();
  };
  const directory_denied = (err: any) => {
    if (DEBUG_APP) {
      console.debug('Directory sync denied', err);
    }
    ping_sync_denied();
  };
  const directory_error = (err: any) => {
    if (DEBUG_APP) {
      if (err.status === 401) {
        console.debug('Directory sync waiting on auth');
      } else {
        console.debug('Directory sync error', err);
      }
    }
    ping_sync_error();
  };
  //const directory_complete = (info: any) => {
  //  console.debug('Directory sync complete', info);
  //};
  //const directory_change = (info: any) => {
  //  console.debug('Directory sync change', info);
  //  throttled_ping_sync_down();
  //};

  const directory_paused = ConnectionInfo_create_pouch<ListingsObject>(
    directory_connection_info
  );

  directory_db.remote = {
    db: directory_paused,
    connection: null,
    info: directory_connection_info,
    options: {},
  };

  console.debug('Setting up directory local connection');
  setLocalConnection({...directory_db, remote: directory_db.remote!});

  directory_db.remote!.connection!.once('paused', directory_pause('Sync'));
  directory_db
    .remote!.connection!.on('active', directory_active)
    .on('denied', directory_denied)
    .on('error', directory_error);
  //.on('complete', directory_complete)
  //.on('change', directory_change);
}

/**
 * Reprocess a listing, usually causing the connections to be recreated.
 *
 * This purpose of this is to be a hook when a user on the devices changes
 * something that would require the reprocessing of the listing (rather than a
 * change in couchdb).
 *
 * @param listing_id string: the id of the listing to reprocess
 */
export function reprocess_listing(listing_id: string) {
  console.log('Reprocessing', listing_id);
  directory_db.local
    .get(listing_id)
    // If get succeeds, undelete/create:
    .then(
      existing_listing => process_listing(false, existing_listing),
      // Even for 404 errors, since the listing is active, it should exist
      // so it's an error if it doesn't exist.
      err => events.emit('listing_error', listing_id, err)
    );
  // FIXME: This is a workaround until we add notebook-level activation
  window.location.reload();
}

/**
 * Deletes or updates a listing: If the listing is newly synced (needs a local
 * PouchDB to be created) or has been removed
 *
 * Guaranteed to emit the listing_updated event before first suspend point
 *
 * @param delete Boolean: true to delete, false if to not be deleted
 * @param listing_id_or_listing Listing to delete/undelete
 */
export function process_listing(
  delete_listing: boolean,
  listing: PouchDB.Core.ExistingDocument<ListingsObject>
) {
  if (delete_listing) {
    // Delete listing from memory
    // DON'T MOVE THIS PAST AN AWAIT POINT
    delete_listing_by_id(listing._id);
  } else {
    // Create listing, convert from async to event emitter
    // DON'T MOVE THIS PAST AN AWAIT POINT
    update_listing(listing).catch(err =>
      events.emit('listing_error', listing._id, err)
    );
  }
}

function delete_listing_by_id(listing_id: ListingID) {
  // Delete listing from memory
  if (projects_dbs[listing_id]?.remote?.connection !== null) {
    projects_dbs[listing_id].local.removeAllListeners();
    projects_dbs[listing_id].remote!.connection!.cancel();
  }

  delete projects_dbs[listing_id];
  delete createdListings[listing_id];

  // DON'T MOVE THIS PAST AN AWAIT POINT
  events.emit('listing_update', ['delete'], false, false, listing_id);
}

/**
 * Creates or updates the local Databases for a listing, using the info
 * The databases might already exist in browser local storage, but this
 * creates the corresponding PouchDBs.
 *
 * Sync start/end events are emitted.
 *
 * Guaranteed to emit the listing_updated event before first suspend point
 * @param listing_object Listing to update/create local DB
 */
export async function update_listing(
  listing_object: PouchDB.Core.ExistingDocument<ListingsObject>
) {
  const listing_id = listing_object._id;
  //const local_only = listing_object.local_only ?? false;
  console.debug(`Processing listing id ${listing_id}`);

  const jwt_token = await getTokenForCluster(listing_id);
  let jwt_conn: PossibleConnectionInfo = {};
  if (jwt_token === undefined) {
    if (DEBUG_APP) {
      console.debug('No JWT token for:', listing_id);
    }
  } else {
    // if (DEBUG_APP) {
    //   console.debug('Using JWT token for:', listing_id);
    // }
    jwt_conn = {
      jwt_token: jwt_token,
    };
  }

  //const people_local_id = listing_object['people_db']
  //  ? listing_id
  //  : DEFAULT_LISTING_ID;

  const projects_local_id = listing_object['projects_db']
    ? listing_id
    : DEFAULT_LISTING_ID;

  const projects_connection = materializeConnectionInfo(
    (await get_default_instance())['projects_db'],
    listing_object['projects_db'],
    jwt_conn
  );

  //const people_connection = materializeConnectionInfo(
  //  (await get_default_instance())['people_db'],
  //  listing_object['people_db']
  //);

  //const [people_did_change, people_local] = ensure_local_db(
  //  'people',
  //  people_local_id,
  //  true,
  //  people_dbs
  //);

  const [projects_did_change, projects_local] = ensure_local_db(
    'projects',
    listing_id,
    true,
    projects_dbs,
    true
  );

  // These createdListings objects are created as soon as possible
  // (As soon as the DBs are available)
  const old_value = createdListings?.[listing_id];
  createdListings[listing_id] = {
    listing: listing_object,
    projects: projects_local,
    //people: people_local,
  };
  // DON'T MOVE THIS PAST AN AWAIT POINT
  events.emit(
    'listing_update',
    old_value === undefined ? ['create'] : ['update', old_value],
    projects_did_change,
    false, //people_did_change,
    listing_object._id
  );

  // Only sync active listings: To do so, get all active docs,
  // then use that to select active listings from directory
  const to_sync: {[key: string]: ExistingActiveDoc} = {};

  if (projects_did_change) {
    events.emit('projects_sync_state', true, listing_object);

    // local_projects_db.changes has been changed
    // So we need to re-attach everything

    active_db
      .changes({...default_changes_opts, since: 0})
      .on('change', info => {
        if (info.doc === undefined) {
          logError('Active doc changes has doc undefined');
          return undefined;
        }
        const split_id = split_full_project_id(info.doc._id);
        const listing_id = split_id.listing_id;
        const project_id = split_id.project_id;
        console.debug('Active db listing id', listing_id);
        console.debug('ActiveDB Info in update listing', info);
        if (info.deleted) {
          // Some listing deactivated: delete its local dbs and such
          delete to_sync[listing_id];
          delete_listing_by_id(listing_id);
        } else {
          // Some listing activated
          console.debug('info.id', info.id);
          to_sync[info.id] = info.doc!;
          // Need to fetch it first though.
          projects_local.local
            .get(project_id)
            // If get succeeds, undelete/create:
            .then(
              existing_project =>
                process_project(
                  false,
                  listing_object,
                  to_sync[info.id],
                  projects_connection,
                  existing_project
                ),
              // Even for 404 errors, since the listing is active, it should exist
              // so it's an error if it doesn't exist.
              err => events.emit('listing_error', listing_id, err)
            );
        }
        return undefined;
      });

    // As with directory, when updates come through to the projects db,
    // they are listened to from here:

    projects_local.local
      .changes({...default_changes_opts, since: 0})
      .on('change', async info => {
        if (info.doc === undefined) {
          logError('projects_local doc changes has doc undefined');
          return undefined;
        }
        if (info.id in to_sync) {
          // Only active projects
          // This can delete for deletion changes
          process_project(
            info.deleted || false,
            listing_object,
            to_sync[info.id],
            projects_connection,
            info.doc!
          );
        }
        return undefined;
      })
      .on('error', err => {
        events.emit('listing_error', listing_id, err);
        ping_sync_error();
      });
  }

  //const people_pause = (message?: string) => () => {
  //  if (!people_did_change) return;
  //  console.debug('People settled for', listing_id, 'with message', message);
  //};

  const projects_pause = (message?: string) => () => {
    if (!projects_did_change) return;
    console.debug('Projects settled for', listing_id, 'with message', message);
    console.debug('Active project IDs in', listing_id, 'are', to_sync);
    events.emit('projects_sync_state', false, listing_object);
  };

  //const [, people_remote] = ensure_synced_db(
  //  people_local_id,
  //  people_connection,
  //  people_dbs
  //);

  //if (people_remote.remote !== null && people_remote.remote.connection !== null) {
  //  people_remote.remote.connection!.once('paused', people_pause('Sync'));
  //} else {
  //  people_pause('No Sync')();
  //}

  const [, projects_remote] = ensure_synced_db(
    projects_local_id,
    projects_connection,
    projects_dbs
  );

  if (
    projects_remote.remote !== null &&
    projects_remote.remote.connection !== null
  ) {
    projects_remote.remote.connection!.once('paused', projects_pause('Sync'));
    projects_remote.remote
      .connection!.on('active', () => {
        console.debug('Projects sync started up again', listing_id);
        throttled_ping_sync_down();
      })
      .on('denied', err => {
        console.debug('Projects sync denied', listing_id, err);
        ping_sync_denied();
      })
      //.on('complete', info => {
      //  console.debug('Projects sync complete', listing_id, info);
      //})
      //.on('change', info => {
      //  console.debug('Projects sync change', listing_id, info);
      //  throttled_ping_sync_down();
      //})
      .on('error', (err: any) => {
        if (err.status === 401) {
          console.debug('Projects sync waiting on auth', listing_id);
        } else {
          console.debug('Projects sync error', listing_id, err);
          ping_sync_error();
        }
      });
  } else {
    projects_pause('No Sync')();
  }
}

export async function activate_project(
  listing_id: string,
  project_id: NonUniqueProjectID,
  username: string | null = null,
  password: string | null = null,
  is_sync = true
): Promise<ProjectID> {
  if (project_id.startsWith('_design/')) {
    throw Error(`Cannot activate design document ${project_id}`);
  }
  if (project_id.startsWith('_')) {
    throw Error(`Projects should not start with a underscore: ${project_id}`);
  }
  const active_id = resolve_project_id(listing_id, project_id);
  try {
    await active_db.get(active_id);
    console.debug('Have already activated', active_id);
    return active_id;
  } catch (err: any) {
    console.debug('Activating', active_id);
    if (err.status === 404) {
      // TODO: work out a better way to do this
      await active_db.put({
        _id: active_id,
        listing_id: listing_id,
        project_id: project_id,
        username: username,
        password: password,
        is_sync: is_sync,
        is_sync_attachments: false,
      });
      return active_id;
    } else {
      throw err;
    }
  }
}

/**
 * Deletes or updates a project: If the project is newly synced (needs the local
 * PouchDB data & metadata to be created) or has been removed
 *
 * Guaranteed to emit the project_updated event before first suspend point
 *
 * @param delete Boolean: true to delete, false if to not be deleted
 * @param project_object Project to delete/undelete
 */
function process_project(
  delete_proj: boolean,
  listing: ListingsObject,
  active_project: ExistingActiveDoc,
  projects_db_connection: ConnectionInfo | null,
  project_object: ProjectObject
) {
  console.log(
    'Processing project',
    delete_proj,
    listing,
    active_project,
    projects_db_connection,
    project_object
  );
  if (delete_proj) {
    // Delete project from memory
    const project_id = active_project.project_id;

    if (metadata_dbs[project_id].remote?.connection !== null) {
      metadata_dbs[project_id].local.removeAllListeners();
      metadata_dbs[project_id].remote!.connection!.cancel();
    }

    if (data_dbs[project_id].remote?.connection !== null) {
      data_dbs[project_id].local.removeAllListeners();
      data_dbs[project_id].remote!.connection!.cancel();
    }

    delete metadata_dbs[active_project._id];
    delete data_dbs[active_project._id];
    delete createdProjects[active_project._id];

    // DON'T MOVE THIS PAST AN AWAIT POINT
    events.emit(
      'project_update',
      ['delete'],
      false,
      false,
      listing,
      active_project,
      project_object
    );
  } else {
    // DON'T MOVE THIS PAST AN AWAIT POINT
    console.debug('check error', listing, active_project);
    update_project(
      listing,
      active_project,
      projects_db_connection,
      project_object
    ).catch(err => events.emit('project_error', listing, active_project, err));
  }
}

/**
 * Creates or updates the local DBs for a project, using the info
 * The databases might already exist in browser local storage, but this
 * creates the corresponding PouchDBs.
 *
 * Sync start/end events are emitted.
 *
 * Guaranteed to emit the project_updated event before first suspend point
 * @param project_object Project to update/create local DB
 */
export async function update_project(
  listing: ListingsObject,
  active_project: ExistingActiveDoc,
  projects_db_connection: ConnectionInfo | null,
  project_object: ProjectObject
): Promise<void> {
  /**
   * Each project needs to know it's active_id to lookup the local
   * metadata/data databases.
   */
  const active_id = active_project._id;
  console.debug('Processing project', active_id, active_project);

  const [meta_did_change, meta_local] = ensure_local_db(
    'metadata',
    active_id,
    active_project.is_sync,
    metadata_dbs,
    true
  );
  const [data_did_change, data_local] = ensure_local_db(
    'data',
    active_id,
    active_project.is_sync,
    data_dbs,
    active_project.is_sync_attachments
  );

  // These createdProjects objects are created as soon as possible
  // (As soon as the DBs are available)
  const old_value = createdProjects?.[active_id];
  createdProjects[active_id] = {
    project: project_object,
    active: active_project,
    meta: meta_local,
    data: data_local,
  };
  // DON'T MOVE THIS PAST AN AWAIT POINT
  events.emit(
    'project_update',
    old_value === undefined ? ['create'] : ['update', old_value],
    data_did_change,
    meta_did_change,
    listing,
    active_project,
    project_object
  );

  if (meta_did_change) {
    events.emit(
      'meta_sync_state',
      true,
      listing,
      active_project,
      project_object
    );
  }

  if (data_did_change) {
    events.emit(
      'data_sync_state',
      true,
      listing,
      active_project,
      project_object
    );
  }
  const meta_pause = (message?: string) => () => {
    if (!meta_did_change) return;
    console.debug(`Metadata settled for ${active_id} (${message})`);
    events.emit(
      'meta_sync_state',
      false,
      listing,
      active_project,
      project_object
    );
  };

  const data_pause = (message?: string) => () => {
    if (!data_did_change) return;
    console.debug(`Data settled for ${active_id} (${message})`);
    events.emit(
      'data_sync_state',
      false,
      listing,
      active_project,
      project_object
    );
  };

  // If we must sync with a remote endpoint immediately,
  // do it here: (Otherwise, emit 'paused' anyway to allow
  // other parts of FAIMS to continue)
  if (projects_db_connection !== null) {
    // Defaults to the same couch as the projects db, but different database name:
    const meta_connection_info = materializeConnectionInfo(
      {
        ...projects_db_connection,
        db_name: METADATA_DBNAME_PREFIX + project_object._id,
      },
      project_object.metadata_db
    );

    const data_connection_info = materializeConnectionInfo(
      {
        ...projects_db_connection,
        db_name: DATA_DBNAME_PREFIX + project_object._id,
      },
      project_object.data_db
    );

    const [, meta_remote] = ensure_synced_db(
      active_id,
      meta_connection_info,
      metadata_dbs
    );

    if (meta_remote.remote !== null && meta_remote.remote.connection !== null) {
      meta_remote.remote.connection!.once('paused', meta_pause('Sync'));
      meta_remote.remote
        .connection!.on('active', () => {
          console.debug('Meta sync started up again', active_id);
          throttled_ping_sync_down();
        })
        .on('denied', err => {
          console.debug('Meta sync denied', active_id, err);
          ping_sync_denied();
        })
        //.on('change', info => {
        //  console.debug('Meta sync change', active_id, info);
        //  throttled_ping_sync_down();
        //})
        //.on('complete', info => {
        //  console.debug('Meta sync complete', active_id, info);
        //})
        .on('error', (err: any) => {
          if (err.status === 401) {
            console.debug('Meta sync waiting on auth', active_id);
          } else {
            console.debug('Meta sync error', active_id, err);
            ping_sync_error();
          }
        });
    } else {
      meta_pause('No Sync')();
    }

    const [, data_remote] = ensure_synced_db(
      active_id,
      data_connection_info,
      data_dbs,
      {
        push: {},
        pull: {},
      }
    );

    if (data_remote.remote !== null && data_remote.remote.connection !== null) {
      data_remote.remote.connection!.once('paused', data_pause('Sync'));
      data_remote.remote
        .connection!.on('active', () => {
          console.debug('Data sync started up again', active_id);
          throttled_ping_sync_down();
          throttled_ping_sync_up();
        })
        .on('denied', err => {
          console.debug('Data sync denied', active_id, err);
          ping_sync_denied();
        })
        //.on('change', info => {
        //  console.debug('Data sync change', active_id, info);
        //})
        //.on('complete', info => {
        //  console.debug('Data sync complete', active_id, info);
        //})
        .on('error', (err: any) => {
          if (err.status === 401) {
            console.debug('Data sync waiting on auth', active_id);
          } else {
            console.debug('Data sync error', active_id, err);
            ping_sync_error();
          }
        });
    } else {
      data_pause('No Sync')();
    }
  } else {
    meta_pause('Local-only; No Sync')();
    data_pause('Local-only; No Sync')();
  }
}
