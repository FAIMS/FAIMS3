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

import {generateFAIMSDataID, upsertFAIMSData} from '../src/data_storage/index';
import {Record} from '../src/types';
import {
  getHRID,
  getRecord,
  getRecordAudit,
  getRevision,
} from '../src/data_storage/internals';
import {callbackObject, cleanDataDBS, sampleUiSpecForViewId} from './mocks';
import {getDataDB, registerClient} from '../src';

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
    const hridField = 'name';
    const uiSpec = sampleUiSpecForViewId({
      viewId: 'test',
      hridFieldId: hridField,
    });

    const record_id = generateFAIMSDataID();

    // record with an hrid field - one starting with HRID_STRING
    const doc: Record = {
      project_id: project_id,
      record_id: record_id,
      revision_id: null,
      type: fulltype,
      data: {},
      created_by: user_id,
      updated_by: user_id,
      created: time,
      updated: time,
      annotations: {},
      field_types: {field_name: fulltype},
    };

    // Need a UI spec which suits this
    const hridValue = 'test HRID value';
    doc.data[hridField] = hridValue;
    doc.data['age'] = 10;
    doc.annotations[hridField] = {
      annotation: 'annotation for HRID field',
      uncertainty: false,
    };

    const dataDb = await getDataDB(project_id);

    return upsertFAIMSData({dataDb, record: doc}).then(revisionId => {
      return getRevision({dataDb, revisionId})
        .then(revision => {
          return getHRID({dataDb, revision, uiSpecification: uiSpec});
        })
        .then(hrid => {
          expect(hrid).toBe(hridValue);
        });
    });
  });

  test('test getRecord - undefined', () => {
    expect(async () =>
      getRecord({dataDb: await getDataDB('test'), recordId: 'unknownId'})
    ).rejects.toThrow(/no such record/);
  });

  test('test getRecordAudit', async () => {
    const project_id = 'test';
    const fullType = 'test::test';
    const time = new Date();
    const user_id = 'user';
    const hridField = 'name';

    const record_id = generateFAIMSDataID();

    // record with an hrid field - one starting with HRID_STRING
    const doc: Record = {
      project_id: project_id,
      record_id: record_id,
      revision_id: null,
      type: fullType,
      data: {},
      created_by: user_id,
      updated_by: user_id,
      created: time,
      updated: time,
      annotations: {},
      field_types: {field_name: fullType},
    };

    // Need a UI spec which suits this
    const hridValue = 'test HRID value';
    doc.data[hridField] = hridValue;
    doc.data['age'] = 10;
    doc.annotations[hridField] = {
      annotation: 'annotation for HRID field',
      uncertainty: false,
    };

    const dataDb = await getDataDB(project_id);

    return upsertFAIMSData({dataDb, record: doc}).then(revisionId => {
      return getRevision({dataDb, revisionId})
        .then(revision => {
          return getRecordAudit({
            dataDb: dataDb,
            recordId: revision.record_id,
          });
        })
        .then(audit => {
          expect(audit.length).toBeGreaterThan(1);

          // now update the record and recompute the audit
          doc.data['age'] = 11;
          return upsertFAIMSData({dataDb, record: doc}).then(revisionId => {
            return getRevision({dataDb, revisionId})
              .then(revision => {
                return getRecordAudit({
                  dataDb: dataDb,
                  recordId: revision.record_id,
                });
              })
              .then(second_audit => {
                expect(second_audit.length).toBeGreaterThan(1);
                expect(second_audit).not.toEqual(audit);
              });
          });
        });
    });
  });
});
