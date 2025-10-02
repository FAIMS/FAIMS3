import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
PouchDB.plugin(require('pouchdb-adapter-memory')); // enable memory adapter for testing
PouchDB.plugin(PouchDBFind);

import {
  DatabaseInterface,
  DBCallbackObject,
  ProjectID,
} from '@faims3/data-model';
import {COUCHDB_INTERNAL_URL} from '../src/buildconfig';
import {
  getAuthDB,
  localGetProjectsDb,
  getTemplatesDb,
  getUsersDB,
  initialiseDbAndKeys,
  getTeamsDB,
} from '../src/couchdb';
import {registerAdminUser} from '../src/couchdb/users';

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

export const mockGetDataDB = async (project_id: ProjectID) => {
  const databaseName = 'data-' + project_id;
  return getDatabase(databaseName);
};

const mockShouldDisplayRecord = async () => {
  return true;
};

const clearDB = async (db: DatabaseInterface) => {
  const docs = await db.allDocs();
  for (let index = 0; index < docs.rows.length; index++) {
    const doc = docs.rows[index];
    await db.remove(doc.id, doc.value.rev);
  }
};

export const resetDatabases = async () => {
  // Fetch and clear all mocked in memory DBs
  const usersDB = getUsersDB();
  await clearDB(usersDB);

  const authDB = getAuthDB();
  await clearDB(authDB);

  const projectsDB = localGetProjectsDb();
  await clearDB(projectsDB);

  const templatesDB = getTemplatesDb();
  await clearDB(templatesDB);

  const teamsDB = getTeamsDB();
  await clearDB(teamsDB);

  for (const dbKey of Object.keys(databaseList)) {
    const toClear = ['metadata', 'projects'];
    if (toClear.some(prefix => dbKey.startsWith(prefix))) {
      await clearDB(databaseList[dbKey]);
    }
  }
  // Clear all metadata DBs
  await initialiseDbAndKeys({force: true});
  await registerAdminUser();
};

export const cleanDataDBS = async () => {
  let db: DatabaseInterface;
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
