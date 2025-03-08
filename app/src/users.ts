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
  TokenContents,
} from '@faims3/data-model';
import {CLUSTER_ADMIN_GROUP_NAME, IGNORE_TOKEN_EXP} from './buildconfig';

interface SplitCouchDBRole {
  project_id: ProjectID;
  project_role: ProjectRole;
}

// These are the roles which allow a user to create a notebook
export const CREATE_NOTEBOOK_ROLES = [
  CLUSTER_ADMIN_GROUP_NAME,
  NOTEBOOK_CREATOR_GROUP_NAME,
];

/**
 * Decodes JWT ready for use in app.
 *
 * NOTE: This does not validate the token. This does not check expiry. Decodes
 * the token and puts into TokenContents.
 *
 * NOTE: If IGNORE_TOKEN_EXP = true, then the exp is spoofed
 *
 * @param token The raw JWT
 * @returns The parsed token as a TokenContents object
 */
export function parseToken(token: string): TokenContents {
  const payload = decodeJwt(token);

  const username = payload.sub ?? undefined;

  // Either interpret exp from the JWT or if the backwards compatibility build
  // flag is used, will spoof an expiry one year from now.
  let exp: number | undefined = undefined;
  if (IGNORE_TOKEN_EXP) {
    // a year from now
    exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365;
  } else {
    exp = payload.exp;
  }

  const server = payload['server'] as string | undefined;

  // These are all required
  if (!exp) {
    console.error('Cannot accept a JWT which has no exp field defined.');
    throw new Error('Cannot accept a JWT which has no exp field defined.');
  }
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
    exp,
  };
}

export function getUserProjectRolesForCluster(
  contents: TokenContents
): ClusterProjectRoles {
  const couch_roles = contents.roles;
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
export function isClusterAdmin(contents: TokenContents): boolean {
  const couch_roles = contents.roles;
  return couch_roles.includes(CLUSTER_ADMIN_GROUP_NAME);
}

export async function shouldDisplayRecord({
  contents,
  recordMetadata: record_metadata,
  projectId,
}: {
  contents: TokenContents;
  projectId: string;
  recordMetadata: RecordMetadata;
}): Promise<boolean> {
  // TODO - consider the context in which this is being run - should only be
  // active user notebooks!
  // TODO understand why this is coming through as a full project instead of just project id

  // TODO this should not be on a per row basis - it's the same for all of them
  // (facepalm)
  const user_id = contents.username;

  // Always display your own records
  if (record_metadata.created_by === user_id) {
    return true;
  }

  // If you are admin (of cluster) then you can see all responses
  const isAdmin = isClusterAdmin(contents);

  if (isAdmin) {
    return true;
  }

  // Get roles
  const roles = getUserProjectRolesForCluster(contents);
  for (const currentProjectId of Object.keys(roles)) {
    if (
      currentProjectId === projectId &&
      // TODO BSS-453 consider how we handle this
      // This currently hard-codes admin as a special role which allows visibility of all records but
      // a) why is this necessary on client side?
      // b) isn't this configurable in the notebook designer?
      roles[currentProjectId].includes('admin')
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Check whether the current user can create notebooks on a server
 *
 * @param cluster_id - the cluster identifier
 * @returns true if the user is allowed to create notebooks
 */
export function userCanCreateNotebooks(contents: TokenContents) {
  const couch_roles = contents.roles;

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
