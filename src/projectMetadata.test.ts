import {testProp, fc} from 'jest-fast-check';
import PouchDB from 'pouchdb';
import {getProjectMetadata, setProjectMetadata} from './projectMetadata';
import {equals} from './utils/eqTestSupport';

import {getProjectDB} from './sync/index';

PouchDB.plugin(require('pouchdb-adapter-memory')); // enable memory adapter for testing

const projdbs: any = {};

function mockProjectDB(project_name: string) {
  if (projdbs[project_name] === undefined) {
    const db = new PouchDB(project_name, {adapter: 'memory'});
    projdbs[project_name] = db;
  }
  return projdbs[project_name];
}

async function cleanProjectDBS() {
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
  getProjectDB: mockProjectDB,
}));

describe('roundtrip reading and writing to db', () => {
  testProp(
    'ui roundtrip',
    [
      fc.fullUnicodeString(), // project name
      fc.fullUnicodeString(), // metadata_key
      fc.unicodeJsonObject(), // metadata
    ],
    async (project_name, metadata_key, metadata) => {
      await cleanProjectDBS();
      fc.pre(projdbs !== {});

      return setProjectMetadata(project_name, metadata_key, metadata)
        .then(result => {
          return getProjectMetadata(project_name, metadata_key);
        })
        .then(result => {
          expect(equals(result, metadata)).toBe(true);
        });
    }
  );
});
