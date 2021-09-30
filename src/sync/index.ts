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
 * Filename: index.ts
 * Description:
 *   TODO
 */

import {events} from './events';
import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
import {ProjectID} from '../datamodel/core';
import {ProjectDataObject, ProjectMetaObject} from '../datamodel/database';
import {data_dbs, metadata_dbs} from './databases';
import {all_projects_updated} from './state';

PouchDB.plugin(PouchDBFind);

export async function getDataDB(
  active_id: ProjectID
): Promise<PouchDB.Database<ProjectDataObject>> {
  if (!all_projects_updated) {
    // Wait for all_projects_updated to possibly change before re-polling
    // all_projects_updated and returning error/data DB if it's ready.
    return new Promise((resolve, reject) => {
      const listener = () => {
        getDataDB(active_id).then(resolve, reject);
        events.removeListener('all_state', listener);
      };
      events.addListener('all_state', listener);
    });
  } else {
    if (active_id in data_dbs) {
      return data_dbs[active_id].local;
    } else {
      throw `Project ${active_id} is not known`;
    }
  }
}

export async function getProjectDB(
  active_id: ProjectID
): Promise<PouchDB.Database<ProjectMetaObject>> {
  if (!all_projects_updated) {
    // Wait for all_projects_updated to possibly change before re-polling
    // all_projects_updated and returning error/data DB if it's ready.
    return new Promise((resolve, reject) => {
      const listener = () => {
        getDataDB(active_id).then(resolve, reject);
        events.removeListener('all_state', listener);
      };
      events.addListener('all_state', listener);
    });
  } else {
    if (active_id in metadata_dbs) {
      return metadata_dbs[active_id].local;
    } else {
      throw `Project ${active_id} is not known`;
    }
  }
}
