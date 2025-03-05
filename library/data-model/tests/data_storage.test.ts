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
 *   Tests of the data storage API
 */

import {fc, test} from '@fast-check/jest';
import {getDataDB, registerClient} from '../src';
import {
  deleteFAIMSDataForID,
  generateFAIMSDataID,
  getFirstRecordHead,
  getFullRecordData,
  listFAIMSProjectRevisions,
  notebookRecordIterator,
  undeleteFAIMSDataForID,
  upsertFAIMSData,
} from '../src/data_storage';
import {listRecordMetadata} from '../src/data_storage/internals';
import {getAllRecordsWithRegex} from '../src/data_storage/queries';
import {Record, RecordMetadata} from '../src/types';
import {equals} from './eqTestSupport';
import {
  callbackObject,
  cleanDataDBS,
  createNRecords,
  createRecord,
} from './mocks';

// register our mock database clients with the module
registerClient(callbackObject);

// disable debug output for tests
console.debug = () => {};

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

describe('round-trip reading and writing to db', () => {
  test.prop([
    fc.fullUnicodeString(), // project_id
    fc.fullUnicodeString(), // namespace
    fc.fullUnicodeString(), // name
    fc.unicodeJson(), // data
    fc.fullUnicodeString(), // userID
    fc.date(), // time
  ])(
    'types round-trip',
    async (project_id, namespace, name, data, userID, time) => {
      fc.pre(!namespace.includes(':'));
      fc.pre(!name.includes(':'));
      fc.pre(namespace.trim() !== '');
      fc.pre(name.trim() !== '');
      try {
        await cleanDataDBS();
      } catch (err) {
        fail('Failed to clean dbs');
      }

      const fullType = namespace + '::' + name;

      const record_id = generateFAIMSDataID();

      const doc: Record = {
        project_id: project_id,
        record_id: record_id,
        revision_id: null,
        type: fullType,
        data: {field_name: data},
        created_by: userID,
        updated_by: userID,
        created: time,
        updated: time,
        annotations: {},
        field_types: {field_name: fullType},
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

test('updating an existing record with extended data', async () => {
  try {
    await cleanDataDBS();
  } catch (err) {
    fail('Failed to clean dbs');
  }

  const project_id = 'test';
  const record_id = generateFAIMSDataID();
  const fullType = 'test::test';
  const data = {
    name: 'Bob Bobalooba',
    age: 42,
  };
  const fieldTypes = {
    name: 'faims::string',
    age: 'faims::integer',
  };
  const new_data = {
    name: 'Bob Bobalooba',
    age: 54,
    occupation: 'Software Engineer',
  };
  const new_field_types = {
    name: 'faims::string',
    age: 'faims::integer',
    occupation: 'faims::string',
  };
  const userID = 'user';
  const time = new Date();

  const doc: Record = {
    project_id: project_id,
    record_id: record_id,
    revision_id: null,
    type: fullType,
    data: data,
    created_by: userID,
    updated_by: userID,
    created: time,
    updated: time,
    annotations: {},
    field_types: fieldTypes,
    relationship: undefined,
    deleted: false,
  };

  return upsertFAIMSData(project_id, doc)
    .then(revision_id => {
      return getFullRecordData(project_id, record_id, revision_id);
    })
    .then(result => {
      if (result) {
        expect(result.data).toEqual(data);
        // now we change the data and update
        result.data = new_data;
        result.field_types = new_field_types;
        return upsertFAIMSData(project_id, result)
          .then(new_revision_id => {
            return getFullRecordData(project_id, record_id, new_revision_id);
          })
          .then(result => {
            if (result) {
              expect(result.data).toEqual(new_data);
            } else {
              fail('Failed to get record');
            }
          });
      } else {
        fail('Failed to get record');
      }
    });
});

describe('CRUD for data', () => {
  test.prop([
    fc.fullUnicodeString(), // project_id
    fc.fullUnicodeString(), // namespace
    fc.fullUnicodeString(), // name
    fc.unicodeJson(), // data
    fc.unicodeJson(), // new_data
    fc.fullUnicodeString(), // userid
    fc.date(), // time
  ])(
    'types round-trip',
    async (project_id, namespace, name, data, new_data, userID, time) => {
      fc.pre(!namespace.includes(':'));
      fc.pre(!name.includes(':'));
      fc.pre(namespace.trim() !== '');
      fc.pre(name.trim() !== '');
      try {
        await cleanDataDBS();
      } catch (err) {
        fail('Failed to clean dbs');
      }

      const fullType = namespace + '::' + name;

      const record_id = generateFAIMSDataID();

      const doc: Record = {
        project_id: project_id,
        record_id: record_id,
        revision_id: null,
        type: fullType,
        data: {field_name: data},
        created_by: userID,
        updated_by: userID,
        created: time,
        updated: time,
        annotations: {},
        field_types: {field_name: fullType},
        relationship: undefined,
        deleted: false,
      };

      // new_doc is the same with updated data
      const new_doc = {...doc, data: {field_name: new_data}};

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
          // modify a property in the record data and update
          result.data = new_doc.data;
          return upsertFAIMSData(project_id, result);
        })
        .then(revision_id => {
          return getFullRecordData(project_id, record_id, revision_id);
        })
        .then(result => {
          // result should be the same as new_doc
          expect(recordsEqual(result, new_doc)).toBe(true);
        })
        .then(_result => {
          // test deleting, it should go away and then we bring it back again
          return deleteFAIMSDataForID(project_id, record_id, userID);
        })
        .then(revision_id => {
          return getFullRecordData(project_id, record_id, revision_id);
        })
        .then(result => {
          // it's gone!
          expect(result).toBe(null);
        })
        .then(_result => {
          return undeleteFAIMSDataForID(project_id, record_id, userID);
        })
        .then(revision_id => {
          return getFullRecordData(project_id, record_id, revision_id);
        })
        .then(result => {
          // and it's back!
          expect(recordsEqual(result, new_doc)).toBe(true);
        });
    }
  );
});

describe('listing revisions', () => {
  test.prop([
    fc.fullUnicodeString(), // project_id
    fc.fullUnicodeString(), // namespace
    fc.fullUnicodeString(), // name
    fc.unicodeJson(), // data
  ])('listing revisions', async (project_id, namespace, name, data) => {
    fc.pre(!namespace.includes(':'));
    fc.pre(!name.includes(':'));
    fc.pre(namespace.trim() !== '');
    fc.pre(name.trim() !== '');
    try {
      await cleanDataDBS();
    } catch (err) {
      fail('Failed to clean dbs');
    }

    const fullType = namespace + '::' + name;

    let record_id: string;
    createRecord(project_id, fullType, {name: data, age: 42})
      .then(result => {
        record_id = result;
        return listFAIMSProjectRevisions(project_id);
      })
      .then(result => {
        expect(result[record_id]).not.toBe(undefined);
        expect(result[record_id]).toHaveLength(1);
        expect(result[record_id][0]).toEqual(expect.stringMatching(/^frev-.*/));
      });
  });
});

describe('record iterator', () => {
  test('iterator', async () => {
    const viewID = 'Test';

    // test below, at and above the batch size of the iterator
    const sizes = [0, 50, 100, 220, 550];
    for (let i = 0; i < sizes.length; i++) {
      const n = sizes[i];
      await cleanDataDBS();

      const project_id = 'test' + n;
      const uiSpec = await createNRecords(project_id, viewID, n);

      const iterator = await notebookRecordIterator(
        project_id,
        viewID,
        undefined,
        uiSpec
      );

      let {record, done} = await iterator.next();
      let sumOfAges = 0;
      while (record && !done) {
        expect(record.data.name.startsWith('Bob')).toBe(true);
        sumOfAges += record.data.age;
        const next = await iterator.next();
        record = next.record;
        done = next.done;
      }
      // expect the sum of the first n integers from 0 to n-1
      expect(sumOfAges).toBe(Math.abs((n * (n - 1)) / 2));
    }
  }, 10000);
});

describe('record retrieval', () => {
  test('get records with regex', async () => {
    const viewID = 'Test';
    const project_id = 'test';

    await cleanDataDBS();
    const uiSpec = await createNRecords(project_id, viewID, 10);

    const db = await getDataDB(project_id);
    if (db) {
      // use the underlying get all records rather than the token filtered version for now
      const records = Object.values(
        await getAllRecordsWithRegex(project_id, '.*', uiSpec)
      );
      expect(records.length).toBe(10);
      // check a few properties
      expect(records[0].created_by).toBe('user');
      expect(records[0].type).toBe('Test');
    } else {
      fail('Failed to get database');
    }
  });

  test('get all record metadata', async () => {
    const viewID = 'Test';
    const project_id = 'test';

    await cleanDataDBS();
    const uiSpec = await createNRecords(project_id, viewID, 10);

    const db = await getDataDB(project_id);
    if (db) {
      const records = Object.values(
        await listRecordMetadata({
          project_id,
          record_ids: null,
          uiSpecification: uiSpec,
        })
      );
      expect(records.length).toBe(10);
      // // check a few properties
      expect(records[0].created_by).toBe('user');
      expect(records[0].type).toBe('Test');
    } else {
      fail('Failed to get database');
    }
  }, 10000);

  test('get some record metadata', async () => {
    const viewID = 'Test';
    const project_id = 'test';

    await cleanDataDBS();
    const uiSpec = await createNRecords(project_id, viewID, 10);

    const db = await getDataDB(project_id);
    if (db) {
      const all_records = Object.values(
        await listRecordMetadata({
          project_id,
          uiSpecification: uiSpec,
          record_ids: null,
        })
      );
      const record_ids = all_records.map((r: RecordMetadata) => r.record_id);

      // get a filtered selection of records
      const records = Object.values(
        await listRecordMetadata({
          project_id,
          record_ids: record_ids.slice(5),
          uiSpecification: uiSpec,
        })
      );
      expect(records.length).toBe(5);
      // // check a few properties
      expect(records[0].created_by).toBe('user');
      expect(records[0].type).toBe('Test');
    } else {
      fail('Failed to get database');
    }
  });
});

// this is really just an experiment in writing queries...
describe.skip('record queries', () => {
  test('map-reduce query', async () => {
    const viewID = 'Test';
    const project_id = 'test';

    await cleanDataDBS();
    await createNRecords(project_id, viewID, 10);

    const db = await getDataDB(project_id);
    if (db) {
      const result = await db
        .query(
          {
            map: (doc: any, emit: CallableFunction) => {
              if (doc.record_format_version === 1) {
                if (doc.heads.length > 0) {
                  const conflict = doc.heads.length > 1;
                  const created = doc.created;
                  const created_by = doc.created_by;
                  const type = doc.type;
                  emit([doc._id, 'revision'], {
                    _id: doc.heads[0],
                    conflict,
                    created,
                    created_by,
                    type,
                  });
                }
              } else if (doc.avp_format_version === 1) {
                emit([doc._id, 'avp']);
              }
            },
          },
          {
            include_docs: true,
          }
        )
        .catch((err: any) => {
          console.log('query failed', err);
        });

      const avps = new Map();
      result.rows
        .filter((r: any) => r.key[1] === 'avp')
        .forEach((a: any) => {
          avps.set(a.id, a.doc.data);
        });

      const revisions = result.rows
        .filter((r: any) => r.key[1] === 'revision')
        .map((r: any) => {
          const data: {[key: string]: string} = {};
          for (const a in r.doc.avps) {
            data[a as string] = avps.get(r.doc.avps[a as string]);
          }
          return {...r.doc, data};
        });

      console.log('query result: ', JSON.stringify(revisions, null, 2));
    } else {
      fail('Failed to get database');
    }
  });
});
