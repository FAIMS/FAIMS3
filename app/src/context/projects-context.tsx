import {createContext, ReactNode, useEffect, useState} from 'react';
import {
  activateProjectDB,
  getProjectsDB,
  setSyncProjectDB,
  updateProjectsDB,
} from '../dbs/projects-db';
import {activate_project} from '../sync/process-initialization';
import {ProjectExtended} from '../types/project';
import {getLocalActiveMap, getProjectMap, getRemoteProjects} from './functions';

export const ProjectsContext = createContext<{
  projects: ProjectExtended[];
  activateProject: (id: string, listing: string) => void;
  setProjectSync: (id: string, listing: string, sync: boolean) => void;
  syncProjects: () => Promise<void>;
  initProjects: () => Promise<void>;
}>({
  projects: [],
  activateProject: () => {},
  setProjectSync: () => {},
  syncProjects: () => new Promise(() => {}),
  initProjects: () => new Promise(() => {}),
});

/**
 * Provides a context for managing projects.
 *
 * @param children - The child components to be wrapped by the provider.
 */
export function ProjectsProvider({children}: {children: ReactNode}) {
  const [projects, setProjects] = useState<ProjectExtended[]>([]);

  useEffect(() => {
    initProjects();
  }, []);

  /**
   * Initializes the application by synchronizing local and remote projects.
   * First, it fetches projects from the local database and sets them in the project state,
   * then it synchronizes with remote projects to update the local state and database as needed.
   *
   * @async
   * @function init
   * @returns {Promise<void>} Resolves when initialization is complete.
   */
  const initProjects = async () => {
    const localProjects = await getProjectsDB();
    const remoteProjects = await getRemoteProjects();

    const localProjectsMap = getProjectMap(localProjects);
    const newProjectsMap = getProjectMap(localProjects);

    const localActiveMap = await getLocalActiveMap();

    for (const remoteProject of remoteProjects) {
      const activated =
        localProjectsMap.get(remoteProject._id)?.activated ??
        localActiveMap.has(remoteProject._id) ??
        false;

      const sync =
        localProjectsMap.get(remoteProject._id)?.sync ??
        localActiveMap.get(remoteProject._id)?.sync ??
        false;

      newProjectsMap.set(remoteProject._id, {
        ...remoteProject,
        activated,
        sync,
      });
    }

    const newProjects = [...newProjectsMap.values()];

    updateProjectsDB(newProjects);
    setProjects(newProjects);
  };

  /**
   * Synchronizes the list of projects with remote projects, updating the local project list
   * to include any remote project updates while preserving the activation state.
   *
   * @async
   * @function syncProjects
   * @returns {Promise<void>} Resolves when the project synchronization is complete.
   */
  const syncProjects = async () => {
    const remoteProjects = await getRemoteProjects();

    const projectsMap = getProjectMap(projects);
    const newProjectsMap = getProjectMap(projects);

    // update project list, preserve activated and sync states from existing list
    for (const remoteProject of remoteProjects) {
      newProjectsMap.set(remoteProject._id, {
        ...remoteProject,
        activated: projectsMap.get(remoteProject._id)?.activated ?? false,
        sync: projectsMap.get(remoteProject._id)?.sync ?? false,
      });
    }

    const newProjects = [...newProjectsMap.values()];

    updateProjectsDB(newProjects);
    setProjects(newProjects);
  };

  /**
   * Activates a project.
   *
   * @param id - The ID of the project to activate.
   * @param listing - The listing of the project to activate.
   */
  const activateProject = async (id: string, listing: string) => {
    try {
      await activate_project(listing, id);
    } catch (err) {
      console.error('Failed to activate project', err);
      return;
    }

    setProjects(projects =>
      projects.map(p =>
        p._id === id ? {...p, activated: true, sync: true} : p
      )
    );

    activateProjectDB(id);
  };

  /**
   * Sets the sync status of a project.
   *
   * @param id - The ID of the project to set the sync status of.
   * @param listing - The listing of the project to set the sync status of.
   * @param sync - The sync status to set.
   */
  const setProjectSync = async (id: string, listing: string, sync: boolean) => {
    try {
      await activate_project(listing, id, sync);
    } catch (err) {
      console.error('Failed to activate project', err);
      return;
    }

    setProjects(projects =>
      projects.map(p => (p._id === id ? {...p, sync} : p))
    );

    setSyncProjectDB(id, sync);
  };

  return (
    <ProjectsContext.Provider
      value={{
        projects,
        activateProject,
        setProjectSync,
        syncProjects,
        initProjects,
      }}
    >
      {children}
    </ProjectsContext.Provider>
  );
}
