import {createContext, ReactNode, useEffect} from 'react';
import {Project} from '../types/project';
import {
  directory_db_pouch,
  local_auth_db,
  data_dbs,
  metadata_dbs,
} from '../sync/databases';
import {ProjectInformation, ProjectObject} from '@faims3/data-model';

export const ProjectsContext = createContext<Project[] | null>(null);

const getListings = async () => {
  const {rows} = await directory_db_pouch.allDocs({include_docs: true});

  return rows.map(row => row.doc).filter(doc => doc !== undefined);
};

const getToken = async (id: string) => {
  const {available_tokens, current_username} = await local_auth_db.get(id);

  return available_tokens[current_username].token;
};

const getDirectory = async (url: string, token: string) => {
  const response = await fetch(`${url}/api/directory`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    console.error(`Error fetching projects from ${url}`);
    return [] as ProjectObject[];
  }

  return (await response.json()) as ProjectObject[];
};

const getMetaData = async (conductorURL: string, directoryID: string) => {
  const {local} =
    metadata_dbs[`${conductorURL.replace('http://', '')}||${directoryID}`];

  return await local.allDocs();
};

const directoryToProject = (
  {_id, name, description, last_updated, created, status}: ProjectObject,
  is_activated: boolean,
  listing_id: string,
  non_unique_project_id: string
): ProjectInformation => {
  return {
    project_id: _id,
    name,
    description,
    last_updated,
    created,
    status,
    is_activated,
    listing_id,
    non_unique_project_id,
  };
};

export function ProjectsProvider({children}: {children: ReactNode}) {
  useEffect(() => {
    console.log('DEBUG: data_dbs', data_dbs);
    console.log('DEBUG: metadata_dbs', metadata_dbs);
  }, []);

  useEffect(() => {
    const getProjects = async () => {
      const listings = await getListings();

      for (const {_id, conductor_url} of listings) {
        if (!_id || !conductor_url) continue;

        const token = await getToken(_id);
        const directories = await getDirectory(conductor_url, token);

        console.log('DEBUG: directories', directories);

        const dataDocs = await getMetaData(conductor_url, directories[0]._id);

        console.log('DEBUG: data_docs', dataDocs);
      }
    };
    getProjects();
  }, []);

  return (
    <ProjectsContext.Provider value={[] as Project[]}>
      {children}
    </ProjectsContext.Provider>
  );
}
