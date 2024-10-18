/*
 * Copyright 2021, 2022 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: users.ts
 * Description:
 *   This contains the user/visibility control subsystem, and management/storage
 *   of access tokens. This does not do access control (as that must be handled
 *   by couchdb).but instead tries to avoid exposing information to keep users
 *   on the happy path of not seeing access denied, or at least in ways the GUI
 *   can meaningfully handle.
 */
import {decodeJwt} from 'jose';

import {
  ClusterProjectRoles,
  NOTEBOOK_CREATOR_GROUP_NAME,
  ProjectID,
  ProjectRole,
  RecordMetadata,
  split_full_project_id,
  TokenContents,
} from '@faims3/data-model';
import {CLUSTER_ADMIN_GROUP_NAME} from './buildconfig';
import {logError} from './logging';
import {
  JWTTokenInfo,
  JWTTokenMap,
  local_auth_db,
  LocalAuthDoc,
} from './sync/databases';
import {reprocess_listing} from './sync/process-initialization';
import {PossibleToken} from './types/misc';
import {iteratorTakeOne} from './utils/helpers';

interface SplitCouchDBRole {
  project_id: ProjectID;
  project_role: ProjectRole;
}

interface TokenInfo {
  token: string;
}

/**
 * Get the current logged in user identifier for this project
 *  - used in two places:
 *    - when we add a record, to fill the `updated_by` field
 *    - when we delete a record, to store in the `created_by` field of the deleted revision
 * @param project_id current project identifier
 * @returns a promise resolving to the user identifier
 */
export async function getCurrentUserId(project_id: ProjectID): Promise<string> {
  // look in the stored token for the project's server, this will
  // get the current logged in username
  const token_contents = await getTokenContentsForCluster(
    split_full_project_id(project_id).listing_id
  );
  // otherwise we don't know who this is (probably should not happen given the callers)
  if (token_contents === undefined) {
    return 'Anonymous User';
  }
  return token_contents.username;
}

/**
 * Store a token for a server (cluster)
 * @param token new authentication token
 * @param cluster_id server identifier that this token is for
 */
export async function setTokenForCluster(token: string, cluster_id: string) {
  if (token === undefined) throw Error('Token undefined in setTokenForCluster');

  // Firstly, try and parse the token
  const parsedToken = await parseToken(token);

  // Then see if we have a doc -> return null if get throws
  const doc = await local_auth_db.get(cluster_id).catch(() => null);
  const newDoc = await addTokenToDoc(token, parsedToken, cluster_id, doc);

  try {
    await local_auth_db.put(newDoc);
  } catch (err_conflict) {
    console.error(
      'Failed to set token when conflicting for',
      cluster_id,
      err_conflict
    );
    throw Error(`Failed to set token when conflicting for: ${cluster_id}`);
  }
}

/**
 * Add a token to an auth object or create a new one
 * @param token auth token
 * @param cluster_id server identifier
 * @param current_doc current auth doc if any
 * @returns a promise resolving to a new or updated auth document
 */
async function addTokenToDoc(
  token: string,
  parsedToken: TokenContents,
  cluster_id: string,
  current_doc: LocalAuthDoc | null
): Promise<LocalAuthDoc> {
  const new_username = parsedToken.username;
  if (current_doc === null) {
    const available_tokens: JWTTokenMap = new Map([]);
    available_tokens.set(new_username, {
      token,
      parsedToken,
    });
    return {
      _id: cluster_id,
      available_tokens: available_tokens,
      current_username: new_username,
    };
  }
  current_doc.current_username = new_username;
  current_doc.available_tokens.set(new_username, {
    token,
    parsedToken,
  });
  return current_doc;
}

async function removeTokenFromDoc(
  username: string,
  current_doc: LocalAuthDoc
): Promise<LocalAuthDoc | null> {
  if (current_doc.available_tokens.get(username) === undefined) {
    throw Error(`${username} is not in doc`);
  }
  if (current_doc.available_tokens.size < 2) {
    // Removing last user results in an empty doc
    return null;
  }
  current_doc.available_tokens.delete(username);
  if (current_doc.current_username === username) {
    // Choose first username if removed user is current user
    current_doc.current_username = iteratorTakeOne(
      current_doc.available_tokens.keys()
    )!;
  }
  return current_doc;
}

export async function getTokenForCluster(
  cluster_id: string
): Promise<string | undefined> {
  try {
    const doc = await local_auth_db.get(cluster_id);
    return doc.available_tokens.get(doc.current_username)?.token;
  } catch (err) {
    return undefined;
  }
}

export async function forgetUserToken(username: string, cluster_id: string) {
  try {
    const doc = await local_auth_db.get(cluster_id);
    const new_doc = await removeTokenFromDoc(username, doc);
    if (new_doc === null) {
      await deleteAllTokensForCluster(cluster_id);
    } else {
      await local_auth_db.put(new_doc);
    }
  } catch (err) {
    console.debug('Failed to forget token for', username, cluster_id, err);
  }
}

export async function forgetCurrentToken(cluster_id: string) {
  try {
    const doc = await local_auth_db.get(cluster_id);
    const username = doc.current_username;
    const new_doc = await removeTokenFromDoc(username, doc);
    if (new_doc === null) {
      await deleteAllTokensForCluster(cluster_id);
    } else {
      await local_auth_db.put(new_doc);
    }
  } catch (err) {
    console.debug('Failed to forget token for', cluster_id, err);
  }
}

export async function switchUsername(cluster_id: string, new_username: string) {
  console.debug('Switching user to ', new_username, cluster_id);
  try {
    const doc = await local_auth_db.get(cluster_id);
    doc.current_username = new_username;
    await local_auth_db.put(doc);
    reprocess_listing(cluster_id);
  } catch (err) {
    // console.debug('Failed to switch user for', new_username, cluster_id, err);
    logError(err);
  }
}

export async function getCurrentUsername(cluster_id: string): Promise<string> {
  const doc = await local_auth_db.get(cluster_id);
  return doc.current_username;
}

export async function getAllParsedTokensForCluster(
  cluster_id: string
): Promise<JWTTokenInfo[]> {
  const token_contents = [];
  let doc;
  try {
    doc = await local_auth_db.get(cluster_id);
  } catch (e) {
    console.error(
      'Failed to get all token info from DB. Cluster ID record probalby not present.',
      e
    );
    return [];
  }

  return Array.from(doc.available_tokens.values());
}

export async function getAllUsernamesForCluster(
  cluster_id: string
): Promise<string[]> {
  const tokens = await getAllParsedTokensForCluster(cluster_id);
  return tokens.map(({parsedToken}) => parsedToken.username);
}

export async function deleteAllTokensForCluster(cluster_id: string) {
  try {
    const doc = await local_auth_db.get(cluster_id);
    await local_auth_db.remove(doc);
  } catch (err) {
    console.warn('Token not deleted for:', cluster_id, err);
  }
}

async function getTokenInfoForCluster(
  cluster_id: string
): Promise<JWTTokenInfo | undefined> {
  try {
    const doc = await local_auth_db.get(cluster_id);
    const username = doc.current_username;
    return doc.available_tokens.get(username);
  } catch (err) {
    return undefined;
  }
}

/**
 * Get the content of the current auth token for a server
 *   - used in UI login panel to get username, roles etc.
 * @param cluster_id server identity
 * @returns Expanded contents of the current auth token
 */
export async function getTokenContentsForCluster(
  cluster_id: string
): Promise<PossibleToken> {
  return (await getTokenInfoForCluster(cluster_id))?.parsedToken;
}

/**
 * NOTE: This does not validate the token. This does not check expiry. Decodes
 * the token and puts into TokenContents.
 * @param token The raw JWT
 * @returns The parsed token as a TokenContents object
 */
export async function parseToken(token: string): Promise<TokenContents> {
  const payload = await decodeJwt(token);

  const username = payload.sub ?? undefined;
  const server = payload['server'] as string | undefined;
  if (!server) {
    throw Error('Server not specified in token');
  }
  if (username === undefined) {
    throw Error('Username not specified in token');
  }
  const roles = (payload['_couchdb.roles'] as string[]) ?? [];
  const name = (payload['name'] as string) ?? undefined;

  return {
    username: username,
    roles: roles,
    name: name,
    server: server,
  };
}

export async function getUserProjectRolesForCluster(
  cluster_id: string
): Promise<ClusterProjectRoles | undefined> {
  const token_contents = await getTokenContentsForCluster(cluster_id);
  if (token_contents === undefined) {
    return undefined;
  }

  const couch_roles = token_contents.roles;
  const cluster_project_roles: ClusterProjectRoles = {};

  for (const couch_role of couch_roles) {
    const split_role = splitCouchDBRole(couch_role);
    if (split_role === undefined) {
      continue;
    }
    if (cluster_project_roles[split_role.project_id] === undefined) {
      cluster_project_roles[split_role.project_id] = [];
    }
    cluster_project_roles[split_role.project_id].push(split_role.project_role);
  }
  return cluster_project_roles;
}

function splitCouchDBRole(couch_role: string): SplitCouchDBRole | undefined {
  const split_role = couch_role.split('||');
  if (
    split_role.length !== 2 ||
    split_role[0].trim() === '' ||
    split_role[1].trim() === ''
  ) {
    // This is likely a role like admin that couchdb handles, or at least is not
    // for access control within a project, so ignore it
    return undefined;
  }
  const cleaned_project_id = split_role[0].replace('\\|\\|', '||');
  return {
    project_id: cleaned_project_id,
    project_role: split_role[1],
  };
}

/**
 * Is the current user a cluster admin?
 * @param cluster_id server identifier
 * @returns true if the current user has cluster admin permissions
 */
export async function isClusterAdmin(cluster_id: string): Promise<boolean> {
  const token_contents = await getTokenContentsForCluster(cluster_id);
  if (token_contents === undefined) {
    return false;
  }

  const couch_roles = token_contents.roles;
  return couch_roles.includes(CLUSTER_ADMIN_GROUP_NAME);
}

export async function shouldDisplayProject(
  full_proj_id: ProjectID
): Promise<boolean> {
  const split_id = split_full_project_id(full_proj_id);
  const is_admin = await isClusterAdmin(split_id.listing_id);
  if (is_admin) {
    return true;
  }
  const roles = await getUserProjectRolesForCluster(split_id.listing_id);
  if (roles === undefined) {
    return false;
  }
  for (const role in roles) {
    if (role === split_id.project_id) {
      return true;
    }
  }
  return false;
}

export async function shouldDisplayRecord(
  full_proj_id: ProjectID,
  record_metadata: RecordMetadata
): Promise<boolean> {
  const split_id = split_full_project_id(full_proj_id);
  const user_id = await getCurrentUserId(full_proj_id);
  if (record_metadata.created_by === user_id) {
    return true;
  }
  const is_admin = await isClusterAdmin(split_id.listing_id);
  if (is_admin) {
    return true;
  }
  const roles = await getUserProjectRolesForCluster(split_id.listing_id);
  if (roles === undefined) {
    return false;
  }
  for (const role in roles) {
    if (
      role === split_id.project_id &&
      roles[role].includes(CLUSTER_ADMIN_GROUP_NAME)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Get a token for a logged in user if we have one
 *   - called in App.tsx to get an initial token for the app
 *  - if we're logged in to more than one server, just return one of the tokens
 *  - used to identify the user/whether we're logged in
 * @returns current login token for default server, if present
 */
export async function getTokenContentsForCurrentUser(): Promise<
  TokenContents | undefined
> {
  const docs = await local_auth_db.allDocs();
  if (docs.total_rows > 0) {
    const cluster_id = docs.rows[0].id;
    return getTokenContentsForCluster(cluster_id);
  }
}

export async function getClusterId(): Promise<string | undefined> {
  try {
    const docs = await local_auth_db.allDocs();
    if (docs.total_rows > 0) {
      return docs.rows[0].id; // Returns the cluster_id found
    }
    return undefined;
  } catch (error) {
    console.error('Error fetching cluster_id:', error);
    return undefined;
  }
}

/**
 * Check whether the current user can create notebooks on a server
 *
 * @param cluster_id - the cluster identifier
 * @returns true if the user is allowed to create notebooks
 */

export async function userCanCreateNotebooks(cluster_id: string) {
  const token_contents = await getTokenContentsForCluster(cluster_id);
  if (token_contents === undefined) {
    return undefined;
  }

  const couch_roles = token_contents.roles;

  // cluster admin can do anything
  if (couch_roles.indexOf(CLUSTER_ADMIN_GROUP_NAME) >= 0) {
    return true;
  }

  // explicit notebook creator permssions
  if (couch_roles.indexOf(NOTEBOOK_CREATOR_GROUP_NAME) >= 0) {
    return true;
  }
  return false;
}
