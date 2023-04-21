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
 *   See faims3-datamodel for accessors specific to Records
 *   In comparison, this file is for metadata, or other data
 *   (faims3-datamodel is called from this file, as faims3-datamodel
 *    does encoding/decoding of records)
 *
 *   TODO: Convert *everything* to listeners that can run more than once
 *   (Sync refactor)
 */

import {DEBUG_APP} from './buildconfig';
import {
  ProjectID,
  ListingID,
  split_full_project_id,
  resolve_project_id,
} from 'faims3-datamodel';
import {ProjectObject} from 'faims3-datamodel';
import {ProjectInformation, ListingInformation} from 'faims3-datamodel';
import {
  all_projects_updated,
  createdProjects,
  createdListings,
} from './sync/state';
import {events} from './sync/events';
import {
  getProject,
  listenProject,
  waitForStateOnce,
  getAllListings,
} from './sync';
import {shouldDisplayProject} from './users';

export async function getActiveProjectList(): Promise<ProjectInformation[]> {
  /**
   * Return all active projects the user has access to, including the
   * top 30 most recently updated records.
   */
  // TODO filter by user_id
  // TODO filter by active projects
  // TODO filter data by top 30 entries, sorted by most recently updated
  // TODO decode .data
  await waitForStateOnce(() => all_projects_updated);

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
  return output;
}

async function getAvailableProjectsFromListing(
  listing_id: ListingID
): Promise<ProjectInformation[]> {
  const output: ProjectInformation[] = [];
  const projects: ProjectObject[] = [];
  const projects_db = createdListings[listing_id].projects.local;
  const res = await projects_db.allDocs({
    include_docs: true,
  });
  res.rows.forEach(e => {
    if (e.doc !== undefined && !e.id.startsWith('_')) {
      projects.push(e.doc as ProjectObject);
    }
  });
  console.debug('All projects in listing', listing_id, projects);
  for (const project of projects) {
    const project_id = project._id;
    const full_project_id = resolve_project_id(listing_id, project_id);
    if (await shouldDisplayProject(full_project_id)) {
      output.push({
        name: project.name,
        description: project.description,
        last_updated: project.last_updated,
        created: project.created,
        status: project.status,
        project_id: full_project_id,
        is_activated: createdProjects[full_project_id] !== undefined,
        listing_id: listing_id,
        non_unique_project_id: project_id,
      });
    }
  }
  return output;
}

export async function getAllProjectList(): Promise<ProjectInformation[]> {
  /**
   * Return all projects the user has access to.
   */
  await waitForStateOnce(() => all_projects_updated);

  const output: ProjectInformation[] = [];
  for (const listing_id in createdListings) {
    const projects = await getAvailableProjectsFromListing(listing_id);
    for (const proj of projects) {
      output.push(proj);
    }
  }
  console.debug('All project list output', output);
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

  const split_id = split_full_project_id(project_id);
  return {
    project_id: project_id,
    name: proj.project.name,
    description: proj.project.description || 'No description',
    last_updated: proj.project.last_updated || 'Unknown',
    created: proj.project.created || 'Unknown',
    status: proj.project.status || 'Unknown',
    is_activated: true,
    listing_id: split_id.listing_id,
    non_unique_project_id: split_id.project_id,
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
      if (DEBUG_APP) {
        console.log('listenProjectInfo', value, throw_error, retval);
      }
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
    if (listing_object.local_only === true) {
      console.debug('Skipping as local only', listing_object._id);
      continue;
    }
    if (
      listing_object.conductor_url === null ||
      listing_object.conductor_url === undefined
    ) {
      console.debug('Skipping as missing conductor url', listing_object._id);
      continue;
    }
    syncable_listings.push({
      id: listing_object._id,
      name: listing_object.name,
      description: listing_object.description,
      conductor_url: listing_object.conductor_url,
    });
  }
  return syncable_listings;
}
