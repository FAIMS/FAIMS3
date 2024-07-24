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
 * Filename: invites.ts
 * Description:
 *   Provide an interface for manipulating invites to the system
 */

import {NonUniqueProjectID, ProjectID} from 'faims3-datamodel';
import {getInvitesDB} from '.';
import {ConductorRole, RoleInvite} from '../datamodel/users';
import {v4 as uuidv4} from 'uuid';

export async function createInvite(
  user: Express.User,
  project_id: NonUniqueProjectID,
  role: ConductorRole,
  number: number
) {
  const invite: RoleInvite = {
    _id: uuidv4(),
    requesting_user: user.user_id,
    project_id: project_id,
    role: role,
    number: number,
    unlimited: number === 0,
  };
  await saveInvite(invite);
  return invite;
}

export async function saveInvite(invite: RoleInvite) {
  const invite_db = getInvitesDB();
  if (invite_db) {
    await invite_db.put(invite);
  } else {
    throw Error('Unable to connect to invites database');
  }
}

export async function deleteInvite(invite: RoleInvite) {
  const invite_db = getInvitesDB();
  if (invite_db) {
    // get the invite from the db to ensure we have the most recent revision
    const fetched = await getInvite(invite._id);
    if (fetched) {
      fetched._deleted = true;
      await invite_db.put(fetched);
      return fetched;
    } else {
      throw Error('Unable to find invite in database to delete');
    }
  } else {
    throw Error('Unable to connect to invites database');
  }
}

export async function getInvite(invite_id: string): Promise<null | RoleInvite> {
  const invite_db = getInvitesDB();
  if (invite_db) {
    try {
      return await invite_db.get(invite_id);
    } catch {
      // invite not found
      return null;
    }
  } else {
    throw Error('Unable to connect to invites database');
  }
}

export async function getInvitesForNotebook(
  project_id: ProjectID
): Promise<RoleInvite[]> {
  const invite_db = getInvitesDB();
  if (invite_db) {
    const result = await invite_db.find({
      selector: {project_id: {$eq: project_id}},
    });
    return result.docs as RoleInvite[];
  } else {
    throw Error('Unable to connect to invites database');
  }
}
