// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: internals.test.ts
 * Description:
 *   tests for the internals module
 */

import {generateFAIMSDataID, upsertFAIMSData} from '../src/data_storage/index';
import {Record} from '../src/types';
import {
  getHRID,
  getRecord,
  getRecordListAudit,
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

    let recordId = '';
    return upsertFAIMSData({dataDb, record: doc}).then(revisionId => {
      return getRevision({dataDb, revisionId})
        .then(revision => {
          recordId = revision.record_id;
          return getRecordListAudit({
            dataDb: dataDb,
            recordIds: [revision.record_id],
          });
        })
        .then(audit => {
          expect(audit[recordId]).toBeDefined();

          // now update the record and recompute the audit
          doc.data['age'] = 11;
          return upsertFAIMSData({dataDb, record: doc}).then(revisionId => {
            return getRevision({dataDb, revisionId})
              .then(revision => {
                return getRecordListAudit({
                  dataDb: dataDb,
                  recordIds: [revision.record_id],
                });
              })
              .then(second_audit => {
                expect(second_audit[recordId]).toBeDefined();
                expect(second_audit[recordId]).not.toEqual(audit[recordId]);
              });
          });
        });
    });
  });
});
