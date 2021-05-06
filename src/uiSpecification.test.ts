import {testProp, fc} from 'jest-fast-check';
import PouchDB from 'pouchdb';
import {getUiSpecForProject, setUiSpecForProject} from './uiSpecification';
import {UI_SPECIFICATION_NAME} from './datamodel';
import {equals} from './utils/eqTestSupport';

import {getProjectDB} from './sync/index';

PouchDB.plugin(require('pouchdb-adapter-memory')); // enable memory adaptor for testing

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
      fc.string(),
      fc.dictionary(fc.string(), fc.jsonObject()), // fields
      fc.dictionary(fc.string(), fc.jsonObject()), // views
      fc.string(), // start-view
    ],
    async (project_name, fields, views, start_view) => {
      await cleanProjectDBS();
      fc.pre(projdbs !== {});

      const uiInfo = {
        _id: UI_SPECIFICATION_NAME,
        fields: fields,
        views: views,
        start_view: start_view,
      };

      const meta_db = getProjectDB(project_name);

      return setUiSpecForProject(meta_db, uiInfo)
        .then(result => {
          return getUiSpecForProject(project_name);
        })
        .then(result => {
          delete result['_rev'];
          expect(equals(result, uiInfo)).toBe(true);
        });
    }
  );
});
