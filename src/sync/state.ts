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
 * Filename: state.ts
 * Description:
 *   TODO
 */

import {NonUniqueProjectID, ProjectID} from '../datamodel/core';
import {
  ProjectObject,
  ProjectMetaObject,
  ProjectDataObject,
  ActiveDoc,
  isRecord,
} from '../datamodel/database';
import {ExistingActiveDoc, LocalDB} from './databases';
import {add_initial_listener} from './event-handler-registration';
import {DirectoryEmitter} from './events';

add_initial_listener(register_listings_known, 'listings_known');
add_initial_listener(register_projects_known, 'projects_known');

export let listings_known = false;
export let listings: null | Set<string> = null;
function register_listings_known(initializeEvents: DirectoryEmitter) {
  initializeEvents.on('directory_paused', known_listings => {
    listings_known = true;
    listings = known_listings;
    initializeEvents.emit('listings_known', known_listings);
  });
  initializeEvents.on('directory_active', () => {
    // Wait for all listings to be re-synced before any 'completion events' trigger
    listings_known = false;
  });
}

/**
 * Once all projects are reasonably 'known' (i.e. the directory has errored/paused AND
 * all listings have errored/paused), this is set to the set of known project active ids
 *
 * This is set to just before 'projects_known' event is emitted.
 */
export let projects_known: null | Set<ProjectID> = null;
/**
 * Adds event handlers to initializeEvents to:
 * Enable 'Propagation' of completion of all known projects meta & other databases.
 * Completion, here, means that the meta database has errored/paused syncing.
 *
 * Resulting from this function, initializeEvents adds the following behaviour:
 * Once all projects are reasonably 'known' (i.e. the directory has errored/paused AND
 * all listings have errored/paused), a 'projects_known' event is emitted
 *
 * Note: All of these events may emit more than once. Use .once('event_name', ...)
 * to only listen for the first trigger.
 */
function register_projects_known(initializeEvents: DirectoryEmitter) {
  // This is more complicated, as we have to first ensure that it's in a reasonable state to say
  // that everything is known & created, before waiting for project meta downloads.
  // (So that we don't accidentally trigger things if local DBs are empty but waiting)
  // Mapping from listing_id: (boolean) if the listing has had its projects added to known_projects yet
  const listing_statuses = new Map<string, boolean>();
  const listing_statuses_complete = () =>
    listings_known && Array.from(listing_statuses.values()).every(v => v);

  // All projects accumulated here
  const projects_known_acc = new Set<ProjectID>();

  // Emits project_known if all listings have their projects added to known_projects.
  const emit_if_complete = () => {
    if (listing_statuses_complete()) {
      projects_known = projects_known_acc;
      initializeEvents.emit('projects_known', projects_known_acc);
    }
  };

  initializeEvents.on('directory_paused', listings => {
    // Make sure listing_statuses has the key for listing
    // If it's already set to true, don't set it to false
    listings.forEach(listing =>
      listing_statuses.set(listing, listing_statuses.get(listing) || false)
    );
    for (const listing_id of Array.from(listing_statuses.keys())) {
      if (!listings.has(listing_id)) listing_statuses.delete(listing_id);
    }

    emit_if_complete();
  });

  initializeEvents.on('listing_paused', (listing, active_projects) => {
    active_projects.forEach(active => projects_known_acc.add(active._id));
    listing_statuses.set(listing._id, true);

    emit_if_complete();
  });
  initializeEvents.on('listing_error', listing_id => {
    // Don't hold up other things waiting for it to not be an error:
    listing_statuses.set(listing_id, true);

    emit_if_complete();
  });
  initializeEvents.on('listing_active', listing => {
    // Wait for listing to sync before everything is known.
    listing_statuses.set(listing._id, false);
  });
}

/**
 * This is appended to whenever a project has its
 * meta & data local dbs come into existance.
 *
 * This is essentially accumulating 'project_paused' events.
 */
export type createdProjectsInterface = {
  project: ProjectObject;
  active: ExistingActiveDoc;
  meta: LocalDB<ProjectMetaObject>;
  data: LocalDB<ProjectDataObject>;
};

export const createdProjects: {
  [key: string]: {
    project: ProjectObject;
    active: ExistingActiveDoc;
    meta: LocalDB<ProjectMetaObject>;
    data: LocalDB<ProjectDataObject>;
  };
} = {};

export let projects_created = false;

add_initial_listener(register_metas_complete);

function register_projects_created(initializeEvents: DirectoryEmitter) {
  const project_statuses = new Map<string, boolean>();

  const emit_if_complete = () => {
    if (projects_known && Array.from(project_statuses.values()).every(v => v)) {
      projects_created = true;
      initializeEvents.emit('projects_created');
    }
  };

  initializeEvents.on('project_local', (listing, active) => {
    project_statuses.set(active._id, true);
    emit_if_complete();
  });

  initializeEvents.on('projects_known', projects => {
    projects.forEach(project_id => {
      if (!project_statuses.has(project_id)) {
        // Add a project that hasn't triggered its project_local yet
        project_statuses.set(project_id, false);
      }
    });
    emit_if_complete();
  });
}

add_initial_listener(register_projects_created);

export type MetasCompleteType = {
  [active_id in ProjectID]:
    | [ActiveDoc, ProjectObject, LocalDB<ProjectMetaObject>]
    // Error'd out metadata db
    | [ActiveDoc, unknown];
};

/**
 * When all known projects have their project_meta_paused event triggered,
 * and when all projects are known (see register_projects_known)
 * This is filled with metadata dbs of all known projects
 */
export let metas_complete: null | MetasCompleteType = null;
/**
 * When all known projects have their project_meta_paused event triggered,
 * and when all projects are known (see register_projects_known)
 * metas_complete event is triggered with list of all projects.
 */
function register_metas_complete(initializeEvents: DirectoryEmitter) {
  const map_has_all_known_projects = (map_obj: {[key: string]: unknown}) =>
    projects_known !== null &&
    Array.from(projects_known.values()).every(v => v in map_obj);

  // The following events essentially only trigger (possibly multiple times) once
  // projects_known is true, AND once all project_meta_pauseds have been triggered.
  const metas: MetasCompleteType = {};

  const emit_if_metas_complete = () => {
    if (map_has_all_known_projects(metas)) {
      metas_complete = metas;
      initializeEvents.emit('metas_complete', metas);
    }
  };

  initializeEvents.on(
    'project_meta_paused',
    (listing, active, project, meta) => {
      metas[active._id] = [active, project, meta];
      emit_if_metas_complete();
    }
  );
  initializeEvents.on('project_error', (listing, active, err) => {
    metas[active._id] = [active, err];
    emit_if_metas_complete();
  });
  initializeEvents.on('projects_known', () => {
    emit_if_metas_complete();
  });
}