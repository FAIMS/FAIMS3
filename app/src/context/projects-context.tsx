import {createContext, ReactNode, useEffect, useState} from 'react';
import {Project} from '../types/project';
import {getRemoteProjects} from './functions';
import {getLocalProjects, updateLocalProjects} from '../dbs/projects-db';

export const ProjectsContext = createContext<Project[]>([]);

export function ProjectsProvider({children}: {children: ReactNode}) {
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    const init = async () => {
      setProjects(await getLocalProjects());

      const remoteProjects = await getRemoteProjects();

      if (!remoteProjects.length) return;

      setProjects(remoteProjects);

      await updateLocalProjects(remoteProjects);
    };

    init();
  }, []);

  return (
    <ProjectsContext.Provider value={projects}>
      {children}
    </ProjectsContext.Provider>
  );
}
