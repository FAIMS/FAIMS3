import {createContext, ReactNode, useEffect, useState} from 'react';
import {ProjectExtended} from '../types/project';
import {getRemoteProjects} from './functions';
import {getLocalProjects, updateLocalProjects} from '../dbs/projects-db';

export const ProjectsContext = createContext<{
  projects: ProjectExtended[];
  setProjects: React.Dispatch<React.SetStateAction<ProjectExtended[]>>;
}>({
  projects: [],
  setProjects: () => {},
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
      const localProjects = await getLocalProjects();

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

      await updateLocalProjects(newProjects);
    };

    init();
  }, []);

  return (
    <ProjectsContext.Provider value={{projects, setProjects}}>
      {children}
    </ProjectsContext.Provider>
  );
}
