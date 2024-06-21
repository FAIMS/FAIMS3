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
 * Filename: projects.ts
 * Description:
 *    Manage the current activated projects in the app
 */

import {
  ProjectObject,
  ProjectMetaObject,
  ProjectDataObject,
  ProjectsList,
  ProjectInformation,
  split_full_project_id,
  ProjectID,
} from 'faims3-datamodel';
import {
  ExistingActiveDoc,
  LocalDB,
  data_dbs,
  ensure_local_db,
  ensure_synced_db,
  metadata_dbs,
} from './databases';
import {getTokenForCluster, shouldDisplayProject} from '../users';
import {waitForStateOnce} from '.';
import {all_projects_updated} from './state';
import {DEBUG_APP} from '../buildconfig';
import {logError} from '../logging';
import {events} from './events';
import {
  ConnectionInfo,
  throttled_ping_sync_down,
  ping_sync_denied,
  ping_sync_error,
  throttled_ping_sync_up,
} from './connection';

export type createdProjectsInterface = {
  project: ProjectObject;
  active: ExistingActiveDoc;
  meta: LocalDB<ProjectMetaObject>;
  data: LocalDB<ProjectDataObject>;
};
/**
 * This is appended to whenever a project has its
 * meta & data local dbs come into existence.
 *
 * This is used by getProjectDB/getDataDB in index.ts, as the way to get
 * ProjectObjects
 *
 * Created/Modified by update_project in process-initialization.ts
 */

const createdProjects: {[key: string]: createdProjectsInterface} = {};

export const projectIsActivated = (project_id: string) => {
  return createdProjects[project_id] !== undefined;
};

export const getProject = async (
  project_id: ProjectID
): Promise<createdProjectsInterface> => {
  // Wait for all_projects_updated to possibly change before returning
  // error/data DB if it's ready.
//  await waitForStateOnce(() => all_projects_updated);
  if (project_id in data_dbs) {
    return createdProjects[project_id];
  } else {
    throw `Project ${project_id} is not known`;
  }
};

/**
 * Return all active projects the user has access to.
 */
export const getActiveProjectList = async (): Promise<ProjectInformation[]> => {
  //await waitForStateOnce(() => all_projects_updated);

  const output: ProjectInformation[] = [];
  for (const listing_id_project_id in createdProjects) {
    if (await shouldDisplayProject(listing_id_project_id)) {
      const split_id = split_full_project_id(listing_id_project_id);
      output.push({
        name: createdProjects[listing_id_project_id].project.name,
        description: createdProjects[listing_id_project_id].project.description,
        last_updated:
          createdProjects[listing_id_project_id].project.last_updated,
        created: createdProjects[listing_id_project_id].project.created,
        status: createdProjects[listing_id_project_id].project.status,
        project_id: listing_id_project_id,
        is_activated: true,
        listing_id: split_id.listing_id,
        non_unique_project_id: split_id.project_id,
      });
    }
  }
  console.log('returning active projects', output);
  return output;
};

/**
 * Allows you to listen for changes from a Project's Data/Meta DBs or other
 * project info like if it's to be synced or not (from createdProjects)
 * This is a working alternative to getDataDB.changes
 * (as getDataDB.changes that may detach after updates to the owning listing
 * or the owning active DB, or if the sync is toggled on/off)
 *
 * @param project_id Full Project ID to listen on the DB for.
 * @param listener
 *     Called whenever the project you're listening on is available
 *     __Not necessarily has the data or metadata fully synced__
 *     But the data & metadata dbs will be in data_dbs, meta_dbs,
 *     and createdProjects.
 *     * meta_changed and data_changed events flow from
 *     the 'project_update' event in events.ts, and signal if the
 *     PouchDB databases have been recreated (and might need to
 *     be re-listened on)
 *     * error is available for the listener to call to asynchronously
 *     throw errors up to the error_listener. Use this instead of
 *     what you give into error_listener to ensure cleanup is done.
 *     * returns a destructor: This destructor is called when either
 *       * listenProject's destructor is called
 *       * Errors occur that mean we stop listening
 *       * The project info is *updated* (replaced will be true)
 *       * The project info is dropped (e.g. the user left)
 *     * Returning _'keep'_ changes behaviour: If this is a project info update,
 *       the destructor previously returned or kept from listener isn't run,
 *       and in fact, sticks around until next listener() (not returning keep)
 *       or other detach/error scenario.
 *     * Returning _'noop'_ returns a constructor doing nothing
 *       (This is not 'void' )
 * @param error_listener
 *     Called once at the first error condition.
 *     * All projects are synced, but project_id isn't a known project
 *     * errors in listener()
 *     * errors thrown asynchronously form listener
 *     * errors in the destructor from listener
 * @returns Detach function: call this to stop all changes
 */

export const listenProject = (
  project_id: ProjectID,
  listener: (
    value: createdProjectsInterface,
    throw_error: (err: any) => void,
    meta_changed: boolean,
    data_changed: boolean
  ) => 'keep' | 'noop' | ((replaced: boolean) => void),
  error_listener: (value: unknown) => any
): (() => void) => {
  if (DEBUG_APP) {
    console.debug('listenProject starting');
  }
  // This is an array to allow it to be read/writeable from closures
  const destructor: ['deleted' | 'initial' | ((replaced: boolean) => void)] = [
    'initial',
  ];

  /* Set on a first error, to avoid multiple calls to error_listener */
  const current_error: [null | {}] = [null];

  /* Called when errors occur. Propagates to error_listener
  but also runs cleanup */
  const self_destruct = (err: unknown, detach = true) => {
    if (DEBUG_APP) {
      console.debug('listenProject running self_destruct');
    }
    // Only call error_listener once
    if (current_error[0] === null) {
      current_error[0] = (err as null | {}) ?? (Error('undefined error') as {});
      try {
        error_listener(err);
      } catch (err: unknown) {
        logError(err);
        if (detach) {
          detach_cb();
        }
        throw err; // Allow node to report as uncaught
      }
      if (detach) {
        detach_cb();
      }
    }
  };

  const project_update_cb = (
    type: ['update', createdProjectsInterface] | ['delete'] | ['create'],
    meta_changed: boolean,
    data_changed: boolean,
    active: ExistingActiveDoc
  ) => {
    if (DEBUG_APP) {
      console.debug('listenProject running project_update hook');
    }
    if (project_id === active._id) {
      if (type[0] === 'delete') {
        // Run destructor when the createdProjectsInterface object is deleted.
        if (typeof destructor[0] !== 'function') {
          logError(
            'Non-fatal: listenProject destructor has gone ' +
              "missing OR 'delete' event did not follow " +
              "'update' or 'create' event"
          );
        } else {
          destructor[0](false);
        }
        destructor[0] = 'deleted';
      } else {
        try {
          const returned = listener(
            createdProjects[active._id],
            self_destruct,
            meta_changed,
            data_changed
          );
          if (returned !== 'keep') {
            // If this is an update (destructor exists) then run destructor,
            // and set the new destructor
            if (typeof destructor[0] === 'function') {
              if (type[0] !== 'update') {
                console.warn(
                  "Why is the destructor still around? either '" +
                    `${type[0]} was triggered in the wrong place or some part` +
                    " of this function didn't remove the destructor after use"
                );
              }
              destructor[0](true);
            }
            if (returned === 'noop') {
              // if the listener returned void
              destructor[0] = () => {};
            } else {
              destructor[0] = returned;
            }
          }
        } catch (err: unknown) {
          self_destruct(err);
        }
      }
    }
  };

  /*
  All state is monitored because, just like getDataDB, when all projects are
  known and the changes hasn't been set yet, the user has tried to listen on
  a Data DB that doesn't exist.
  */
  const all_state_cb = () => {
    if (DEBUG_APP) {
      console.debug('listenProject running all_state hook');
    }
    if (all_projects_updated && destructor[0] === 'initial') {
      self_destruct(Error(`Project ${project_id} is not known`));
    } else if (all_projects_updated && destructor[0] === 'deleted') {
      /*
      In a flow that doesn't hit this warning:
      1. The project is deleted, e.g. by the user leaving the project
      2. project_update 'delete' event is emitted
      3. __User of this function receives the delete event, and detaches
           by calling the return of this function.__
      3a. destructor is NOT CALLED with type: 'deleted'
      4. Eventually (Or immediately after) all_state event is emitted with
         all_projects_updated === true.
      5. This function is NOT CALLED due to it being detached

      As long as the user calls the detacher (Return of this function) between
      a project_update 'delete' event and all_state is emitted, this warning is
      not given.

      Note: Event if 3a ('deleted') destructor is called before the user calls
        the detacher, it still wouldn't error out because whilst the destructor
        would run with 'deleted' and set to 'deleted', all_state would detach
        by the user calling the detach function.
      */
      console.warn(
        `Project ${project_id} did exist, was deleted, but a function` +
          "listening to events on it's data DB didn't call the listener's " +
          'detacher function at the right time (immediately after' +
          'project_update event for the corresponding project id)'
      );
      // Allow the project to be undeleted & have listeners still work:
      // So don't detach_cb here.
    }
  };

  const detach_cb = () => {
    if (DEBUG_APP) {
      console.debug('listenProject running detach hook');
    }
    events.removeListener('project_update', project_update_cb);
    events.removeListener('all_state', all_state_cb);
    if (destructor[0] !== null && typeof destructor[0] === 'function') {
      try {
        destructor[0](false);
      } catch (err: unknown) {
        self_destruct(err, false);
      }
    }
  };
  if (DEBUG_APP) {
    console.debug('listenProject created hooks');
  }

  // It's possible we'll never receive 'project_update' whilst listening (as it
  // only gets called when the project information itself is changed, so invoke
  // the callback if the project exists
  const proj_info = createdProjects[project_id];
  if (proj_info !== undefined) {
    if (DEBUG_APP) {
      console.debug('listenProject running initial callback');
    }
    try {
      const returned = listener(proj_info, self_destruct, true, true);
      if (returned !== 'keep') {
        if (returned === 'noop') {
          // if the listener returned void
          destructor[0] = () => {};
        } else {
          destructor[0] = returned;
        }
      }
    } catch (err: unknown) {
      self_destruct(err);
    }
  }

  events.on('project_update', project_update_cb);
  events.on('all_state', all_state_cb);
  if (DEBUG_APP) {
    console.debug('listenProject finished setting up');
  }

  return detach_cb;
};

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

  // set up remote sync of metadata database
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

    // set up remote sync for data database
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

/** add a listener for changes on the local project database for a project
 *   listener will be called for any change in the database and passed
 *   the changed document as an argument
 * @param project_id - project id we are listening for
 * @param handler - handler function
 */
export const addProjectListener = (
  project_id: ProjectID,
  handler: (doc: any) => Promise<void>
) => {
  createdProjects[project_id]!.data.local.changes({
    since: 'now',
    live: true,
    include_docs: true,
  }).on('change', handler);
};
