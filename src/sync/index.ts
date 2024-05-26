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
 *   This is the primary entry point to the sync code for use within the rest of
 *   the app. Custom react hooks to work with pouch should use this code to map
 *   between pouchdb event handlers and react hooks.
 */

import {events} from './events';
import PouchDB from 'pouchdb-browser';
import PouchDBFind from 'pouchdb-find';
import pouchdbDebug from 'pouchdb-debug';
import {ProjectID} from 'faims3-datamodel';
import {DEBUG_APP} from '../buildconfig';
import {ProjectDataObject, ProjectMetaObject} from 'faims3-datamodel';
import {
  data_dbs,
  ExistingActiveDoc,
  ListingsObject,
  metadata_dbs,
  directory_db,
} from './databases';
import {
  all_projects_updated,
  createdProjects,
  createdProjectsInterface,
} from './state';
import {logError} from '../logging';

PouchDB.plugin(PouchDBFind);
PouchDB.plugin(pouchdbDebug);

// generate verbose debug output from pouchdb
if (import.meta.env.VITE_POUCHDB_DEBUG === 'true') PouchDB.debug.enable('*');
else PouchDB.debug.disable();

/**
 * Allows the user to asynchronously await for any of listings_updated,
 * all_projects_updated, listing_projects_synced, all_meta_synced,
 * all_data_updated, or anything else that is updated along with an emission
 * of the 'all_state' event from DirectoryEmitter.
 *
 * This will only resolve when the given predicate returns true.
 *
 * @param statePredicate Function to run, return true: will cause this
 *  waitForStateOnce to resolve. Otherwise, return of false will not cause
 *  anything to happen (yet). If returned false, it may be called again.
 *  Errors bubble up to this waitForStateOnce's promise.
 * @returns Promise that resolves/rejects when state changes.
 */
export async function waitForStateOnce(
  statePredicate: () => boolean
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const all_state_cb = () => {
      // Don't let errors in statePredicate go uncaught
      let do_resolve = false;
      try {
        do_resolve = statePredicate();
      } catch (err: unknown) {
        directory_error_cb(err);
      }
      // Only resolve this promise if the predicate returned true
      if (do_resolve) {
        // Cleanup
        events.removeListener('all_state', all_state_cb);
        events.removeListener('directory_error', directory_error_cb);
        resolve();
      }
    };
    const directory_error_cb = (err: unknown) => {
      // Cleanup
      events.removeListener('all_state', all_state_cb);
      events.removeListener('directory_error', directory_error_cb);
      // Bubble up to main promise
      reject(err);
    };
    events.on('all_state', all_state_cb);
    events.on('directory_error', directory_error_cb);
    // Initial call when no event occurs.
    all_state_cb();
  });
}

export async function getProject(
  project_id: ProjectID
): Promise<createdProjectsInterface> {
  // Wait for all_projects_updated to possibly change before returning
  // error/data DB if it's ready.
  await waitForStateOnce(() => all_projects_updated);
  if (project_id in data_dbs) {
    return createdProjects[project_id];
  } else {
    throw `Project ${project_id} is not known`;
  }
}

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
export function listenProject(
  project_id: ProjectID,
  // Listener, returning a destructor
  // Listener receives an 'error' function to let it asynchronously throw errors.
  // The destructor is called before a second listener is called
  // but the destructor is optional
  listener: (
    value: createdProjectsInterface,
    throw_error: (err: any) => void,
    meta_changed: boolean,
    data_changed: boolean
  ) => 'keep' | 'noop' | ((replaced: boolean) => void),
  error_listener: (value: unknown) => any
): () => void {
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
    _listing: unknown,
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
}

/**
 * Returns the current Data PouchDB of a project. This waits for the initial
 * sync to finish enough to know if the project exists or not before returning
 * (Hence, use this instead of createdProjects)
 *
 * @param active_id Full Project ID to get Pouch data DB of.
 * @returns Pouch Data DB (May become invalid at some point in the future,
 *     If, for example, the project changes remote DB.
 *     Make sure to use listenProject to avoid this)
 */
export async function getDataDB(
  active_id: ProjectID
): Promise<PouchDB.Database<ProjectDataObject>> {
  // Wait for all_projects_updated to possibly change before returning
  // error/data DB if it's ready.
  await waitForStateOnce(() => all_projects_updated);
  if (active_id in data_dbs) {
    return data_dbs[active_id].local;
  } else {
    throw `Project ${active_id} is not known`;
  }
}

/**
 * Allows you to listen for changes from a Project's Data DB.
 * This is a working alternative to getDataDB.changes
 * (as getDataDB.changes that may detach after updates to the owning listing
 * or the owning active DB, or if the sync is toggled on/off)
 *
 * @param active_id Project ID to listen on the DB for.
 * @param change_opts
 * @param change_listener
 * @param error_listener
 * @returns Detach function: call this to stop all changes
 */
export function listenDataDB(
  active_id: ProjectID,
  change_opts: PouchDB.Core.ChangesOptions,
  change_listener: (
    value: PouchDB.Core.ChangesResponseChange<ProjectDataObject>
  ) => any,
  error_listener: (value: any) => any
): () => void {
  return listenProject(
    active_id,
    (project, throw_error, _meta_changed, data_changed) => {
      if (DEBUG_APP) {
        console.info(
          'listenDataDB changed',
          project,
          throw_error,
          _meta_changed,
          data_changed
        );
      }
      if (data_changed) {
        const changes = project.data.local.changes(change_opts);
        changes.on(
          'change',
          (value: PouchDB.Core.ChangesResponseChange<ProjectDataObject>) => {
            if (DEBUG_APP) {
              console.debug('listenDataDB changes', value);
            }
            return change_listener(value);
          }
        );
        changes.on('error', throw_error);
        return () => {
          if (DEBUG_APP) {
            console.info('listenDataDB cleanup called');
          }
          changes.cancel();
        };
      } else {
        return 'keep';
      }
    },
    error_listener
  );
}

/**
 * Returns the current Meta PouchDB of a project. This waits for the initial
 * sync to finish enough to know if the project exists or not before returning
 * (Hence, use this instead of createdProjects)
 *
 * @param active_id Full Project ID to get Pouch data DB of.
 * @returns Pouch Data DB (May become invalid at some point in the future,
 *     If, for example, the project changes remote DB.
 *     Make sure to use listenProject to avoid this)
 */
export async function getProjectDB(
  active_id: ProjectID
): Promise<PouchDB.Database<ProjectMetaObject>> {
  // Wait for all_projects_updated to possibly change before returning
  // error/data DB if it's ready.
  await waitForStateOnce(() => all_projects_updated);
  if (active_id in metadata_dbs) {
    return metadata_dbs[active_id].local;
  } else {
    throw `Project ${active_id} is not known`;
  }
}

/**
 * Allows you to listen for changes from a Project's Meta DB.
 * This is a working alternative to getProjectDB.changes
 * (as getProjectDB.changes that may detach after updates to the owning listing
 * or the owning active DB, or if the sync is toggled on/off)
 *
 * @param active_id Project ID to listen on the DB for.
 * @param change_opts
 * @param change_listener
 * @param error_listener
 * @returns Detach function: call this to stop all changes
 */
export function listenProjectDB(
  active_id: ProjectID,
  change_opts: PouchDB.Core.ChangesOptions,
  change_listener: (
    value: PouchDB.Core.ChangesResponseChange<ProjectMetaObject>
  ) => any,
  error_listener: (value: any) => any
): () => void {
  return listenProject(
    active_id,
    (project, throw_error, meta_changed) => {
      if (meta_changed) {
        const changes = project.meta.local.changes(change_opts);
        changes.on('change', change_listener);
        changes.on('error', throw_error);
        return changes.cancel.bind(changes);
      } else {
        return 'keep';
      }
    },
    error_listener
  );
}

export async function getAllListings(): Promise<ListingsObject[]> {
  const listings: ListingsObject[] = [];
  const res = await directory_db.local.allDocs({
    include_docs: true,
  });
  res.rows.forEach(e => {
    if (e.doc !== undefined && !e.id.startsWith('_')) {
      const doc = e.doc as ListingsObject;
      listings.push(doc);
    }
  });
  return listings;
}
