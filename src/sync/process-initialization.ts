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
import {ConnectionInfo, ListingsObject, ProjectObject} from 'faims3-datamodel';
import {logError} from '../logging';
import {getTokenForCluster} from '../users';

import {
  ConnectionInfo_create_pouch,
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
  directory_db,
  ensure_local_db,
  ensure_synced_db,
  ExistingActiveDoc,
  metadata_dbs,
  projects_dbs,
  setLocalConnection,
} from './databases';
import {events} from './events';
import {createdListings, createdProjects} from './state';

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

  const directory_paused = ConnectionInfo_create_pouch<ListingsObject>(
    directory_connection_info
  );

  directory_db.remote = {
    db: directory_paused,
    connection: null,
    info: directory_connection_info,
    options: {},
  };

  console.debug('%cSetting up directory local connection', 'background-color: cyan', directory_db);
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
  console.log('reprocess_listing', listing_id);
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
  console.log('process_listing', delete_listing, listing);
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
  console.debug('delete_listing_by_id', listing_id);
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
 * get_projects_from_conductor - retrieve projects list from the server
 *    and update the local projects database
 * @param listing_object - listing object representing the conductor instance
 */
async function get_projects_from_conductor(listing_object: ListingsObject) {
  // sometimes there is no url...
  if (listing_object.conductor_url === undefined) return;

  // make sure there is a local projects database
  // projects_did_change is true if this made a new database
  const [projects_did_change, projects_local] = ensure_local_db(
    'projects',
    listing_object._id,
    true,
    projects_dbs,
    true
  );

  // These createdListings objects are created as soon as possible
  // (As soon as the DBs are available)
  const old_value = createdListings?.[listing_object._id];
  createdListings[listing_object._id] = {
    listing: listing_object,
    projects: projects_local,
  };
  // DON'T MOVE THIS PAST AN AWAIT POINT
  events.emit(
    'listing_update',
    old_value === undefined ? ['create'] : ['update', old_value],
    projects_did_change,
    false,
    listing_object._id
  );

  // get the remote data
  const jwt_token = await getTokenForCluster(listing_object._id);

  console.debug('FETCH', listing_object.conductor_url);
  const response = await fetch(`${listing_object.conductor_url}api/directory`, {
    headers: {
      Authorization: `Bearer ${jwt_token}`,
    },
  });

  const directory = await response.json();
  console.log('going to look at the directory', directory.length);
  // make sure every project in the directory is stored in projects_local
  for (let i = 0; i < directory.length; i++) {
    const project_doc: ProjectObject = directory[i];
    console.debug('DIR inspecting', project_doc._id);
    // is this project already in projects_local?
    projects_local.local
      .get(project_doc._id)
      .then((existing_project: ProjectObject) => {
        // do we have to update it?
        if (
          existing_project.name !== project_doc.name ||
          existing_project.status !== project_doc.status
        ) {
          console.log('DIR updating', project_doc._id);
          return projects_local.local.post({
            ...existing_project,
            name: project_doc.name,
            status: project_doc.status,
          });
        }
      })
      .catch(err => {
        if (err.name === 'not_found') {
          console.debug('DIR storing', project_doc._id);
          // we don't have this project, so store it
          return projects_local.local.put(project_doc);
        }
      });
  }

  // TODO: how should we deal with projects that are removed from
  // the remote directory - should we delete them here or offer another option
  // what if there are unsynced records?

  return directory;
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
  console.debug(`Processing listing id ${listing_id}`);

  // get the projects from remote and update our local db
  const directory = await get_projects_from_conductor(listing_object);
  const jwt_token = await getTokenForCluster(listing_id);
  let jwt_conn: PossibleConnectionInfo = {};
  if (jwt_token === undefined) {
    if (DEBUG_APP) {
      console.debug('%cNo JWT token for:', 'background-color: cyan', listing_id);
    }
  } else {
    if (DEBUG_APP) {
      console.debug('%cUsing JWT token for:', 'background-color: cyan', listing_id);
    }
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

  // for all active projects, ensure we have the right database connections
  const active_projects = await get_active_projects();

  active_projects.rows.forEach(info => {
    if (info.doc === undefined) {
      logError('Active doc changes has doc undefined');
      return undefined;
    }
    const split_id = split_full_project_id(info.doc._id);
    const listing_id = split_id.listing_id;
    const project_id = split_id.project_id;
    const project_matches = directory.filter(
      (project: ProjectObject) => project._id === project_id
    );
    console.debug('ActiveDB listing id', listing_id);
    console.debug('ActiveDB Info in update listing', info);

    if (project_matches) ensure_project_databases(info.doc, project_matches[0]);
    // if not, this active project must be from another listing, so we can ignore here
  });

  // we are no longer syncing projects for this listing
  events.emit('projects_sync_state', false, listing_object);
}

/**
 * activate_project - make this project active for the user on this device
 * @param listing_id - listing_id where we find this project
 * @param project_id - non-unique project id
 * @param is_sync - should we sync records for this project (default true)
 * @returns A promise resolving to the fully resolved project id (listing_id || project_id)
 */
export async function activate_project(
  listing_id: string,
  project_id: NonUniqueProjectID,
  is_sync = true
): Promise<ProjectID> {
  if (project_id.startsWith('_design/')) {
    throw Error(`Cannot activate design document ${project_id}`);
  }
  if (project_id.startsWith('_')) {
    throw Error(`Projects should not start with a underscore: ${project_id}`);
  }
  const active_id = resolve_project_id(listing_id, project_id);
  if (await project_is_active(active_id)) {
    console.debug('Have already activated', active_id);
    return active_id;
  } else {
    console.debug('%cActivating', 'background-color: pink;', active_id);
    const active_doc = {
      _id: active_id,
      listing_id: listing_id,
      project_id: project_id,
      username: '', // TODO these are not used and should be removed
      password: '',
      is_sync: is_sync,
      is_sync_attachments: false,
    };
    const response = await active_db.put(active_doc);
    if (response.ok) {
      const project_object = await get_project_from_directory(
        active_doc.listing_id,
        project_id
      );
      console.log(
        '%cProject Object',
        'background-color: pink;',
        project_object
      );
      if (project_object)
        await ensure_project_databases(
          {...active_doc, _rev: response.rev},
          project_object
        );
      else
        throw Error(
          `Unable to initialise databases for new active project ${project_id}`
        );
    } else {
      console.warn('Error saving new active document', response);
      throw Error(`Unable to store new active project ${project_id}`);
    }

    return active_id;
  }
}

async function get_project_from_directory(
  listing_id: ListingID,
  project_id: ProjectID
) {
  // look in the project databases for this project id
  // and return the record from there

  if (listing_id in projects_dbs) {
    const project_db = projects_dbs[listing_id];
    try {
      const result = await project_db.local.get(project_id);
      return result as ProjectObject;
    } catch {
      return undefined;
    }
  }
}

async function get_active_projects() {
  return await active_db.allDocs({include_docs: true});
}

async function project_is_active(id: string) {
  try {
    await active_db.get(id);
    return true;
  } catch (err: any) {
    if (err.status === 404) {
      return false;
    }
    // pass on any other error
    throw err;
  }
}

/**
 * Deletes a project
 *
 * Guaranteed to emit the project_updated event before first suspend point
 *
 * @param active_doc an ActiveDoc object with connection info
 * @param project_object Project to delete/undelete
 */
function delete_project(
  active_doc: ExistingActiveDoc,
  project_object: ProjectObject
) {
  console.log('Deleting project', active_doc, project_object);
  // Delete project from memory
  const project_id = active_doc.project_id;

  if (metadata_dbs[project_id].remote?.connection !== null) {
    metadata_dbs[project_id].local.removeAllListeners();
    metadata_dbs[project_id].remote!.connection!.cancel();
  }

  if (data_dbs[project_id].remote?.connection !== null) {
    data_dbs[project_id].local.removeAllListeners();
    data_dbs[project_id].remote!.connection!.cancel();
  }

  delete metadata_dbs[active_doc._id];
  delete data_dbs[active_doc._id];
  delete createdProjects[active_doc._id];

  // DON'T MOVE THIS PAST AN AWAIT POINT
  events.emit(
    'project_update',
    ['delete'],
    false,
    false,
    active_doc,
    project_object
  );
}

/**
 * Creates or updates the local DBs for a project, using the info
 * The databases might already exist in browser local storage, but this
 * creates the corresponding PouchDBs.
 *
 * Sync start/end events are emitted.
 *
 * Guaranteed to emit the project_updated event before first suspend point
 *
 * @param active_doc an ActiveDoc object with project connection info
 * @param project_object Project to update/create local DB
 */
export async function ensure_project_databases(
  active_doc: ExistingActiveDoc,
  project_object: ProjectObject
): Promise<void> {
  /**
   * Each project needs to know it's active_id to lookup the local
   * metadata/data databases.
   */
  const active_id = active_doc._id;
  console.debug('Ensure project databases', active_doc, project_object);

  // get meta and data databases for the active project
  const [meta_did_change, meta_local] = ensure_local_db(
    'metadata',
    active_id,
    active_doc.is_sync,
    metadata_dbs,
    true
  );
  const [data_did_change, data_local] = ensure_local_db(
    'data',
    active_id,
    active_doc.is_sync,
    data_dbs,
    active_doc.is_sync_attachments
  );

  // These createdProjects objects are created as soon as possible
  // (As soon as the DBs are available)
  const old_value = createdProjects?.[active_id];
  createdProjects[active_id] = {
    project: project_object,
    active: active_doc,
    meta: meta_local,
    data: data_local,
  };

  // DON'T MOVE THIS PAST AN AWAIT POINT
  events.emit(
    'project_update',
    old_value === undefined ? ['create'] : ['update', old_value],
    data_did_change,
    meta_did_change,
    active_doc,
    project_object
  );

  if (meta_did_change) {
    events.emit('meta_sync_state', true, active_doc, project_object);
  }

  if (data_did_change) {
    events.emit('data_sync_state', true, active_doc, project_object);
  }
  const meta_pause = (message?: string) => () => {
    if (!meta_did_change) return;
    console.debug(`Metadata settled for ${active_id} (${message})`);
    events.emit('meta_sync_state', false, active_doc, project_object);
  };

  const data_pause = (message?: string) => () => {
    if (!data_did_change) return;
    console.debug(`Data settled for ${active_id} (${message})`);
    events.emit('data_sync_state', false, active_doc, project_object);
  };

  // Connect to remote databases

  // If we must sync with a remote endpoint immediately,
  // do it here: (Otherwise, emit 'paused' anyway to allow
  // other parts of FAIMS to continue)

  const jwt_token = await getTokenForCluster(active_doc.listing_id);

  // SC: this little dance is because the db_name in PossibleConnectionObject
  // which is the type of metadata_db in the project object is possibly
  // undefined.  This should really not be the case.
  // TODO: make sure that all project objects have a proper db_name
  let metadata_db_name;
  if (project_object.metadata_db?.db_name)
    metadata_db_name = project_object.metadata_db.db_name;
  else metadata_db_name = 'metadata-' + project_object._id;

  const meta_connection_info: ConnectionInfo = {
    jwt_token: jwt_token,
    db_name: metadata_db_name,
    ...project_object.metadata_db,
  };

  let data_db_name;
  if (project_object.data_db?.db_name)
    data_db_name = project_object.data_db.db_name;
  else data_db_name = 'data-' + project_object._id;

  const data_connection_info: ConnectionInfo = {
    jwt_token: jwt_token,
    db_name: data_db_name,
    ...project_object.data_db,
  };

  console.log('update_project data connection', data_connection_info);

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
      .on('error', (err: any) => {
        if (err.status === 401) {
          console.debug('Meta sync waiting on auth', active_id);
        } else {
          console.debug('Meta sync error', active_id, err);
          ping_sync_error();
        }
      });

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
