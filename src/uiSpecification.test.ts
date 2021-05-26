import {testProp, fc} from 'jest-fast-check';
import PouchDB from 'pouchdb';
import {getUiSpecForProject, setUiSpecForProject} from './uiSpecification';
import {UI_SPECIFICATION_NAME, ProjectID} from './datamodel';
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
      fc.fullUnicodeString(),
      fc.dictionary(fc.fullUnicodeString(), fc.unicodeJsonObject()), // fields
      fc.dictionary(fc.fullUnicodeString(), fc.unicodeJsonObject()), // views
      fc.fullUnicodeString(), // start-view
    ],
    async (project_id, fields, views, start_view) => {
      await cleanProjectDBS();
      fc.pre(projdbs !== {});

      const uiInfo = {
        _id: UI_SPECIFICATION_NAME,
        fields: fields,
        views: views,
        start_view: start_view,
      };

      const meta_db = getProjectDB(project_id);

      return setUiSpecForProject(meta_db, uiInfo)
        .then(result => {
          return getUiSpecForProject(project_id);
        })
        .then(result => {
          delete result['_rev'];
          expect(equals(result, uiInfo)).toBe(true);
        });
    }
  );
});
