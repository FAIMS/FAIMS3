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

import {
  ExistingInvitesDBDocument,
  InvitesDBFields,
  NewInvitesDBDocument,
  NonUniqueProjectID,
  ProjectID,
  Role,
  writeNewDocument,
} from '@faims3/data-model';
import {getInvitesDB} from '.';
import {CONDUCTOR_SHORT_CODE_PREFIX} from '../buildconfig';

/**
 * Create an invite for this project and role if there isn't already
 * one.  If it already exists, return it.
 * @param projectId Project identifier
 * @param role Project role
 * @returns A RoleInvite object
 */
export async function createInvite(
  projectId: NonUniqueProjectID,
  role: Role
): Promise<NewInvitesDBDocument> {
  const existing = (
    await getInvitesDB().query<InvitesDBFields>('indexes/byProjectAndRole', {
      key: [projectId, role],
      include_docs: true,
    })
  ).rows
    .map(r => r.doc)
    .filter(d => !!d);

  if (existing.length === 0) {
    // make a new one
    const invite: InvitesDBFields = {
      projectId: projectId,
      role: role,
    };
    return await writeNewInvite(invite);
  } else {
    return existing[0];
  }
}

/**
 * Generate a short code identifier suitable for an invite, may not
 * be unique.
 * @returns a six character identifier
 */
function generateInviteId() {
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
 * Store an invite, ensure that the identifier is unique.
 * @param invite An invite object
 * @returns The invite, possibly with a new identifier
 */
export async function writeNewInvite(invite: InvitesDBFields) {
  // get the invites DB
  const inviteDb = getInvitesDB();

  // just be careful here - we don't want infinite loops if something else is
  // going on
  const maxCount = 5;
  let count = 0;

  // Build our document with ID
  let doc: NewInvitesDBDocument = {...invite, _id: generateInviteId()};

  // This could throw in case of other DB errors - but should happen
  while (count < maxCount) {
    const res = await writeNewDocument({db: inviteDb, data: doc});
    if (res.wrote) {
      return doc;
    } else {
      count = count + 1;
      doc._id = generateInviteId();
    }
  }

  throw new Error(
    'Reached the maximum number of retries at generating unique invites! Consider a more durable/unique ID generation function or clear out the invites database. Cannot safely proceed.'
  );
}

export async function deleteInvite(invite: NewInvitesDBDocument) {
  const inviteDb = getInvitesDB();
  // get the invite from the db to ensure we have the most recent revision
  const fetched = await getInvite(invite._id);
  if (fetched) {
    await inviteDb.put({
      ...fetched,
      _deleted: true,
    });
    return fetched;
  } else {
    throw Error('Unable to find invite in database to delete');
  }
}

export async function getInvite(
  inviteId: string
): Promise<null | ExistingInvitesDBDocument> {
  const inviteDb = getInvitesDB();
  try {
    return await inviteDb.get(inviteId);
  } catch {
    // invite not found
    return null;
  }
}

export async function getInvitesForNotebook(
  projectId: ProjectID
): Promise<ExistingInvitesDBDocument[]> {
  const invite_db = getInvitesDB();
  if (invite_db) {
    const result = await invite_db.find({
      selector: {projectId: {$eq: projectId}},
    });
    return result.docs as ExistingInvitesDBDocument[];
  } else {
    throw Error('Unable to connect to invites database');
  }
}
