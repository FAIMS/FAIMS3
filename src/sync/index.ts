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
import {ProjectDataObject, ProjectMetaObject} from 'faims3-datamodel';
import {
  data_dbs,
  ListingsObject,
  metadata_dbs,
  directory_db,
} from './databases';

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

/**
 * Returns the current Data PouchDB of a project.
 *
 * @param active_id Full Project ID to get Pouch data DB of.
 * @returns Pouch Data DB
 */
export async function getDataDB(
  active_id: ProjectID
): Promise<PouchDB.Database<ProjectDataObject>> {
  if (active_id in data_dbs) {
    return data_dbs[active_id].local;
  } else {
    throw `Data DB of project ${active_id} is not known`;
  }
}

/**
 * Returns the current Meta PouchDB of a project.
 *
 * @param active_id Full Project ID to get Pouch data DB of.
 * @returns Pouch Data DB
 */
export async function getProjectDB(
  active_id: ProjectID
): Promise<PouchDB.Database<ProjectMetaObject>> {
  if (active_id in metadata_dbs) {
    return metadata_dbs[active_id].local;
  } else {
    throw `Meta DB of project ${active_id} is not known`;
  }
}

// Get all 'listings' (conductor server links) from the local directory database
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
