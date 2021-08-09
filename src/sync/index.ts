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

import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
import {ProjectDataObject, ProjectMetaObject} from '../datamodel/database';
import {data_dbs, metadata_dbs} from './databases';

PouchDB.plugin(PouchDBFind);

export function getDataDB(
  active_id: string
): PouchDB.Database<ProjectDataObject> {
  if (data_dbs[active_id] !== undefined) {
    return data_dbs[active_id].local;
  } else {
    console.warn(`Failed to look up ${active_id}`);
    throw 'Projects not initialized yet';
  }
}

export function getProjectDB(
  active_id: string
): PouchDB.Database<ProjectMetaObject> {
  if (metadata_dbs[active_id] !== undefined) {
    return metadata_dbs[active_id].local;
  } else {
    console.warn(`Failed to look up ${active_id}`);
    throw 'Projects not initialized yet';
  }
}
