import {testProp, fc} from 'jest-fast-check';
import PouchDB from 'pouchdb';
import {getProjectMetadata, setProjectMetadata} from './projectMetadata';
import {ProjectID} from './datamodel';
import {equals} from './utils/eqTestSupport';

import {getProjectDB} from './sync/index';

PouchDB.plugin(require('pouchdb-adapter-memory')); // enable memory adaptor for testing

const projdbs: any = {};

function mockProjectDB(project_id: ProjectID) {
  if (projdbs[project_id] === undefined) {
    const db = new PouchDB(project_id, {adapter: 'memory'});
    projdbs[project_id] = db;
  }
  return projdbs[project_id];
}

async function cleanProjectDBS() {
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
    async (project_id, metadata_key, metadata) => {
      await cleanProjectDBS();
      fc.pre(projdbs !== {});

      return setProjectMetadata(project_id, metadata_key, metadata)
        .then(result => {
          return getProjectMetadata(project_id, metadata_key);
        })
        .then(result => {
          expect(equals(result, metadata)).toBe(true);
        });
    }
  );
});
