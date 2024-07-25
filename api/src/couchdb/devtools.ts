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
 * Filename: devtools.ts
 * Description:
 *    Tools used in development and testing of FAIMS
 */

import {
  ProjectID,
  upsertFAIMSData,
  Record,
  generateFAIMSDataID,
} from 'faims3-datamodel';
import {getNotebookUISpec} from './notebooks';
import {randomInt} from 'crypto';
import {readFileSync} from 'node:fs';

export const createManyRandomRecords = async (
  project_id: ProjectID,
  count: number
) => {
  console.log('creating', count, 'random records');
  const record_ids = [];

  for (let i = 0; i < count; i++) {
    const r_id = await createRandomRecord(project_id);
    record_ids.push(r_id);
  }
  return record_ids;
};

/**
 * Create a new record for this notebook with random data values for all fields
 * @param project_id Project id
 */
export const createRandomRecord = async (project_id: ProjectID) => {
  // get the project uiSpec
  // select one form from the notebook
  // get a list of fields and their types
  // generate data for each field
  // create the record object and call upsertFAIMSData

  const uiSpec = await getNotebookUISpec(project_id);
  if (uiSpec) {
    const forms = Object.keys(uiSpec.viewsets);
    if (forms.length === 0) {
      return;
    }
    const formName = forms[randomInt(forms.length)];
    const form = uiSpec.viewsets[formName];
    const views = form.views;
    const fields: string[] = [];
    views.map((view: string) => {
      uiSpec.fviews[view].fields.map((f: string) => fields.push(f));
    });
    // get the types of the fields
    const field_types: {[key: string]: string} = {};
    fields.map((field: string) => {
      field_types[field] =
        uiSpec.fields[field]['type-returned'] || 'faims-core::String';
    });
    const values: {[key: string]: any} = {};
    fields.map((field: string) => {
      values[field] = generateValue(uiSpec.fields[field]);
    });

    const annotations: {[key: string]: any} = {};
    fields.map((field: string) => {
      annotations[field] = {annotations: '', uncertainty: false};
    });

    const newRecord: Record = {
      record_id: generateFAIMSDataID(),
      data: values,
      type: formName,
      updated_by: 'admin',
      updated: new Date(),
      field_types: field_types,
      ugc_comment: '',
      relationship: {},
      deleted: false,
      revision_id: null,
      annotations: annotations,
    };
    const result = await upsertFAIMSData(project_id, newRecord);
    return result;
  } else {
    throw new Error(`notebook not found with id ${project_id}`);
  }
};

const SAMPLE_IMAGE_FILE = 'test/test-attachment-image.jpg';

const generateValue = (field: any) => {
  //console.log('generateValue', field);
  const fieldType = field['type-returned'];
  if (field['component-parameters'].hrid) {
    // create a nice HRID like thing
    return 'Bobalooba' + randomInt(10000).toString();
  }

  if (field['component-name'] === 'Select') {
    const options = field['component-parameters'].ElementProps.options.map(
      (o: any) => o.value
    );
    return options[randomInt(options.length)];
  }
  // TODO: use 'faker' to generate more realistic data
  switch (fieldType) {
    case 'faims-core::String':
      return 'Bobalooba';
    case 'faims-attachment::Files': {
      const image = readFileSync(SAMPLE_IMAGE_FILE);
      const buffer = Buffer.from(image);
      return [{type: 'image/jpeg', data: buffer}];
    }
    case 'faims-core::Integer':
      return randomInt(100);
    case 'faims-core::Bool':
      return randomInt(10) > 5;
    case 'faims-core::Date':
      return new Date().toISOString();
    case 'faims-pos::Location':
      return {
        type: 'Feature',
        properties: {
          timestamp: Date.now(),
          altitude: null,
          speed: null,
          heading: null,
          accuracy: 20,
          altitude_accuracy: null,
        },
        geometry: {
          type: 'Point',
          coordinates: [
            randomInt(180) + randomInt(10000) / 10000,
            randomInt(180) - 90 + randomInt(10000) / 10000,
          ],
        },
      };
    default:
      return '';
  }
};
