import {
  directory_db_pouch,
  JWTTokenInfo,
  local_auth_db,
} from '../sync/databases';
import {ProjectObject, resolve_project_id} from '@faims3/data-model';
import {ProjectExtended} from '../types/project';
import ObjectMap from '../utils/ObjectMap';

/**
 * Retrieves a list of listings from the directory database.
 *
 * @returns {Promise<Array<any>>} A promise that resolves to an array of listing documents.
 */
const getListings = async () => {
  const {rows} = await directory_db_pouch.allDocs({include_docs: true});

  return rows.map(row => row.doc).filter(doc => doc !== undefined);
};

/**
 * Retrieves the token associated with the specified ID by getting the token for
 * the current username.
 *
 * @param id - The ID of the listing to get the token for
 * @returns The token associated with the specified ID.
 */
export const getToken = async (id: string) => {
  const {available_tokens, current_username} = await local_auth_db.get(id);

  return ObjectMap.get(available_tokens, current_username);
};

/**
 * Fetches the listings, gets the first one if present, then gets token for that
 * listing. Does not parse or validate it.
 * @returns Unparsed, unvalidated JWT
 */
export const getDefaultToken = async (): Promise<JWTTokenInfo | undefined> => {
  // Get listings
  const listings = await getListings();

  // If there is an entry, use first
  if (listings.length > 0) {
    return getToken(listings[0]._id);
  }

  // Otherwise no tokens
  return undefined;
};

/**
 * Retrieves the directory of projects from the specified URL.
 *
 * @param {string} url - The URL to fetch the directory from.
 * @param {string} token - The authorization token for the request.
 * @returns {Promise<ProjectObject[]>} - A promise that resolves to an array of ProjectObject.
 */
const getProjects = async (url: string, token: string) => {
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

/**
 * Retrieves a list of Remote projects.
 *
 * @returns {Promise<ProjectExtended[]>} A promise that resolves to an array of Project objects.
 */
export const getRemoteProjects = async () => {
  const listings = await getListings();

  const projects: ProjectExtended[] = [];

  for (const {_id, conductor_url} of listings) {
    if (!_id || !conductor_url) continue;

    const token = await getToken(_id);

    if (!token) {
      // TODO consider implications of this
      console.error(
        `The token was not available for listing with ID: ${_id}. Proceeding.`
      );
      continue;
    }
    const response = await getProjects(conductor_url, token.token);

    projects.push(
      ...response.map(project => ({
        ...project,
        project_id: resolve_project_id(_id, project._id),
        listing: _id,
        activated: false,
        sync: false,
        conductor_url,
      }))
    );
  }

  return projects;
};
