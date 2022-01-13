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
 * Filename: databaseAccess.tsx
 * Description:
 *   This file contains accessors to data stored in PouchDB
 *
 *   If you find yourself writing pouchdb.get(), pouchdb.put(), etc.
 *   put that code in a function in this file
 *
 *   See data_storage/index.ts for accessors specific to Records
 *   In comparison, this file is for metadata, or other data
 *   (data_storage/index.ts is called from this file, as data_storage/index.ts
 *    does encoding/decoding of records)
 *
 *   TODO: Convert *everything* to listeners that can run more than once
 *   (Sync refactor)
 */

import {ProjectID} from './datamodel/core';
import {ProjectInformation, ListingInformation} from './datamodel/ui';
import {all_projects_updated, createdProjects} from './sync/state';
import {events} from './sync/events';
import {
  getProject,
  listenProject,
  waitForStateOnce,
  getAllListings,
} from './sync';

export async function getProjectList(): Promise<ProjectInformation[]> {
  /**
   * Return all active projects the user has access to, including the
   * top 30 most recently updated records.
   */
  // TODO filter by user_id
  // TODO filter by active projects
  // TODO filter data by top 30 entries, sorted by most recently updated
  // TODO decode .data
  waitForStateOnce(() => all_projects_updated);

  const output: ProjectInformation[] = [];
  for (const listing_id_project_id in createdProjects) {
    output.push({
      name: createdProjects[listing_id_project_id].project.name,
      description: createdProjects[listing_id_project_id].project.description,
      last_updated: createdProjects[listing_id_project_id].project.last_updated,
      created: createdProjects[listing_id_project_id].project.created,
      status: createdProjects[listing_id_project_id].project.status,
      project_id: listing_id_project_id,
    });
  }
  return output;
}

export function listenProjectList(
  listener: () => void,
  error: (err: any) => void
): () => void {
  events.on('project_update', listener);
  console.warn(`${error} will never be called`);
  return () => {
    // Event remover
    events.removeListener('project_update', listener);
  };
}

export async function getProjectInfo(
  project_id: ProjectID
): Promise<ProjectInformation> {
  const proj = await getProject(project_id);

  return {
    project_id: project_id,
    name: proj.project.name,
    description: proj.project.description || 'No description',
    last_updated: proj.project.last_updated || 'Unknown',
    created: proj.project.created || 'Unknown',
    status: proj.project.status || 'Unknown',
  };
}

export function listenProjectInfo(
  project_id: ProjectID,
  listener: () => unknown | Promise<void>,
  error: (err: any) => void
): () => void {
  return listenProject(
    project_id,
    (value, throw_error) => {
      const retval = listener();
      console.error('listenProjectInfo', value, throw_error, retval);
      if (typeof retval === 'object' && retval !== null && 'catch' in retval) {
        (retval as {catch: (err: unknown) => unknown}).catch(throw_error);
      }
      return 'noop';
    },
    error
  );
}

export async function getSyncableListingsInfo(): Promise<ListingInformation[]> {
  const all_listings = await getAllListings();
  const syncable_listings: ListingInformation[] = [];
  for (const listing_object of all_listings) {
    if (listing_object.local_only !== true) {
      syncable_listings.push({
        id: listing_object._id,
        name: listing_object.name,
        description: listing_object.description,
      });
    }
  }
  return syncable_listings;
}
