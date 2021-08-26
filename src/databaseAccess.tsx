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

/* eslint-disable @typescript-eslint/no-unused-vars */
import {ActiveDoc, ListingsObject} from './datamodel/database';
import {ProjectID} from './datamodel/core';
import {listRecordMetadata} from './data_storage/internals';
import {
  ProjectInformation,
  RecordList,
  RecordMetadataList,
} from './datamodel/ui';
import {createdProjects, createdProjectsInterface} from './sync/state';
import {DBTracker} from './gui/pouchHook';

export function getProjectList(): ProjectInformation[] {
  /**
   * Return all active projects the user has access to, including the
   * top 30 most recently updated records.
   */
  // TODO filter by user_id
  // TODO filter by active projects
  // TODO filter data by top 30 entries, sorted by most recently updated
  // TODO decode .data
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

export const projectListTracker = new DBTracker<
  [/*string user_id */],
  ProjectInformation[]
>(getProjectList, ['projects_known', getProjectList]);

export function getProjectInfo(
  project_id: ProjectID
): ProjectInformation | null {
  const proj = createdProjects[project_id];
  if (proj === undefined) {
    return null;
  }

  return {
    project_id: project_id,
    name: proj.project.name,
    description: proj.project.description || 'No description',
    last_updated: proj.project.last_updated || 'Unknown',
    created: proj.project.created || 'Unknown',
    status: proj.project.status || 'Unknown',
  };
}

export function getProject(project_id: ProjectID): createdProjectsInterface {
  /**
   * Return entire project object (project, active, meta, data).
   */
  return createdProjects[project_id];
}

export const recordListTracker = new DBTracker<
  [string /*project_id*/],
  RecordMetadataList
>([
  'project_data_paused',
  listRecordMetadata,
  (listing: ListingsObject, active: ActiveDoc) => [[active._id] as [string]],
]);

//export function updateProject(project_id: ProjectID) {}

//export function removeProject(project_id: ProjectID) {}
