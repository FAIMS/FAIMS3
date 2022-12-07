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
 * Filename: fieldpersistentSetting.tsx
 * Description:
 *   This is the file is to set the values for persistent state
 */
import {set_fieldpersistentdata} from '../../../datamodel/fieldpersistent';
import {Annotations} from '../../../datamodel/core';
import {ProjectUIModel} from '../../../datamodel/ui';
import {LogError} from '../../../logging';

export function savefieldpersistentSetting(
  project_id: string,
  form_type: string | null,
  values: {[field_name: string]: any},
  annotations: {[field_name: string]: Annotations},
  uiSpec: ProjectUIModel
) {
  const newdata: {[field_name: string]: any} = {};
  const newanntation: {[field_name: string]: Annotations} = {};
  if (form_type === null) return '';
  // check if there is persisence value be set
  let ispersitence = false;
  for (const [name] of Object.entries(uiSpec.fields)) {
    if (uiSpec['fields'][name]['persistent'] !== undefined) {
      newdata[name] = values[name];
      newanntation[name] = annotations[name];
      ispersitence = true;
    }
  }

  const newstage = {
    project_id: project_id,
    type: form_type || 'FORM1',
    data: newdata,
    annotations: newanntation,
  };
  return ispersitence
    ? set_fieldpersistentdata(project_id, form_type || 'FORM1', newstage)
        .then(refs => {
          return refs;
        })
        .catch(error => logError(error))
    : '';
}
