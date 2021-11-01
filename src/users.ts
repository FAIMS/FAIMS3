/*
 * Copyright 2021 Macquarie University
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
 *   TODO
 */

import {active_db, local_auth_db} from './sync/databases';
import {ProjectID} from './datamodel/core';

export async function getFriendlyUserName(
  project_id: ProjectID
): Promise<string> {
  const doc = await active_db.get(project_id);
  if (doc.friendly_name === undefined) {
    return doc.username || 'Dummy User';
  }
  return doc.friendly_name;
}

export async function getCurrentUserId(project_id: ProjectID): Promise<string> {
  const doc = await active_db.get(project_id);
  return doc.username || 'Dummy User';
}

export async function setTokenForCluster(token: string, cluster_id: string) {
  try {
    await local_auth_db.put({_id: cluster_id, token: token});
  } catch (err) {
    console.warn(err);
    throw Error(`Failed to set token for: ${cluster_id}`);
  }
}

export async function getTokenForCluster(
  cluster_id: string
): Promise<string | null> {
  try {
    return await local_auth_db.get(cluster_id);
  } catch (err) {
    console.debug(err);
    console.warn('Token not found for:', cluster_id);
    return null;
  }
}
