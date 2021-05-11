import {testProp, fc} from 'jest-fast-check';
import PouchDB from 'pouchdb';
import {Observation} from './datamodel';
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

PouchDB.plugin(require('pouchdb-adapter-memory')); // enable memory adaptor for testing

const projdbs: any = {};

function mockDataDB(project_name: string) {
  if (projdbs[project_name] === undefined) {
    const db = new PouchDB(project_name, {adapter: 'memory'});
    projdbs[project_name] = db;
  }
  return projdbs[project_name];
}

async function cleanDataDBS() {
  let db;
  for (const project_name in projdbs) {
    db = projdbs[project_name];
    delete projdbs[project_name];

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
    [fc.string(), fc.string(), fc.string(), fc.jsonObject(), fc.string()],
    async (project_name, namespace, name, data, userid) => {
      fc.pre(!namespace.includes(':'));
      fc.pre(!name.includes(':'));
      fc.pre(namespace.trim() !== '');
      fc.pre(name.trim() !== '');
      await cleanDataDBS();
      fc.pre(projdbs !== {});

      const fulltype = namespace + '::' + name;

      const dataid = generateFAIMSDataID();

      const doc: Observation = {
        _id: dataid,
        type: fulltype,
        data: data,
        userid: userid,
      };

      return upsertFAIMSData(project_name, doc)
        .then(result => {
          return lookupFAIMSDataID(project_name, dataid);
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
      fc.string(),
      fc.string(),
      fc.string(),
      fc.jsonObject(),
      fc.jsonObject(),
      fc.string(),
    ],
    async (project_name, namespace, name, data, new_data, userid) => {
      fc.pre(!namespace.includes(':'));
      fc.pre(!name.includes(':'));
      fc.pre(namespace.trim() !== '');
      fc.pre(name.trim() !== '');
      await cleanDataDBS();
      fc.pre(projdbs !== {});

      const fulltype = namespace + '::' + name;

      const dataid = generateFAIMSDataID();

      const doc: Observation = {
        _id: dataid,
        type: fulltype,
        data: data,
        userid: userid,
      };

      const new_doc: Observation = {
        _id: dataid,
        type: fulltype,
        data: new_data,
        userid: userid,
      };

      return upsertFAIMSData(project_name, doc)
        .then(result => {
          return lookupFAIMSDataID(project_name, dataid);
        })
        .then(result => {
          expect(equals(result, doc)).toBe(true);
        })
        .then(result => {
          return lookupFAIMSDataID(project_name, dataid);
        })
        .then(result => {
          if (result === null) {
            throw Error('something deleted the old revision...');
          }
          result.data = new_data;
          return upsertFAIMSData(project_name, result);
        })
        .then(result => {
          return lookupFAIMSDataID(project_name, dataid);
        })
        .then(result => {
          expect(equals(result, new_doc)).toBe(true);
        })
        .then(result => {
          return deleteFAIMSDataForID(project_name, dataid);
        })
        .then(result => {
          return lookupFAIMSDataID(project_name, dataid);
        })
        .then(result => {
          expect(result).toBe(null);
        })
        .then(result => {
          return undeleteFAIMSDataForID(project_name, dataid);
        })
        .then(result => {
          return lookupFAIMSDataID(project_name, dataid);
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
    [fc.string(), fc.string(), fc.string(), fc.jsonObject(), fc.string()],
    async (project_name, namespace, name, data, userid) => {
      fc.pre(!namespace.includes(':'));
      fc.pre(!name.includes(':'));
      fc.pre(namespace.trim() !== '');
      fc.pre(name.trim() !== '');
      await cleanDataDBS();
      fc.pre(projdbs !== {});

      const fulltype = namespace + '::' + name;

      const dataid = generateFAIMSDataID();

      const doc: Observation = {
        _id: dataid,
        type: fulltype,
        data: data,
        userid: userid,
      };

      return upsertFAIMSData(project_name, doc)
        .then(result => {
          return listFAIMSProjectRevisions(project_name);
        })
        .then(result => {
          expect(result[dataid]).not.toBe(undefined);
          expect(result[dataid]).toHaveLength(1);
          expect(result[dataid][0]).toEqual(expect.stringMatching(/^1-.*/));
        });
    }
  );
});
