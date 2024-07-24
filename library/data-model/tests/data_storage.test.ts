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

import {test, fc} from '@fast-check/jest';
import {registerClient} from '../src';
import {Record} from '../src/types';
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
      await createNRecords(project_id, viewID, n);

      const iterator = await notebookRecordIterator(project_id, viewID);

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
  });
});

// describe('record queries', () => {
//   test('map-reduce query', async () => {
//     const viewID = 'Test';
//     const project_id = 'test';

//     await cleanDataDBS();
//     await createNRecords(project_id, viewID, 10);

//     const db = await getDataDB(project_id);
//     if (db) {
//       const result = await db
//         .query(
//           {
//             map: (doc: any, emit: CallableFunction) => {
//               emit(doc.record_format_version, doc);
//             },
//           },
//           {key: 1}
//         )
//         .catch((err: any) => {
//           console.log('query failed', err);
//         });
//       console.log('query result: ', result);
//     } else {
//       fail('Failed to get database');
//     }
//   });
// });
