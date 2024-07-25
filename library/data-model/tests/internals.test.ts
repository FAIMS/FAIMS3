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
 * Filename: internals.test.ts
 * Description:
 *   tests for the internals module
 *
 */

import {registerClient} from '../src';

import {HRID_STRING} from '../src/datamodel/core';
import {Record} from '../src/types';
import {generateFAIMSDataID, upsertFAIMSData} from '../src/data_storage/index';

import {getHRID, getRecord, getRevision} from '../src/data_storage/internals';
import {callbackObject, cleanDataDBS} from './mocks';

// register our mock database clients with the module
registerClient(callbackObject);

beforeEach(async () => {
  return await cleanDataDBS();
});

afterAll(async () => {
  return await cleanDataDBS();
});

describe('test internals', () => {
  test('test getHRID', async () => {
    const project_id = 'test';
    const fulltype = 'test::test';
    const time = new Date();
    const user_id = 'user';

    const record_id = generateFAIMSDataID();

    // record with an hrid field - one starting with HRID_STRING
    const doc: Record = {
      project_id: project_id,
      record_id: record_id,
      revision_id: null,
      type: fulltype,
      data: {avp1: 1},
      created_by: user_id,
      updated_by: user_id,
      created: time,
      updated: time,
      annotations: {
        avp1: 1,
      },
      field_types: {field_name: fulltype},
    };

    const hridField = HRID_STRING + 'FieldName';
    const hridValue = 'test HRID value';
    doc.data[hridField] = hridValue;
    doc.annotations[hridField] = 'annotation for HRID';

    return upsertFAIMSData(project_id, doc).then(revisionId => {
      return getRevision(project_id, revisionId)
        .then(revision => {
          return getHRID(project_id, revision);
        })
        .then(hrid => {
          expect(hrid).toBe(hridValue);
        });
    });
  });

  test('test getRecord - undefined', () => {
    expect(() => getRecord('test', 'unknownId')).rejects.toThrow(
      /no such record/
    );
  });
});
