import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
PouchDB.plugin(PouchDBFind);
PouchDB.plugin(require('pouchdb-adapter-memory')); // enable memory adapter for testing

import {DBCallbackObject, generateFAIMSDataID, upsertFAIMSData} from '../src';
import {addDesignDocsForNotebook} from '../src/data_storage/databases';
import {ProjectID, ProjectUIModel, Record} from '../src/types';

const databaseList: any = {};

const getDatabase = (databaseName: string) => {
  if (databaseList[databaseName] === undefined) {
    const db = new PouchDB(databaseName, {adapter: 'memory'});
    databaseList[databaseName] = db;
  }
  return databaseList[databaseName];
};

const mockGetDataDB = async (project_id: ProjectID) => {
  const databaseName = 'data-' + project_id;
  const db = getDatabase(databaseName);
  await addDesignDocsForNotebook(db);
  return db;
};

const mockShouldDisplayRecord = async () => {
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
  shouldDisplayRecord: mockShouldDisplayRecord,
};

export const sampleUiSpecForViewId = ({
  viewId,
  hridFieldId = undefined,
}: {
  viewId: string;
  hridFieldId?: 'age' | 'name';
}): ProjectUIModel => {
  return {
    fields: {
      name: {
        'component-namespace': 'formik-material-ui',
        'component-name': 'TextField',
        'type-returned': 'faims-core::String',
        'component-parameters': {
          label: 'name',
          fullWidth: true,
          helperText: 'Enter text',
          variant: 'outlined',
          required: false,
          InputProps: {
            type: 'text',
          },
          name: 'name',
        },
        validationSchema: [['yup.string']],
        initialValue: '',
        meta: {
          annotation: {
            include: false,
            label: 'annotation',
          },
          uncertainty: {
            include: false,
            label: 'uncertainty',
          },
        },
        condition: null,
        persistent: false,
        displayParent: false,
      },
      age: {
        'component-namespace': 'formik-material-ui',
        'component-name': 'TextField',
        'type-returned': 'faims-core::Integer',
        'component-parameters': {
          label: 'age',
          fullWidth: true,
          helperText: 'We have fields for storing Numbers.',
          variant: 'outlined',
          required: false,
          InputProps: {
            type: 'number',
          },
          name: 'age',
        },
        validationSchema: [['yup.number']],
        initialValue: '',
        meta: {
          annotation: {
            include: false,
            label: 'annotation',
          },
          uncertainty: {
            include: false,
            label: 'uncertainty',
          },
        },
        condition: null,
        persistent: false,
        displayParent: false,
      },
    },
    views: {
      [`TEST-${viewId}`]: {
        label: 'TEST',
        fields: ['name', 'age'],
      },
    },
    viewsets: {
      TEST: {
        label: 'TEST',
        views: [`TEST-${viewId}`],
        // Include HRID field if specified
        ...(hridFieldId ? {hridField: hridFieldId} : {}),
      },
    },
    visible_types: ['TEST'],
  };
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
  viewId: string,
  n: number
): Promise<ProjectUIModel> => {
  for (let i = 0; i < n; i++) {
    await createRecord(project_id, viewId, {name: `Bob ${i}`, age: i});
  }
  return sampleUiSpecForViewId({viewId});
};
