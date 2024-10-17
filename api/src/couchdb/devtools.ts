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
  getDataDB,
} from '@faims3/data-model';
import {getNotebookUISpec} from './notebooks';
import {randomInt} from 'crypto';
import {readFileSync} from 'node:fs';
import * as Exceptions from '../exceptions';

export const createManyRandomRecords = async (
  project_id: ProjectID,
  count: number
): Promise<string[]> => {
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
export const createRandomRecord = async (
  project_id: ProjectID
): Promise<string> => {
  // get the project uiSpec
  // select one form from the notebook
  // get a list of fields and their types
  // generate data for each field
  // create the record object and call upsertFAIMSData

  const uiSpec = await getNotebookUISpec(project_id);
  if (!uiSpec) {
    throw new Exceptions.ItemNotFoundException(
      `Notebook not found with id ${project_id}`
    );
  }

  const forms = Object.keys(uiSpec.viewsets);
  if (forms.length === 0) {
    throw new Exceptions.InvalidRequestException(
      `The ui spec for project with id ${project_id} has no forms in the viewsets.`
    );
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

/**
 * Validate the documents in a project database at a low level to spot
 * any missing or incomplete records
 *
 * @param project_id Project id
 * @returns {errors: string[]} an array of error strings if any found
 */
export const validateProjectDatabase = async (project_id: ProjectID) => {
  const dataDB = await getDataDB(project_id);

  // get all record documents
  // check that all revision documents (frev) are present
  // for each revision
  // check that every mentioned avp document is present

  const errors: string[] = [];
  const records = await dataDB.find({selector: {record_format_version: 1}});

  if (records) {
    for (let i = 0; i < records.docs.length; i++) {
      const doc = records.docs[i];
      for (let j = 0; j < doc.revisions.length; j++) {
        const rev = doc.revisions[j];
        try {
          const rev_doc = await dataDB.get(rev);
          const avps = Object.values(rev_doc.avps);
          for (let k = 0; k < avps.length; k++) {
            try {
              const avp_doc = await dataDB.get(avps[k]);
              // check for any attachments
              if (avp_doc.faims_attachments) {
                for (let l = 0; l < avp_doc.faims_attachments.length; l++) {
                  const att = avp_doc.faims_attachments[l];
                  try {
                    await dataDB.get(att.attachment_id);
                  } catch {
                    errors.push(
                      `missing attachment ${att.attachment_id} on ${avps[k]} in ${rev} of ${doc._id}`
                    );
                  }
                }
              }
            } catch {
              errors.push(
                `missing avp document ${avps[k]} in ${rev} of ${doc._id}`
              );
            }
          }
        } catch {
          errors.push(`missing revision document ${rev} in ${doc._id}`);
        }
      }
    }
  }
  return {errors: errors};
};
