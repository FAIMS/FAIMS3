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

import {NonUniqueProjectID, ProjectID} from '@faims3/data-model';
import {getInvitesDB} from '.';
import {ConductorRole, RoleInvite} from '../datamodel/users';
import {CONDUCTOR_SHORT_CODE_PREFIX} from '../buildconfig';

/**
 * Create an invite for this project and role if there isn't already
 * one.  If it already exists, return it.
 * @param project_id Project identifier
 * @param role Project role
 * @returns A RoleInvite object
 */
export async function createInvite(
  project_id: NonUniqueProjectID,
  role: ConductorRole
) {
  // if there is already an invite for this role,
  // just return that
  const allInvites = await getInvitesForNotebook(project_id);
  const existing = allInvites.filter(
    i => i.project_id === project_id && i.role === role
  );

  if (existing.length === 0) {
    // make a new one
    const invite: RoleInvite = {
      _id: generateId(),
      project_id: project_id,
      role: role,
    };
    return await saveInvite(invite);
  } else {
    return existing[0];
  }
}

/**
 * Generate a short code identifier suitable for an invite, may not
 * be unique.
 * @returns a six character identifier
 */
function generateId() {
  const INVITE_LENGTH = 6;
  const chars = 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789';

  let ident = '';
  for (let i = 0; i < INVITE_LENGTH; i++) {
    const char = chars[Math.floor(Math.random() * chars.length)];
    ident = ident + char;
  }
  return CONDUCTOR_SHORT_CODE_PREFIX + '-' + ident;
}

/**
 * Store an invite, ensure that the identifier is unique
 * @param invite An invite object
 * @returns The invite, possibly with a new identifier
 */
export async function saveInvite(invite: RoleInvite) {
  const invite_db = getInvitesDB();
  if (invite_db) {
    let done = false;
    while (!done) {
      try {
        await invite_db.put(invite);
        done = true;
      } catch {
        invite._id = generateId();
      }
    }
    return invite;
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
