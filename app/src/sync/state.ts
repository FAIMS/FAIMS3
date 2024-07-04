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
 * Filename: state.ts
 * Description:
 *   TODO
 */

import {ProjectID} from 'faims3-datamodel';
import {
  ProjectObject,
  ProjectMetaObject,
  ProjectDataObject,
  isRecord,
  mergeHeads,
} from 'faims3-datamodel';

import {
  ListingsObject,
  ActiveDoc,
  ExistingActiveDoc,
  LocalDB,
} from './databases';
import {DirectoryEmitter} from './events';
import {logError} from '../logging';

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
export const createdProjects: {[key: string]: createdProjectsInterface} = {};

export type createdListingsInterface = {
  listing: ListingsObject;
  projects: LocalDB<ProjectObject>;
};

/**
 * This is appended to whenever a listing has its
 * projects/people dbs come into existence. (Each individual project
 * isn't guaranteed to be in the createdProjects object. Use the
 * data_sync_state or project_update events to listen for such changes)
 *
 * This is the way to get ListingsObjects
 *
 * Created/Modified by update_listing in process-initialization.ts
 */
export const createdListings: {[key: string]: createdListingsInterface} = {};

/**
 * Value:  all listings are reasonably 'known' (i.e. the directory has
 * errored/paused after the initial sync pull at app start, OR we're using dummy
 * data)
 *
 * Created/Modified by register_sync_state in state.ts
 */
export let listings_updated = false;

/**
 * True when the listings_sync_state is true, AND all projects that are to be
 * in createdProjects have been created. When this is true, createdProjects
 * is not expected to change in a major way. (project_update events may
 * still occur, but the purpose of this is so that we can exclude the possibility
 * that a project hasn't synced yet when trying to wait for a project.)
 *
 * This essentially accumulates all the projects_sync_state events, combined with
 * the listings_sync_state. So only when they are all done syncing it is true.
 *
 * Created/Modified by register_sync_state in state.ts
 */
export let all_projects_updated = false;

/**
 * For each listing:
 * When createdListings is updated (listing_update), this is set to false
 * Then when the projects db stops syncing (projects_sync_state(false)),
 * this is set to true
 */
export const listing_projects_synced = new Map<string, boolean>();

/**
 * True when all the metadata DBs have been created & have either:
 *  * Pulled all changes from the remote, if this is the first connection OR
 *  * Don't have a remote to pull from
 * (Either case - the metadata DB is not expecting a lot of changes)
 *
 * This essentially accumulates meta_sync_state events, combined with
 * the all_projects_updated flag. So only when we know what meta DBs there are,
 * and they are all done syncing.
 *
 * Created/Modified by register_sync_state in state.ts
 */
export let all_meta_synced = false;
export let all_data_synced = false;

/**
 * Similar to listing_projects_synced  but is only in the map when the
 * project_update event is emitted, and only true when meta is synced
 * And it's mapping from ProjectID instead of listing ID
 */
export const projects_meta_synced = new Map<ProjectID, boolean>();
export const projects_data_synced = new Map<ProjectID, boolean>();

export function register_sync_state(initializeEvents: DirectoryEmitter) {
  // Emits project_known if all listings have their projects added to known_projects.
  const common_check = () => {
    all_projects_updated =
      // All listings known
      !listings_updated &&
      // All listings have been put in createdListings
      // All listings have fully synced up their projects dbs
      Array.from(listing_projects_synced.values()).every(v => v);
    // All projects have been put in createdProjects
    // Guaranteed to happen if the above is true (projects_sync_state event
    // triggering with 'false' is always after all project_update emitted)

    all_meta_synced =
      all_projects_updated &&
      Array.from(projects_meta_synced.values()).every(v => v);

    all_data_synced =
      all_projects_updated &&
      Array.from(projects_data_synced.values()).every(v => v);

    initializeEvents.emit('all_state');
  };

  initializeEvents.on('listings_sync_state', syncing => {
    listings_updated = syncing;

    common_check();
  });
  initializeEvents.on(
    'listing_update',
    (type, projects_changed, people_changed, listing_id) => {
      // Now we know we have to wait for the projects DB of listing
      // to fully sync by setting to false (But we don't have to wait if
      // projects_changed == false, and no projects_sync_state triggers)
      listing_projects_synced.set(
        listing_id,
        listing_projects_synced.get(listing_id) ?? !projects_changed
      );

      common_check();
    }
  );
  initializeEvents.on('projects_sync_state', (syncing, listing) => {
    listing_projects_synced.set(listing._id, !syncing);

    common_check();
  });
  initializeEvents.on('listing_error', listing_id => {
    // Don't hold up other things waiting for it to not be an error:
    listing_projects_synced.set(listing_id, true);

    common_check();
  });
  initializeEvents.on(
    'project_update',
    (type, data_changed, meta_changed, listing, active) => {
      // Now we know we have to wait for the data/meta DB of a project
      // to, if not fully sync, then at least be created (But not if
      // *_changed == false, and no projects_sync_state triggers)
      projects_meta_synced.set(active._id, false);
      projects_data_synced.set(active._id, false);

      common_check();
    }
  );
  initializeEvents.on('project_error', (listing, active, err) => {
    console.debug('project_error info', listing, 'active', active, 'err', err);
    // Don't hold up other things waiting for it to not be an error:
    projects_meta_synced.set(active._id, true);
    projects_data_synced.set(active._id, true);

    common_check();
  });
  initializeEvents.on('meta_sync_state', (syncing, listing, active) => {
    projects_meta_synced.set(active._id, !syncing);

    common_check();
  });
  initializeEvents.on('data_sync_state', (syncing, listing, active) => {
    projects_data_synced.set(active._id, !syncing);

    common_check();
  });
}
export type MetaCompleteType = {
  [active_id in ProjectID]:
    | [ActiveDoc, ProjectObject, LocalDB<ProjectMetaObject>]
    // Error'd out metadata db
    | [ActiveDoc, unknown];
};

/*
 * Registers a handler to do automerge on new records
 */
export function register_basic_automerge_resolver(
  initializeEvents: DirectoryEmitter
) {
  initializeEvents.on('data_sync_state', (syncing, listing, active) => {
    // Only when finished syncing
    if (syncing) return;
    // The data_sync_state event is only triggered on initial page load,
    // and when the actual data DB changes: So .changes
    // (as called in start_listening_for_changes) is called once per PouchDB)
    start_listening_for_changes(active._id);
  });
}

function start_listening_for_changes(proj_id: ProjectID) {
  createdProjects[proj_id]!.data.local.changes({
    since: 'now',
    live: true,
    include_docs: true,
  }).on('change', async doc => {
    if (doc !== undefined) {
      if (doc.doc !== undefined && isRecord(doc.doc)) {
        try {
          await mergeHeads(proj_id, doc.id);
        } catch (err: any) {
          logError(err);
        }
      }
    }
  });
}
