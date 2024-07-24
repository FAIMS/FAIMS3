import PouchDB from 'pouchdb';
import {DBCallbackObject, generateFAIMSDataID, upsertFAIMSData} from '../src';
import {addDesignDocsForNotebook} from '../src/data_storage/databases';
import {ProjectID, Record} from '../src/types';
import PouchDBFind from 'pouchdb-find';

PouchDB.plugin(require('pouchdb-adapter-memory')); // enable memory adapter for testing
PouchDB.plugin(PouchDBFind);

const databaseList: any = {};

const getDatabase = async (databaseName: string) => {
  if (databaseList[databaseName] === undefined) {
    const db = new PouchDB(databaseName, {adapter: 'memory'});
    databaseList[databaseName] = db;
  }
  return databaseList[databaseName];
};

const mockGetDataDB = async (project_id: ProjectID) => {
  const databaseName = 'data-' + project_id;
  const db = await getDatabase(databaseName);
  await addDesignDocsForNotebook(db);
  return db;
};

const mockGetProjectDB = async (project_id: ProjectID) => {
  return getDatabase('project-' + project_id);
};

const mockShouldDisplayRecord = () => {
  return true;
};

export const cleanDataDBS = async () => {
  let db: PouchDB.Database;
  for (const name in databaseList) {
    db = databaseList[name];
    delete databaseList[name];

    if (db !== undefined) {
      try {
        await db.destroy();
        //await db.close();
      } catch (err) {
        console.error(err);
      }
    }
  }
};
// register our mock database clients with the module
export const callbackObject: DBCallbackObject = {
  getDataDB: mockGetDataDB,
  getProjectDB: mockGetProjectDB,
  shouldDisplayRecord: mockShouldDisplayRecord,
};

export const createRecord = async (
  project_id: string,
  viewID: string,
  data: {name: string; age: number}
) => {
  const userID = 'user';
  const doc: Record = {
    project_id: project_id,
    record_id: generateFAIMSDataID(),
    revision_id: null,
    type: viewID,
    data: data,
    created_by: userID,
    updated_by: userID,
    created: new Date(),
    updated: new Date(),
    annotations: {},
    field_types: {
      name: 'faims::string',
      age: 'faims::integer',
    },
    relationship: undefined,
    deleted: false,
  };

  return await upsertFAIMSData(project_id, doc);
};

export const createNRecords = async (
  project_id: string,
  viewID: string,
  n: number
) => {
  for (let i = 0; i < n; i++) {
    await createRecord(project_id, viewID, {name: `Bob ${i}`, age: i});
  }
};
