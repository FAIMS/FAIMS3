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
import {jwtVerify, importSPKI} from 'jose';
import type {KeyLike} from 'jose';

import {CLUSTER_ADMIN_GROUP_NAME} from './buildconfig';
import {active_db, directory_db, local_auth_db} from './sync/databases';
import {
  ClusterProjectRoles,
  ProjectID,
  ProjectRole,
  split_full_project_id,
  TokenInfo,
  TokenContents,
} from './datamodel/core';
import {AuthInfo} from './datamodel/database';

interface SplitCouchDBRole {
  project_id: ProjectID;
  project_role: ProjectRole;
}

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
    const doc = {
      _id: cluster_id,
      token: token,
      pubkey: pubkey,
      pubalg: pubalg,
    };
    console.debug('Token info is:', doc);
    await local_auth_db.put(doc);
  } catch (err: any) {
    if (err.status === 409) {
      try {
        const _rev = (await local_auth_db.get(cluster_id))._rev;
        await local_auth_db.put({
          _id: cluster_id,
          _rev: _rev,
          token: token,
          pubkey: pubkey,
          pubalg: pubalg,
        });
      } catch (err_conflict) {
        console.warn(
          'Failed to set token when conflicting for',
          cluster_id,
          err_conflict
        );
        throw Error(`Failed to set token when conflicting for: ${cluster_id}`);
      }
    } else {
      console.warn('Failed to set token for', cluster_id, err);
      throw Error(`Failed to set token for: ${cluster_id}`);
    }
  }
}

export async function getTokenForCluster(
  cluster_id: string
): Promise<string | undefined> {
  try {
    const doc = await local_auth_db.get(cluster_id);
    return doc.token;
  } catch (err) {
    console.warn('Token not found for:', cluster_id, err);
    return undefined;
  }
}

export async function deleteTokenForCluster(cluster_id: string) {
  try {
    const doc = await local_auth_db.get(cluster_id);
    await local_auth_db.remove(doc);
  } catch (err) {
    console.warn('Token not deleted for:', cluster_id, err);
  }
}

export async function getTokenInfoForCluster(
  cluster_id: string
): Promise<TokenInfo | undefined> {
  try {
    const doc = await local_auth_db.get(cluster_id);
    const pubkey = await importSPKI(doc.pubkey, doc.pubalg);
    return {
      token: doc.token,
      pubkey: pubkey,
    };
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
  return await parseToken(token_info.token, token_info.pubkey);
}

export async function getAuthMechianismsForListing(
  listing_id: string
): Promise<{[name: string]: AuthInfo} | null> {
  try {
    const doc = await directory_db.local.get(listing_id);
    return doc.auth_mechanisms;
  } catch (err) {
    console.warn('AuthInfo not found for:', listing_id, err);
    return null;
  }
}

export async function parseToken(
  token: string,
  pubkey: KeyLike
): Promise<TokenContents | undefined> {
  const res = await jwtVerify(token, pubkey);
  const payload = res.payload;
  console.debug('Token payload is:', payload);
  const username = payload.sub ?? undefined;
  if (username === undefined) {
    return undefined;
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
