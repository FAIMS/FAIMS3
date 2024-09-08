import {Project} from '../types/project';
import PouchDB from 'pouchdb-browser';

const db = new PouchDB<{
  _id: string;
  project: Project;
}>('local-projects');

export const updateLocalProjects = async (projects: Project[]) =>
  await db.bulkDocs(
    projects.map(project => ({
      _id: project._id,
      project,
    }))
  );

export const getLocalProjects = async () => {
  const {rows} = await db.allDocs({include_docs: true});

  return rows.map(row => row?.doc?.project).filter(x => x !== undefined);
};
