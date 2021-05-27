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

      const dataid = generateFAIMSDataID();

      const doc: Observation = {
        observation_id: dataid,
        type: fulltype,
        data: data,
        created_by: userid,
        updated_by: userid,
        created: time,
        updated: time,
      };

      return upsertFAIMSData(project_id, doc)
        .then(result => {
          return lookupFAIMSDataID(project_id, dataid);
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

      const dataid = generateFAIMSDataID();

      const doc: Observation = {
        observation_id: dataid,
        type: fulltype,
        data: data,
        created_by: userid,
        updated_by: userid,
        created: time,
        updated: time,
      };

      const new_doc: Observation = {
        observation_id: dataid,
        type: fulltype,
        data: new_data,
        created_by: userid,
        updated_by: userid,
        created: time,
        updated: time,
      };

      return upsertFAIMSData(project_id, doc)
        .then(result => {
          return lookupFAIMSDataID(project_id, dataid);
        })
        .then(result => {
          expect(equals(result, doc)).toBe(true);
        })
        .then(result => {
          return lookupFAIMSDataID(project_id, dataid);
        })
        .then(result => {
          if (result === null) {
            throw Error('something deleted the old revision...');
          }
          result.data = new_data;
          return upsertFAIMSData(project_id, result);
        })
        .then(result => {
          return lookupFAIMSDataID(project_id, dataid);
        })
        .then(result => {
          expect(equals(result, new_doc)).toBe(true);
        })
        .then(result => {
          return deleteFAIMSDataForID(project_id, dataid);
        })
        .then(result => {
          return lookupFAIMSDataID(project_id, dataid);
        })
        .then(result => {
          expect(result).toBe(null);
        })
        .then(result => {
          return undeleteFAIMSDataForID(project_id, dataid);
        })
        .then(result => {
          return lookupFAIMSDataID(project_id, dataid);
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

      const dataid = generateFAIMSDataID();

      const doc: Observation = {
        observation_id: dataid,
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
          expect(result[dataid]).not.toBe(undefined);
          expect(result[dataid]).toHaveLength(1);
          expect(result[dataid][0]).toEqual(expect.stringMatching(/^1-.*/));
        });
    }
  );
});
