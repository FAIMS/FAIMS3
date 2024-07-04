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
 *   TODO
 */

import PouchDB from 'pouchdb-browser';
import EventEmitter from 'events';
import {ProjectObject, ProjectMetaObject} from 'faims3-datamodel';
import {ProjectID} from 'faims3-datamodel';

export type ProjectMetaList = {
  [active_id in ProjectID]: [
    ProjectObject,
    PouchDB.Database<ProjectMetaObject>
  ];
};

export const state = {
  stabilized: false,
  project_meta_list: {} as ProjectMetaList,
};

export const events: StatefulEvents = new EventEmitter();
export interface StatefulEvents extends EventEmitter {
  /**
   * This event is emitted when the directory & all listings stop syncing
   * So a good way to tell
   * @param event project_meta_stabilize
   * @param listener Called with all currently known projects
   */
  on(
    event: 'project_meta_stabilize',
    listener: (project_meta_list: ProjectMetaList) => unknown
  ): this;
  on(
    event: 'project_meta_update',
    listener: (
      project_meta_list: ProjectMetaList,
      added: ProjectMetaList,
      removed: string[]
    ) => unknown
  ): this;
}
