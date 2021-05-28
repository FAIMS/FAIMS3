/*
 * Copyright 2021 Macquarie University
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
 * Filename: dataStorage.test.ts
 * Description: 
 *   TODO
 */
 
import {testProp, fc} from 'jest-fast-check';
import PouchDB from 'pouchdb';
import {Observation, ProjectID} from './datamodel';
import {
  generateFAIMSDataID,
  upsertFAIMSData,
  lookupFAIMSDataID,
  listFAIMSProjectRevisions,
  deleteFAIMSDataForID,
  undeleteFAIMSDataForID,
} from './dataStorage';
import {equals} from './utils/eqTestSupport';

import {getDataDB} from './sync/index';

PouchDB.plugin(require('pouchdb-adapter-memory')); // enable memory adapter for testing

const projdbs: any = {};

function mockDataDB(project_id: ProjectID) {
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
      fc.date(),
    ],
    async (project_id, namespace, name, data, userid, time) => {
      fc.pre(!namespace.includes(':'));
      fc.pre(!name.includes(':'));
      fc.pre(namespace.trim() !== '');
      fc.pre(name.trim() !== '');
      await cleanDataDBS();
      fc.pre(projdbs !== {});

      const fulltype = namespace + '::' + name;

      const observation_id = generateFAIMSDataID();

      const doc: Observation = {
        observation_id: observation_id,
        type: fulltype,
        data: data,
        created_by: userid,
        updated_by: userid,
        created: time,
        updated: time,
      };

      return upsertFAIMSData(project_id, doc)
        .then(result => {
          return lookupFAIMSDataID(project_id, observation_id);
        })
        .then(result => {
          expect(equals(result, doc)).toBe(true);
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
      fc.unicodeJsonObject(),
      fc.unicodeJsonObject(),
      fc.fullUnicodeString(),
      fc.date(),
    ],
    async (project_id, namespace, name, data, new_data, userid, time) => {
      fc.pre(!namespace.includes(':'));
      fc.pre(!name.includes(':'));
      fc.pre(namespace.trim() !== '');
      fc.pre(name.trim() !== '');
      await cleanDataDBS();
      fc.pre(projdbs !== {});

      const fulltype = namespace + '::' + name;

      const observation_id = generateFAIMSDataID();

      const doc: Observation = {
        observation_id: observation_id,
        type: fulltype,
        data: data,
        created_by: userid,
        updated_by: userid,
        created: time,
        updated: time,
      };

      const new_doc: Observation = {
        observation_id: observation_id,
        type: fulltype,
        data: new_data,
        created_by: userid,
        updated_by: userid,
        created: time,
        updated: time,
      };

      return upsertFAIMSData(project_id, doc)
        .then(result => {
          return lookupFAIMSDataID(project_id, observation_id);
        })
        .then(result => {
          expect(equals(result, doc)).toBe(true);
        })
        .then(result => {
          return lookupFAIMSDataID(project_id, observation_id);
        })
        .then(result => {
          if (result === null) {
            throw Error('something deleted the old revision...');
          }
          result.data = new_data;
          return upsertFAIMSData(project_id, result);
        })
        .then(result => {
          return lookupFAIMSDataID(project_id, observation_id);
        })
        .then(result => {
          expect(equals(result, new_doc)).toBe(true);
        })
        .then(result => {
          return deleteFAIMSDataForID(project_id, observation_id);
        })
        .then(result => {
          return lookupFAIMSDataID(project_id, observation_id);
        })
        .then(result => {
          expect(result).toBe(null);
        })
        .then(result => {
          return undeleteFAIMSDataForID(project_id, observation_id);
        })
        .then(result => {
          return lookupFAIMSDataID(project_id, observation_id);
        })
        .then(result => {
          expect(equals(result, new_doc)).toBe(true);
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
      fc.date(),
    ],
    async (project_id, namespace, name, data, userid, time) => {
      fc.pre(!namespace.includes(':'));
      fc.pre(!name.includes(':'));
      fc.pre(namespace.trim() !== '');
      fc.pre(name.trim() !== '');
      await cleanDataDBS();
      fc.pre(projdbs !== {});

      const fulltype = namespace + '::' + name;

      const observation_id = generateFAIMSDataID();

      const doc: Observation = {
        observation_id: observation_id,
        type: fulltype,
        data: data,
        created_by: userid,
        updated_by: userid,
        created: time,
        updated: time,
      };

      return upsertFAIMSData(project_id, doc)
        .then(result => {
          return listFAIMSProjectRevisions(project_id);
        })
        .then(result => {
          expect(result[observation_id]).not.toBe(undefined);
          expect(result[observation_id]).toHaveLength(1);
          expect(result[observation_id][0]).toEqual(
            expect.stringMatching(/^1-.*/)
          );
        });
    }
  );
});
