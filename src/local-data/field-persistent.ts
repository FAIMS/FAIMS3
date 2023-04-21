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
 * Filename: fieldpersistent.ts
 * Description:
 *  This is the document for saving/updating fields persistence
 *  persistent state been saved in local_state_db as local data for each device
 *  persistent state will be get when user open record or draft and filled in draft as initial value if initial value is empty
 *  if persistence state updated, all draft created after will be updated, but draft created before won't be affected
 *  persistent state will be updated when record been saved( to be discussed)
 */

import {getLocalStateDB} from '../sync/databases';
import {Annotations, FAIMSTypeName, ProjectID} from 'faims3-datamodel';
import stable_stringify from 'fast-json-stable-stringify';
import {logError} from '../logging';

const LOCAL_FIELD_PERSISTENT_PREFIX = 'local-fieldpersistent-state';

//interface for field persistent state
interface fieldPersistentData {
  _id?: string;
  project_id?: ProjectID;
  type: FAIMSTypeName;
  data: {[field_name: string]: any};
  updated?: Date;
  field_types?: {[field_name: string]: FAIMSTypeName};
  annotations: {[field_name: string]: Annotations};
  created?: Date;
}

function get_pouch_id(project_id: ProjectID, form_id: string): string {
  return LOCAL_FIELD_PERSISTENT_PREFIX + '-' + project_id + '-' + form_id;
}

// Get the persistent value from db for a field
export async function getFieldPersistentData(
  project_id: ProjectID,
  form_id: string
): Promise<fieldPersistentData> {
  const pouch_id = get_pouch_id(project_id, form_id);
  try {
    const local_state_db = getLocalStateDB();
    return await local_state_db.get(pouch_id);
  } catch (err: any) {
    if (err.status === 404) {
      const doc = {
        _id: pouch_id,
        project_id: project_id,
        type: form_id,
        data: {},
        annotations: {},
      };
      return doc;
    }
    logError(err);
    throw Error(
      `Unable to get local increment state: ${project_id} ${form_id} `
    );
  }
}

// Save a new persistent value to db
export async function setFieldPersistentData(
  project_id: ProjectID,
  form_id: string,
  new_state: fieldPersistentData
) {
  const doc = await getFieldPersistentData(project_id, form_id);
  //check if changes
  if (!checkIfUpdated(new_state, doc)) {
    return true;
  }
  doc.data = new_state.data;
  doc.annotations = new_state.annotations;
  try {
    const local_state_db = getLocalStateDB();
    return await local_state_db.put(doc);
  } catch (err: any) {
    logError(err);
    throw Error('Unable to set local increment state');
  }
}

// Check if the persistent value has been updated
const checkIfUpdated = (
  new_state: fieldPersistentData,
  old_state: fieldPersistentData
) => {
  //if the origin data empty, always save the value
  if (Object.keys(old_state.data).length === 0) return true;
  for (const [field] of Object.entries(new_state['data'])) {
    if (
      stable_stringify(old_state.data[field]) !==
      stable_stringify(new_state.data[field])
    ) {
      return true;
    }
    if (
      stable_stringify(old_state.annotations[field]) !==
      stable_stringify(new_state.annotations[field])
    ) {
      return true;
    }
  }
  return false;
};
