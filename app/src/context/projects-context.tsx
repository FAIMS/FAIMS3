import {createContext, ReactNode, useEffect, useState} from 'react';
import {
  activateProjectDB,
  getProjectsDB,
  setSyncProjectDB,
  updateProjectsDB,
} from '../dbs/projects-db';
import {activate_project} from '../sync/process-initialization';
import {ProjectExtended} from '../types/project';
import {getRemoteProjects} from './functions';

export const ProjectsContext = createContext<{
  projects: ProjectExtended[];
  activateProject: (id: string, listing: string) => void;
  setProjectSync: (id: string, listing: string, sync: boolean) => void;
  syncRemoteProjects: () => Promise<void>;
  initProjects: () => Promise<void>;
}>({
  projects: [],
  activateProject: () => {},
  setProjectSync: () => {},
  syncRemoteProjects: () => new Promise(() => {}),
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
    await syncLocalProjects();
    await syncRemoteProjects();
  };

  /**
   * Synchronizes remote projects with the local state and database.
   * Fetches projects from a remote source, merges with the local project data
   * to retain activation and sync status, then updates the project state and database.
   *
   * @async
   * @function syncRemoteProjects
   * @returns {Promise<void>} Resolves when synchronization is complete.
   */
  const syncRemoteProjects = async () => {
    const remoteProjects = await getRemoteProjects();

    if (!remoteProjects.length) return;

    const currentProjectsMap = new Map(
      projects.map(project => [project._id, project])
    );

    const newProjects = remoteProjects.map(project => {
      return {
        ...project,
        activated: !!currentProjectsMap.get(project._id)?.activated,
        sync: !!currentProjectsMap.get(project._id)?.sync,
      };
    });

    setProjects(newProjects);

    await updateProjectsDB(newProjects);
  };

  /**
   * Synchronizes local projects by fetching them from the database
   * and updating the project state.
   *
   * @async
   * @function syncLocalProjects
   * @returns {Promise<void>} Resolves when local projects are synchronized.
   */
  const syncLocalProjects = async () => {
    const localProjects = await getProjectsDB();

    setProjects(localProjects);
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
        syncRemoteProjects,
        initProjects,
      }}
    >
      {children}
    </ProjectsContext.Provider>
  );
}
