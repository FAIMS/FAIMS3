import {ProjectExtended} from '../types/project';
import PouchDB from 'pouchdb-browser';

/**
 * Represents a PouchDB instance for storing projects.
 *
 * @remarks
 * This PouchDB instance is used to store projects locally.
 *
 * @typeParam T - The type of the documents stored in the database.
 */
export const db = new PouchDB<{
  _id: string;
  project: ProjectExtended;
}>('local-projects');

/**
 * Updates the local projects in the database.
 *
 * @param projects - An array of ProjectExtended objects representing the projects to be updated.
 * @returns A promise that resolves when the update is complete.
 */
export const updateProjectsDB = async (projects: ProjectExtended[]) =>
  await db.bulkDocs(
    projects.map(project => ({
      _id: project._id,
      project,
    }))
  );

/**
 * Activates a project.
 *
 * @param project - The project to activate.
 * @returns A promise that resolves when the project is activated.
 */
export const activateProjectDB = async (_id: string) => {
  const doc = await db.get(_id);

  await db.put({
    _id,
    _rev: doc._rev,
    project: {
      ...doc.project,
      activated: true,
      sync: true,
    },
  });
};

/**
 * Sets the sync status of a project.
 *
 * @param _id - The ID of the project to set the sync status of.
 * @param sync - The sync status to set.
 */
export const setSyncProjectDB = async (_id: string, sync: boolean) => {
  const doc = await db.get(_id);

  await db.put({
    _id,
    _rev: doc._rev,
    project: {
      ...doc.project,
      sync: sync,
    },
  });
};

/**
 * Retrieves the local projects from the database.
 *
 * @returns An array of local projects.
 */
export const getProjectsDB = async () => {
  const {rows} = await db.allDocs({include_docs: true});

  return rows.map(row => row?.doc?.project).filter(x => x !== undefined);
};
