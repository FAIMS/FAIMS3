import {createContext, ReactNode, useEffect, useState} from 'react';
import {ProjectExtended} from '../types/project';
import {getRemoteProjects} from './functions';
import {
  getProjectsDB,
  updateProjectsDB,
  activateProjectDB,
} from '../dbs/projects-db';
import {activate_project} from '../sync/process-initialization';

export const ProjectsContext = createContext<{
  projects: ProjectExtended[];
  activateProject: (id: string, listing: string) => void;
}>({
  projects: [],
  activateProject: _ => {},
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

  const activateProject = async (id: string, listing: string) => {
    const projectID = await activate_project(listing, id);

    if (!projectID) return;

    setProjects(projects =>
      projects.map(p => (p._id === id ? {...p, activated: true} : p))
    );

    activateProjectDB(id);
  };

  return (
    <ProjectsContext.Provider value={{projects, activateProject}}>
      {children}
    </ProjectsContext.Provider>
  );
}
