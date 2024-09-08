import {createContext, ReactNode, useEffect, useState} from 'react';
import {getActiveProjects} from '../dbs/activated-db';

export const ActivatedContext = createContext<Map<string, boolean>>(new Map());

export function ActivatedProvider({children}: {children: ReactNode}) {
  const [projects, setProjects] = useState<Map<string, boolean>>(new Map());

  useEffect(() => {
    const init = async () => {
      setProjects(await getActiveProjects());
    };

    init();
  }, []);

  return (
    <ActivatedContext.Provider value={projects}>
      {children}
    </ActivatedContext.Provider>
  );
}
