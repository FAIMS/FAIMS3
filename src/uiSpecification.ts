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
 * Filename: uiSpecification.ts
 * Description:
 *   TODO
 */

import {getProjectDB} from './sync';
import PouchDB from 'pouchdb';
import {ProjectID} from './datamodel/core';
import {
  ProjectMetaObject,
  UI_SPECIFICATION_NAME,
  EncodedProjectUIModel,
} from './datamodel/database';
import {ProjectUIModel} from './datamodel/ui';

export async function getUiSpecForProject(
  project_id: ProjectID
): Promise<ProjectUIModel> {
  const projdb = getProjectDB(project_id);
  try {
    const encUIInfo: EncodedProjectUIModel = await projdb.get(
      UI_SPECIFICATION_NAME
    );
    return {
      _id: encUIInfo._id,
      _rev: encUIInfo._rev,
      fields: encUIInfo.fields,
      views: encUIInfo.fviews,
      start_view: encUIInfo.start_view,
    };
  } catch (err) {
    console.warn(err);
    throw Error('failed to find ui specification');
  }
}

export async function setUiSpecForProject(
  projdb: PouchDB.Database<ProjectMetaObject>,
  uiInfo: ProjectUIModel
) {
  const encUIInfo: EncodedProjectUIModel = {
    _id: UI_SPECIFICATION_NAME,
    fields: uiInfo.fields,
    fviews: uiInfo.views,
    start_view: uiInfo.start_view,
  };
  try {
    const existing_encUIInfo = await projdb.get(encUIInfo._id);
    encUIInfo._rev = existing_encUIInfo._rev;
  } catch (err) {
    // Probably no existing UI info
  }

  try {
    return await projdb.put(encUIInfo);
  } catch (err) {
    console.warn(err);
    throw Error('failed to set ui specification');
  }
}
