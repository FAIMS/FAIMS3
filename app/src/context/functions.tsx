import {
  active_db,
  directory_db_pouch,
  ExistingActiveDoc,
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
 * This will throw an error if there is no token for the given ID.
 *
 * @param id - The ID of the listing to get the token for
 * @returns The token associated with the specified ID.
 * @throws 404 error from pouch if not found
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
 * Fetches the listings and looks for any listing which has a token
 * @returns Unparsed, unvalidated JWT
 */
export const getAnyToken = async (): Promise<JWTTokenInfo | undefined> => {
  // Get listings
  const listings = await getListings();

  // If there is an entry, use first
  for (const listing of listings) {
    try {
      const possibleToken = await getToken(listing._id);
      if (possibleToken !== undefined) {
        return possibleToken;
      }
    } catch {
      continue;
    }
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
  // fetch the projects but guard against being offline and this failing
  const response = await fetch(`${url}/api/directory`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }).catch(() => null);

  if (response && response.ok) {
    return (await response.json()) as ProjectObject[];
  } else {
    console.error(`Error fetching projects from ${url}`);
    return [] as ProjectObject[];
  }
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

/**
 * Converts an array of projects into a Map where each project's ID is the key, and the project object is the value.
 *
 * @param {ProjectExtended[]} projects - An array of project objects with unique IDs.
 * @returns {Map<string, ProjectExtended>} A Map with project IDs as keys and project objects as values.
 */
export const getProjectMap = (projects: ProjectExtended[]) =>
  new Map(projects.map(project => [project._id, project]));

/**
 * Retrieves the locally active projects from the active database.
 */
export const getLocalActiveMap = async () => {
  const locallyActive = await active_db.allDocs({include_docs: true});
  const localActiveMap = new Map<
    string,
    {sync: boolean; sync_attachments: boolean}
  >();
  if (locallyActive.rows.length > 0) {
    locallyActive.rows.forEach(record => {
      const project = record.doc as ExistingActiveDoc;
      localActiveMap.set(project.project_id, {
        sync: project.is_sync,
        sync_attachments: project.is_sync_attachments,
      });
    });
  }
  return localActiveMap;
};
