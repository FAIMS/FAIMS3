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
 * Filename: fieldpersistence.ts
 * Description:
 *  This is the document for saving/updating fields persistance
 *  persistence state been saved in local_state_db as local data for each device
 *  persistence state will be get when user open record or draft and filled in draft as initial value if initial value is empty
 *  if persitence state updated, all draft created after will be updated, but draft created before won't be affected
 *  persistence state will be updated when record been saved( to be discussed)
 */

import {local_state_db} from '../sync/databases';
import {ProjectID} from './core';
import {LOCAL_FIELDPERSISTENCE_PREFIX} from './database';
import {fieldpersistencedata} from './ui';

function get_pouch_id(project_id: ProjectID, form_id: string): string {
  return LOCAL_FIELDPERSISTENCE_PREFIX + '-' + project_id + '-' + form_id;
}
//function to get new persistence value to db
export async function get_fieldpersistencedata(
  project_id: ProjectID,
  form_id: string
): Promise<fieldpersistencedata> {
  const pouch_id = get_pouch_id(project_id, form_id);
  try {
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
    console.error(
      'Unable to get local increment state:',
      project_id,
      form_id,
      err
    );
    throw Error(
      `Unable to get local increment state: ${project_id} ${form_id} `
    );
  }
}
//function to save new persistence value to db
export async function set_fieldpersistencedata(
  project_id: ProjectID,
  form_id: string,
  new_state: fieldpersistencedata
) {
  const doc = await get_fieldpersistencedata(project_id, form_id);
  console.log(doc);
  doc.data = new_state.data;
  doc.annotations = new_state.annotations;
  try {
    return await local_state_db.put(doc);
  } catch (err: any) {
    console.error(err, doc);
    throw Error('Unable to set local increment state');
  }
}
