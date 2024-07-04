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
import {jwtVerify, KeyLike, importSPKI} from 'jose';

import {CLUSTER_ADMIN_GROUP_NAME, BUILT_LOGIN_TOKEN} from './buildconfig';
import {
  LocalAuthDoc,
  JWTTokenInfo,
  JWTTokenMap,
  active_db,
  local_auth_db,
} from './sync/databases';
import {reprocess_listing} from './sync/process-initialization';
import {
  ClusterProjectRoles,
  ProjectID,
  ProjectRole,
  split_full_project_id,
  TokenContents,
} from 'faims3-datamodel';
import {LOCALLY_CREATED_PROJECT_PREFIX} from './sync/new-project';
import {RecordMetadata} from 'faims3-datamodel';
import {logError} from './logging';

interface SplitCouchDBRole {
  project_id: ProjectID;
  project_role: ProjectRole;
}

interface TokenInfo {
  token: string;
  pubkey: KeyLike;
}

export const ADMIN_ROLE = 'admin';

export async function getFriendlyUserName(
  project_id: ProjectID
): Promise<string> {
  const doc = await active_db.get(project_id);
  if (doc.friendly_name !== undefined) {
    return doc.friendly_name;
  }
  if (doc.username !== undefined && doc.username !== null) {
    return doc.username;
  }
  const token_contents = await getTokenContentsForCluster(
    split_full_project_id(project_id).listing_id
  );
  if (token_contents === undefined) {
    return 'Anonymous User';
  }
  return token_contents.name ?? token_contents.username;
}

export async function getCurrentUserId(project_id: ProjectID): Promise<string> {
  const doc = await active_db.get(project_id);
  if (doc.username !== undefined && doc.username !== null) {
    return doc.username;
  }
  const token_contents = await getTokenContentsForCluster(
    split_full_project_id(project_id).listing_id
  );
  if (token_contents === undefined) {
    return 'Anonymous User';
  }
  return token_contents.username;
}

export async function setTokenForCluster(
  token: string,
  pubkey: string,
  pubalg: string,
  cluster_id: string
) {
  try {
    const doc = await local_auth_db.get(cluster_id);
    const new_doc = await addTokenToDoc(token, pubkey, pubalg, cluster_id, doc);

    try {
      await local_auth_db.put(new_doc);
    } catch (err_conflict) {
      console.warn(
        'Failed to set token when conflicting for',
        cluster_id,
        err_conflict
      );
      throw Error(`Failed to set token when conflicting for: ${cluster_id}`);
    }
  } catch (err) {
    console.debug('Failed to get token when setting for', cluster_id, err);
    try {
      const doc = await addTokenToDoc(token, pubkey, pubalg, cluster_id, null);
      console.debug('Initial token info is:', doc);
      await local_auth_db.put(doc);
    } catch (err_initial: any) {
      console.warn('Failed to set initial token for', cluster_id, err_initial);
      throw Error(`Failed to set initial token for: ${cluster_id}`);
    }
  }
}

async function addTokenToDoc(
  token: string,
  pubkey: string,
  pubalg: string,
  cluster_id: string,
  current_doc: LocalAuthDoc | null
): Promise<LocalAuthDoc> {
  const new_username = await getUsernameFromToken(token, pubkey, pubalg);
  if (current_doc === null) {
    const available_tokens: JWTTokenMap = {};
    available_tokens[new_username] = {
      token,
      pubkey,
      pubalg,
    };
    return {
      _id: cluster_id,
      available_tokens: available_tokens,
      current_username: new_username,
    };
  }
  current_doc.current_username = new_username;
  current_doc.available_tokens[new_username] = {
    token,
    pubkey,
    pubalg,
  };
  return current_doc;
}

async function removeTokenFromDoc(
  username: string,
  current_doc: LocalAuthDoc
): Promise<LocalAuthDoc | null> {
  if (current_doc.available_tokens[username] === undefined) {
    throw Error(`${username} is not in doc`);
  }
  if (Object.keys(current_doc.available_tokens).length < 2) {
    // Removing last user results in an empty doc
    return null;
  }
  delete current_doc.available_tokens[username];
  if (current_doc.current_username === username) {
    // Choose first username if removed user is current user
    current_doc.current_username = Object.keys(current_doc.available_tokens)[0];
  }
  return current_doc;
}

export async function getTokenForCluster(
  cluster_id: string
): Promise<string | undefined> {
  try {
    const doc = await local_auth_db.get(cluster_id);
    return doc.available_tokens[doc.current_username].token;
  } catch (err) {
    console.warn('Token not found for:', cluster_id, err);
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

export async function getAllUsersForCluster(
  cluster_id: string
): Promise<TokenContents[]> {
  const token_contents = [];
  const doc = await local_auth_db.get(cluster_id);
  for (const token_details of Object.values(doc.available_tokens)) {
    const token_info = await getTokenInfoForSubDoc(token_details);
    token_contents.push(await parseToken(token_info.token, token_info.pubkey));
  }
  return token_contents;
}

export async function deleteAllTokensForCluster(cluster_id: string) {
  try {
    const doc = await local_auth_db.get(cluster_id);
    await local_auth_db.remove(doc);
  } catch (err) {
    console.warn('Token not deleted for:', cluster_id, err);
  }
}

async function getUsernameFromToken(
  token: string,
  pubkey: string,
  pubalg: string
): Promise<string> {
  const keyobj = await importSPKI(pubkey, pubalg);
  return (await parseToken(token, keyobj)).username;
}

async function getTokenInfoForSubDoc(
  token_details: JWTTokenInfo
): Promise<TokenInfo> {
  const pubkey = await importSPKI(token_details.pubkey, token_details.pubalg);
  return {
    token: token_details.token,
    pubkey: pubkey,
  };
}

async function getCurrentTokenInfoForDoc(
  doc: LocalAuthDoc
): Promise<TokenInfo> {
  const username = doc.current_username;
  // console.debug('Current username', username, doc);
  return await getTokenInfoForSubDoc(doc.available_tokens[username]);
}

export async function getTokenInfoForCluster(
  cluster_id: string
): Promise<TokenInfo | undefined> {
  try {
    const doc = await local_auth_db.get(cluster_id);
    return await getCurrentTokenInfoForDoc(doc);
  } catch (err) {
    console.warn('Token not found for:', cluster_id, err);
    return undefined;
  }
}

export async function getTokenContentsForCluster(
  cluster_id: string
): Promise<TokenContents | undefined> {
  const token_info = await getTokenInfoForCluster(cluster_id);
  if (token_info === undefined) {
    return undefined;
  }
  try {
    return await parseToken(token_info.token, token_info.pubkey);
  } catch (err: any) {
    console.debug(
      'Failed to parse token',
      token_info.token,
      token_info.pubkey,
      cluster_id
    );
    return undefined;
  }
}

async function parseToken(
  token: string,
  pubkey: KeyLike
): Promise<TokenContents> {
  const res = await jwtVerify(token, pubkey);
  const payload = res.payload;
  // if (DEBUG_APP) {
  //   console.debug('Token payload is:', payload);
  // }
  const username = payload.sub ?? undefined;
  if (username === undefined) {
    throw Error('Username not specified in token');
  }
  const roles = (payload['_couchdb.roles'] as string[]) ?? [];
  const name = (payload['name'] as string) ?? undefined;
  return {
    username: username,
    roles: roles,
    name: name,
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
  if (split_id.listing_id === LOCALLY_CREATED_PROJECT_PREFIX) {
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
  if (split_id.listing_id === LOCALLY_CREATED_PROJECT_PREFIX) {
    // console.info('See record as local project', record_metadata.record_id);
    return true;
  }
  if (record_metadata.created_by === user_id) {
    // console.info('See record as user created', record_metadata.record_id);
    return true;
  }
  const is_admin = await isClusterAdmin(split_id.listing_id);
  if (is_admin) {
    // console.info('See record as cluster admin', record_metadata.record_id);
    return true;
  }
  const roles = await getUserProjectRolesForCluster(split_id.listing_id);
  if (roles === undefined) {
    // console.info('Not see record as not in cluster', record_metadata.record_id);
    return false;
  }
  for (const role in roles) {
    if (role === split_id.project_id && roles[role].includes(ADMIN_ROLE)) {
      // console.info('See record as notebook admin', record_metadata.record_id);
      return true;
    }
  }
  // console.info('Not see record hit fallback', record_metadata.record_id);
  return false;
}

export async function getTokenContentsForRouting(): Promise<
  TokenContents | undefined
> {
  // TODO: We need to add more generic handling of user details and login state
  // here
  const CLUSTER_TO_CHECK = 'default';

  if (BUILT_LOGIN_TOKEN !== undefined) {
    const parsed_token = JSON.parse(BUILT_LOGIN_TOKEN);
    await setTokenForCluster(
      parsed_token.token,
      parsed_token.pubkey,
      parsed_token.pubalg,
      CLUSTER_TO_CHECK
    );
  }
  return await getTokenContentsForCluster(CLUSTER_TO_CHECK);
}
