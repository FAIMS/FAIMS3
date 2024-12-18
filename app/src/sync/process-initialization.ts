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
 *   Code used in the initialisation of the app, getting database and projects etc.
 */
import {
  ListingID,
  ListingsObject,
  NonUniqueProjectID,
  ProjectID,
  resolve_project_id,
  split_full_project_id,
} from '@faims3/data-model';
import {getAllListings} from '.';
import {CONDUCTOR_URLS} from '../buildconfig';
import {useAuthStore} from '../context/store';
import {logError} from '../logging';
import {
  ExistingActiveDoc,
  active_db,
  directory_db,
  ensure_local_db,
  projects_dbs,
} from './databases';
import {events} from './events';
import {ProjectObject, ensure_project_databases} from './projects';
import {addOrUpdateListing, deleteListing, getListing} from './state';

/**
 * update_directory - make sure we have listings for each
 * configured server and update the list of projects if we
 * are logged in.
 * Called on startup or page/app refresh.
 */
export async function update_directory() {
  // get existing stored listings from the local db
  const listings = await getAllListings();

  // if there are none, we'll create them from the configured URLS
  if (listings.length === 0) {
    for (let i = 0; i < CONDUCTOR_URLS.length; i++) {
      const listing = await generate_listing(CONDUCTOR_URLS[i]);
      listings.push(listing);
    }
  }

  // now get projects for each listing
  for (let i = 0; i < listings.length; i++)
    get_projects_from_conductor(listings[i]);

  // and make sure all activated projects have the required databases
  ensureActiveProjects();
}

/**
 * Create and store a listings object for this conductor instance
 *
 * @param url - URL of the Conductor instance
 * @returns A Listings object
 */
async function generate_listing(url: string): Promise<ListingsObject> {
  const url_object = new URL(url);
  const listing: PouchDB.Core.Document<ListingsObject> = {
    _id: url_object.host,
    id: url_object.host,
    conductor_url: url,
    name: url_object.host, // default name from hostname
    description: '',
    prefix: '',
  };

  await fetch(url + '/api/info')
    .then(response => response.json() as unknown as ListingsObject)
    .then(data => {
      listing._id = data.id;
      listing.id = data.id;
      listing.conductor_url = data.conductor_url;
      listing.name = data.name;
      listing.description = data.description;
      listing.prefix = data.prefix;
    })
    .catch(() => {
      listing.description = 'No Description';
    });

  directory_db.local.put(listing);
  return listing;
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
function process_listing(
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
    // update_listing(listing).catch(err =>
    //   events.emit('listing_error', listing._id, err)
    // );
  }
}

function delete_listing_by_id(listing_id: ListingID) {
  // Delete listing from memory
  if (
    projects_dbs[listing_id] &&
    projects_dbs[listing_id]?.remote?.connection !== null
  ) {
    projects_dbs[listing_id].local.removeAllListeners();
    projects_dbs[listing_id].remote!.connection!.cancel();
  }

  delete projects_dbs[listing_id];
  deleteListing(listing_id);

  // DON'T MOVE THIS PAST AN AWAIT POINT
  events.emit('listing_update', ['delete'], false, false, listing_id);
}

/**
 * get_projects_from_conductor - retrieve projects list from the server
 *    and update the local projects database
 * @param listing - containing information about the server
 */
async function get_projects_from_conductor(listing: ListingsObject) {
  if (!listing.conductor_url) return;

  // make sure there is a local projects database
  // projects_did_change is true if this made a new database
  const [projects_did_change, projects_local] = ensure_local_db(
    'projects',
    listing.id,
    true,
    projects_dbs,
    true
  );

  const previous_listing = getListing(listing.id);
  addOrUpdateListing(listing.id, listing, projects_local);

  // DON'T MOVE THIS PAST AN AWAIT POINT
  events.emit(
    'listing_update',
    previous_listing === undefined ? ['create'] : ['update', previous_listing],
    projects_did_change,
    false,
    listing.id
  );

  // get the remote data

  // TODO this is stupid because we are just guessing which 'user' we should use
  // to make the request - unless we want to track active users across both
  // listings and globally, then this is just going to take the first one
  const serverUsers = useAuthStore.getState().servers[listing.id]?.users ?? {};
  const keys = Object.keys(serverUsers);
  const jwt_token = keys.length > 0 ? serverUsers[keys[0]].token : null;
  if (!jwt_token) {
    console.error(
      'Could not get token for listing with ID: ',
      listing.id,
      'This logic is highly suspect!'
    );
    return;
  }

  fetch(`${listing.conductor_url}/api/directory`, {
    headers: {
      Authorization: `Bearer ${jwt_token}`,
    },
  })
    .then(response => response.json())
    .then(directory => {
      // make sure every project in the directory is stored in projects_local
      for (let i = 0; i < directory.length; i++) {
        const project_doc: ProjectObject = directory[i];
        // is this project already in projects_local?
        projects_local.local
          .get(project_doc._id)
          .then((existing_project: ProjectObject) => {
            // do we have to update it?
            if (
              existing_project.name !== project_doc.name ||
              existing_project.status !== project_doc.status
            ) {
              projects_local.local.post({
                ...existing_project,
                name: project_doc.name,
                status: project_doc.status,
              });
            }
          })
          .catch(err => {
            if (err.name === 'not_found') {
              // we don't have this project, so store it
              // add in the conductor url we got it from
              // TODO: this should already be there in the API
              // also that default to CONDUCTOR_URLS[0] is because listings
              // conductor_url is optional, it shouldn't be...
              return projects_local.local.put({
                ...project_doc,
                conductor_url: listing.conductor_url || CONDUCTOR_URLS[0],
              });
            }
          });
      }
    });

  // TODO: how should we deal with projects that are removed from
  // the remote directory - should we delete them here or offer another option
  // what if there are unsynced records?
}

/**
 * Ensure that all active projects have the appropriate databases
 * and are included in the active projects list
 */
export async function ensureActiveProjects() {
  // for all active projects, ensure we have the right database connections
  const active_projects = await active_db.allDocs({include_docs: true});

  active_projects.rows.forEach(row => {
    if (row.doc === undefined) {
      logError('Active doc changes has doc undefined');
      return;
    } else {
      const split_id = split_full_project_id(row.doc._id);
      const listing_id = split_id.listing_id;
      const project_id = split_id.project_id;
      get_project_from_directory(listing_id, project_id).then(
        project_object => {
          const doc = row.doc as ExistingActiveDoc;
          if (project_object) ensure_project_databases(doc, project_object);
        }
      );
    }
  });
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
    return active_id;
  } else {
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
