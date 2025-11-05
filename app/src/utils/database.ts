import {ProjectDataObject} from '@faims3/data-model';
import {databaseService} from '../context/slices/helpers/databaseService';
import {PouchDBWrapper} from '../context/slices/helpers/pouchDBWrapper';
import {selectAllProjects} from '../context/slices/projectSlice';
import {store} from '../context/store';

export const localGetDataDb = (
  projectId: string
): PouchDBWrapper<ProjectDataObject> => {
  const projectState = store.getState();
  const dbId = selectAllProjects(projectState).find(
    p => p.projectId === projectId
  )?.database?.localDbId;
  if (!dbId) {
    throw Error(
      `Could not get Data DB for project with ID. The project store does not contain a reference to this project database ${projectId}.`
    );
  }
  const db = databaseService.getLocalDatabase(dbId);
  if (!db) {
    throw Error(
      `Could not get Data DB for project with ID: ${projectId}. Database service missing entry.`
    );
  }
  return db;
};
