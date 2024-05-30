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
import {Annotations, ProjectUIModel} from 'faims3-datamodel';
import {setFieldPersistentData} from '../../../local-data/field-persistent';
import {logError} from '../../../logging';

export function savefieldpersistentSetting(
  project_id: string,
  form_type: string | null,
  values: {[field_name: string]: any},
  annotations: {[field_name: string]: Annotations},
  uiSpec: ProjectUIModel
) {
  const newData: {[field_name: string]: any} = {};
  const newAnnotation: {[field_name: string]: Annotations} = {};
  if (form_type === null) return '';
  // check if the persistence value is set
  let isPersistent = false;
  for (const [name] of Object.entries(uiSpec.fields)) {
    if (uiSpec['fields'][name]['persistent']) {
      newData[name] = values[name];
      newAnnotation[name] = annotations[name];
      isPersistent = true;
    }
  }

  const newStage = {
    project_id: project_id,
    type: form_type || 'FORM1',
    data: newData,
    annotations: newAnnotation,
  };
  return isPersistent
    ? setFieldPersistentData(project_id, form_type || 'FORM1', newStage)
        .then(refs => {
          return refs;
        })
        .catch(error => logError(error))
    : '';
}
