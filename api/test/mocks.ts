import PouchDB from 'pouchdb';
PouchDB.plugin(require('pouchdb-adapter-memory')); // enable memory adapter for testing
import PouchDBFind from 'pouchdb-find';
PouchDB.plugin(PouchDBFind);

import {ProjectID, DBCallbackObject, ProjectUIModel} from '@faims3/data-model';
import {
  getAuthDB,
  getProjectsDB,
  getTemplatesDb,
  getUsersDB,
  initialiseDatabases,
} from '../src/couchdb';
import {COUCHDB_INTERNAL_URL} from '../src/buildconfig';

export const databaseList: any = {};

const getDatabase = async (databaseName: string) => {
  if (databaseList[databaseName] === undefined) {
    // still use the COUCHDB URL setting to be consistent with
    // other bits of the code, but this database will be in memory
    const db = new PouchDB(COUCHDB_INTERNAL_URL + '/' + databaseName, {
      adapter: 'memory',
    });
    databaseList[databaseName] = db;
  }
  return databaseList[databaseName];
};

const mockGetDataDB = async (project_id: ProjectID) => {
  const databaseName = 'data-' + project_id;
  return getDatabase(databaseName);
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const mockGetUiSpec = (projectId: ProjectID) => {
    // The UI spec is part of the metadata DB
  // TODO make this make sense. Get nothing - might need to fix this
  return {} as unknown as ProjectUIModel;
};

const mockShouldDisplayRecord = async (params: any) => {
  return true;
};

const clearDB = async (db: PouchDB.Database) => {
  const docs = await db.allDocs();
  for (let index = 0; index < docs.rows.length; index++) {
    const doc = docs.rows[index];
    await db.remove(doc.id, doc.value.rev);
  }
};

export const resetDatabases = async () => {
  // Fetch and clear all mocked in memory DBs
  const usersDB = getUsersDB();
  if (usersDB) {
    await clearDB(usersDB);
  }
  const authDB = getAuthDB();
  if (authDB) {
    await clearDB(authDB);
  }
  const projectsDB = getProjectsDB();
  if (projectsDB) {
    await clearDB(projectsDB);
  }
  const templatesDB = getTemplatesDb();
  if (templatesDB) {
    await clearDB(templatesDB);
  }
  for (const dbKey of Object.keys(databaseList)) {
    const toClear = ['metadata', 'projects'];
    if (toClear.some(prefix => dbKey.startsWith(prefix))) {
      await clearDB(databaseList[dbKey]);
    }
  }
  // Clear all metadata DBs
  await initialiseDatabases({force: true});
};

export const cleanDataDBS = async () => {
  let db: PouchDB.Database;
  for (const name in databaseList) {
    db = databaseList[name];
    delete databaseList[name];
    if (db !== undefined) {
      try {
        await db.destroy();
      } catch (err) {
        console.log('error db ', name);
        console.log(err);
      }
    }
  }
};
// register our mock database clients with the module
export const callbackObject: DBCallbackObject = {
  getDataDB: mockGetDataDB,
  shouldDisplayRecord: mockShouldDisplayRecord,
};
