import {testProp, fc} from 'jest-fast-check';
import PouchDB from 'pouchdb';
import {Observation} from './datamodel';
import {
  generateFAIMSDataID,
  upsertFAIMSData,
  lookupFAIMSDataID,
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
    [fc.string(), fc.string(), fc.string(), fc.jsonObject()],
    async (project_name, namespace, name, data) => {
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
      };

      return upsertFAIMSData(project_name, doc)
        .then(result => {
          return lookupFAIMSDataID(project_name, dataid);
        })
        .then(result => {
          delete result['_rev'];
          expect(equals(result, doc)).toBe(true);
        });
    }
  );
});
