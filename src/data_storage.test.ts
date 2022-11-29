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
 * Filename: data_storage.test.ts
 * Description:
 *   TODO
 */

import {testProp, fc} from 'jest-fast-check';
import PouchDB from 'pouchdb';
import {ProjectID} from './datamodel/core';
import {Record} from './datamodel/ui';
import {
  deleteFAIMSDataForID,
  generateFAIMSDataID,
  getFirstRecordHead,
  getFullRecordData,
  listFAIMSProjectRevisions,
  undeleteFAIMSDataForID,
  upsertFAIMSData,
} from './data_storage';
import {equals} from './utils/eqTestSupport';

PouchDB.plugin(require('pouchdb-adapter-memory')); // enable memory adapter for testing

const projdbs: any = {};

async function mockDataDB(project_id: ProjectID) {
  if (projdbs[project_id] === undefined) {
    const db = new PouchDB(project_id, {adapter: 'memory'});
    projdbs[project_id] = db;
  }
  return projdbs[project_id];
}

async function cleanDataDBS() {
  let db;
  for (const project_id in projdbs) {
    db = projdbs[project_id];
    delete projdbs[project_id];

    if (db !== undefined) {
      try {
        await db.destroy();
        //await db.close();
      } catch (err) {
        console.error(err);
      }
    }
  }
}

function recordsEqual(
  value: Record | null,
  expected: Record | null,
  skip_revisions = true,
  ignore_dates = true
): boolean {
  if (skip_revisions) {
    if (value !== null) {
      value.revision_id = null;
    }
    if (expected !== null) {
      expected.revision_id = null;
    }
  }
  if (ignore_dates) {
    if (value !== null) {
      value.updated = new Date(0);
    }
    if (expected !== null) {
      expected.updated = new Date(0);
    }
  }
  if (equals(value, expected)) {
    return true;
  }
  console.error('expected', expected);
  console.error('received', value);
  return false;
}

jest.mock('./sync/index', () => ({
  getDataDB: mockDataDB,
}));

describe('roundtrip reading and writing to db', () => {
  testProp(
    'types roundtrip',
    [
      fc.fullUnicodeString(),
      fc.fullUnicodeString(),
      fc.fullUnicodeString(),
      fc.unicodeJsonObject(),
      fc.fullUnicodeString(),
      fc.fullUnicodeString(),
      fc.date(),
    ],
    async (project_id, namespace, name, data, field_name, userid, time) => {
      fc.pre(!namespace.includes(':'));
      fc.pre(!name.includes(':'));
      fc.pre(namespace.trim() !== '');
      fc.pre(name.trim() !== '');
      try {
        await cleanDataDBS();
      } catch (err) {
        fail('Failed to clean dbs');
      }
      fc.pre(projdbs !== {});

      const fulltype = namespace + '::' + name;

      const record_id = generateFAIMSDataID();

      const doc: Record = {
        project_id: project_id,
        record_id: record_id,
        revision_id: null,
        type: fulltype,
        data: {field_name: data},
        created_by: userid,
        updated_by: userid,
        created: time,
        updated: time,
        annotations: {},
        field_types: {field_name: fulltype},
        relationship: undefined,
        deleted: false,
      };

      return upsertFAIMSData(project_id, doc)
        .then(revision_id => {
          return getFullRecordData(project_id, record_id, revision_id);
        })
        .then(result => {
          expect(recordsEqual(result, doc)).toBe(true);
        });
    }
  );
});

describe('CRUD for data', () => {
  testProp(
    'types roundtrip',
    [
      fc.fullUnicodeString(),
      fc.fullUnicodeString(),
      fc.fullUnicodeString(),
      fc.fullUnicodeString(),
      fc.unicodeJsonObject(),
      fc.unicodeJsonObject(),
      fc.fullUnicodeString(),
      fc.date(),
    ],
    async (
      project_id,
      namespace,
      name,
      field_name,
      data,
      new_data,
      userid,
      time
    ) => {
      fc.pre(!namespace.includes(':'));
      fc.pre(!name.includes(':'));
      fc.pre(namespace.trim() !== '');
      fc.pre(name.trim() !== '');
      try {
        await cleanDataDBS();
      } catch (err) {
        fail('Failed to clean dbs');
      }
      fc.pre(projdbs !== {});

      const fulltype = namespace + '::' + name;

      const record_id = generateFAIMSDataID();

      const doc: Record = {
        project_id: project_id,
        record_id: record_id,
        revision_id: null,
        type: fulltype,
        data: {field_name: data},
        created_by: userid,
        updated_by: userid,
        created: time,
        updated: time,
        annotations: {},
        field_types: {field_name: fulltype},
        relationship: undefined,
        deleted: false,
      };

      const new_doc: Record = {
        project_id: project_id,
        record_id: record_id,
        revision_id: null,
        type: fulltype,
        data: {field_name: new_data},
        created_by: userid,
        updated_by: userid,
        created: time,
        updated: time,
        annotations: {},
        field_types: {field_name: fulltype},
        relationship: undefined,
        deleted: false,
      };

      return upsertFAIMSData(project_id, doc)
        .then(revision_id => {
          return getFullRecordData(project_id, record_id, revision_id);
        })
        .then(result => {
          expect(recordsEqual(result, doc)).toBe(true);
        })
        .then(() => {
          return getFirstRecordHead(project_id, record_id);
        })
        .then(revision_id => {
          return getFullRecordData(project_id, record_id, revision_id);
        })
        .then(result => {
          if (result === null) {
            throw Error('something deleted the old revision...');
          }
          result.data = {field_name: new_data};
          return upsertFAIMSData(project_id, result);
        })
        .then(revision_id => {
          return getFullRecordData(project_id, record_id, revision_id);
        })
        .then(result => {
          expect(recordsEqual(result, new_doc)).toBe(true);
        })
        .then(_result => {
          return deleteFAIMSDataForID(project_id, record_id, userid);
        })
        .then(revision_id => {
          return getFullRecordData(project_id, record_id, revision_id);
        })
        .then(result => {
          expect(result).toBe(null);
        })
        .then(_result => {
          return undeleteFAIMSDataForID(project_id, record_id, userid);
        })
        .then(revision_id => {
          return getFullRecordData(project_id, record_id, revision_id);
        })
        .then(result => {
          expect(recordsEqual(result, new_doc)).toBe(true);
        });
    }
  );
});

describe('listing revisions', () => {
  testProp(
    'listing revisions',
    [
      fc.fullUnicodeString(),
      fc.fullUnicodeString(),
      fc.fullUnicodeString(),
      fc.unicodeJsonObject(),
      fc.fullUnicodeString(),
      fc.fullUnicodeString(),
      fc.date(),
    ],
    async (project_id, namespace, name, data, field_name, userid, time) => {
      fc.pre(!namespace.includes(':'));
      fc.pre(!name.includes(':'));
      fc.pre(namespace.trim() !== '');
      fc.pre(name.trim() !== '');
      try {
        await cleanDataDBS();
      } catch (err) {
        fail('Failed to clean dbs');
      }
      fc.pre(projdbs !== {});

      const fulltype = namespace + '::' + name;

      const record_id = generateFAIMSDataID();

      const doc: Record = {
        project_id: project_id,
        record_id: record_id,
        revision_id: null,
        type: fulltype,
        data: {field_name: data},
        created_by: userid,
        updated_by: userid,
        created: time,
        updated: time,
        annotations: {},
        field_types: {field_name: fulltype},
        relationship: undefined,
        deleted: false,
      };

      return upsertFAIMSData(project_id, doc)
        .then(_result => {
          return listFAIMSProjectRevisions(project_id);
        })
        .then(result => {
          expect(result[record_id]).not.toBe(undefined);
          expect(result[record_id]).toHaveLength(1);
          expect(result[record_id][0]).toEqual(
            // TODO: Work out regex for revision ids
            expect.stringMatching(/^.*/)
          );
        });
    }
  );
});
