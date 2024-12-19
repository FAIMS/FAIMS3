import {
  active_db,
  directory_db_pouch,
  ExistingActiveDoc,
} from '../sync/databases';
import {ProjectObject, resolve_project_id} from '@faims3/data-model';
import {ProjectExtended} from '../types/project';
import {
  getServerConnection,
  selectActiveUser,
  selectAllServerUsers,
  selectSpecificServer,
  TokenInfo,
} from './slices/authSlice';
import {store} from './store';

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
 * @param serverId - The ID of the listing to get the token for
 * @returns The token associated with the specified ID.
 * @throws 404 error from pouch if not found
 */
export const getToken = (serverId: string): TokenInfo | undefined => {
  // TODO this is stupid because we are just guessing which 'user' we should use
  // to make the request - unless we want to track active users across both
  // listings and globally, then this is just going to take the first one
  const serverUsers = selectSpecificServer(store.getState(), serverId);
  const keys = Object.keys(serverUsers);
  const jwt_token = keys.length > 0 ? serverUsers[keys[0]] : null;
  if (!jwt_token) {
    console.error(
      'Could not get token for listing with ID: ',
      serverId,
      'This logic is highly suspect!'
    );
    return undefined;
  }
  return jwt_token;
};

/**
 * Fetches the listings and looks for any listing which has a token
 * @returns Unparsed, unvalidated JWT
 */
export const getAnyToken = (): Omit<TokenInfo, 'expiresAt'> | undefined => {
  const state = store.getState();
  const activeUser = selectActiveUser(state);
  const serverUsers = selectAllServerUsers(state);

  // First try getting the active token
  if (activeUser) {
    return activeUser;
  }

  // Otherwise try getting any - ask for first one
  if (serverUsers.length > 0) {
    // get targeted info
    return getServerConnection({state, ...serverUsers[0]});
  } else {
    return undefined;
  }
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
