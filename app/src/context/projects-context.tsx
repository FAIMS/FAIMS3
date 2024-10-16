import {createContext, ReactNode, useEffect, useState} from 'react';
import {ProjectExtended} from '../types/project';
import {getRemoteProjects} from './functions';
import {
  getProjectsDB,
  updateProjectsDB,
  activateProjectDB,
  setSyncProjectDB,
} from '../dbs/projects-db';
import {activate_project} from '../sync/process-initialization';

export const ProjectsContext = createContext<{
  projects: ProjectExtended[];
  activateProject: (id: string, listing: string) => void;
  setProjectSync: (id: string, listing: string, sync: boolean) => void;
}>({
  projects: [],
  activateProject: () => {},
  setProjectSync: () => {},
});

/**
 * Provides a context for managing projects.
 *
 * @param children - The child components to be wrapped by the provider.
 */
export function ProjectsProvider({children}: {children: ReactNode}) {
  const [projects, setProjects] = useState<ProjectExtended[]>([]);

  useEffect(() => {
    const init = async () => {
      const localProjects = await getProjectsDB();

      setProjects(localProjects);

      const remoteProjects = await getRemoteProjects();

      if (!remoteProjects.length) return;

      const localProjectsMap = new Map(
        localProjects.map(project => [project._id, project])
      );

      const newProjects = remoteProjects.map(project => {
        return {
          ...project,
          activated: !!localProjectsMap.get(project._id)?.activated,
          sync: !!localProjectsMap.get(project._id)?.sync,
        };
      });

      setProjects(newProjects);

      await updateProjectsDB(newProjects);
    };

    init();
  }, []);

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
      value={{projects, activateProject, setProjectSync}}
    >
      {children}
    </ProjectsContext.Provider>
  );
}
