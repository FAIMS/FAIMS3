import {createContext, ReactNode, useState, useEffect} from 'react';
import {Project} from '../types/project';
import {
  directory_db_pouch,
  ListingsObject,
  local_auth_db,
} from '../sync/databases';

export const ProjectsContext = createContext<Project | null>(null);

interface Conductor {
  url: string;
  token: string;
}

export function ProjectsProvider({children}: {children: ReactNode}) {
  const [listings, setListings] = useState<ListingsObject[]>([]);
  const [conductors, setConductors] = useState<Conductor[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  const getListings = async () => {
    const {rows} = await directory_db_pouch.allDocs({include_docs: true});
    const newListings = rows
      .map(row => row.doc)
      .filter(doc => doc !== undefined);

    if (newListings.length === 0) return;

    setListings(listings => [...listings, ...newListings]);
  };

  const getConductors = async ({_id, conductor_url}: ListingsObject) => {
    const {available_tokens, current_username} = await local_auth_db.get(_id);

    if (!conductor_url) return;

    setConductors(conductors => [
      ...conductors,
      {url: conductor_url, token: available_tokens[current_username].token},
    ]);
  };

  const getDocs = async ({url, token}: Conductor) => {
    const response = await fetch(`${url}/api/directory`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      console.error(`Error fetching projects from ${url}`);
      return;
    }

    const json = await response.json();

    console.log('JSON: ', json);
  };

  useEffect(() => {
    getDocs();

    directory_db_pouch
      .changes({
        since: 'now',
        live: true,
        include_docs: true,
      })
      .on('change', (value: PouchDB.Core.ChangesResponseChange<any>) => {
        getDocs();
      });
  }, []);

  return (
    <ProjectsContext.Provider value={projects}>
      {children}
    </ProjectsContext.Provider>
  );
}
