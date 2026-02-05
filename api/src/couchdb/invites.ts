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
  InvitesDBDocument,
  InvitesDBFields,
  PeopleDBDocument,
  Resource,
  Role,
  RoleScope,
  addGlobalRole,
  addProjectRole,
  addTeamRole,
  roleDetails,
  safeWriteDocument,
  writeNewDocument,
} from '@faims3/data-model';
import {getInvitesDB} from '.';
import {CONDUCTOR_SHORT_CODE_PREFIX} from '../buildconfig';
import * as Exceptions from '../exceptions';

// Default 30 days expiry
export const DEFAULT_INVITE_EXPIRY = 30 * 24 * 60 * 60 * 1000;

/**
 * Create an invite for a resource and role if one doesn't already exist.
 * If it already exists, return the existing invite.
 *
 * @param {Object} params - The parameters for creating the invite
 * @param {Resource.TEAM | Resource.PROJECT} params.resourceType - Type of resource (team or project)
 * @param {string} params.resourceId - ID of the resource
 * @param {Role} params.role - Role to grant
 * @param {string} params.name - Name/purpose of the invite
 * @param {string} params.createdBy - User ID of the creator
 * @param {number} [params.expiry] - Timestamp when invite expires
 * @param {number} [params.usesOriginal] - Maximum number of times invite can be used (infinite if undefined)
 * @returns {Promise<ExistingInvitesDBDocument>} The invite document
 */
export async function createResourceInvite({
  resourceType,
  resourceId,
  role,
  name,
  createdBy,
  expiry = Date.now() + DEFAULT_INVITE_EXPIRY,
  usesOriginal,
}: {
  resourceType: Resource.TEAM | Resource.PROJECT;
  resourceId: string;
  role: Role;
  name: string;
  createdBy: string;
  expiry?: number;
  usesOriginal?: number;
}): Promise<ExistingInvitesDBDocument> {
  // Confirm that the role is a resource specific role
  const roleDetail = roleDetails[role];
  if (roleDetail.scope !== RoleScope.RESOURCE_SPECIFIC) {
    throw new Exceptions.InvalidRequestException(
      'Role must be a resource specific role to create a resource specific invite'
    );
  }

  // Create a new invite
  const invite: InvitesDBFields = {
    resourceType,
    resourceId,
    inviteType: RoleScope.RESOURCE_SPECIFIC,
    role,
    name,
    createdBy,
    createdAt: Date.now(),
    expiry,
    usesOriginal,
    usesConsumed: 0,
    uses: [],
  };
  return await writeNewInvite(invite);
}

/**
 * Create an invite for a resource and role if one doesn't already exist.
 * If it already exists, return the existing invite.
 *
 * @param {Object} params - The parameters for creating the invite
 * @param {Role} params.role - Role to grant
 * @param {string} params.name - Name/purpose of the invite
 * @param {string} params.createdBy - User ID of the creator
 * @param {number} [params.expiry] - Timestamp when invite expires
 * @param {number} [params.usesOriginal] - Maximum number of times invite can be used (infinite if undefined)
 * @returns {Promise<ExistingInvitesDBDocument>} The invite document
 */
export async function createGlobalInvite({
  role,
  name,
  createdBy,
  expiry = Date.now() + DEFAULT_INVITE_EXPIRY,
  usesOriginal,
}: {
  role: Role;
  name: string;
  createdBy: string;
  expiry?: number;
  usesOriginal?: number;
}): Promise<ExistingInvitesDBDocument> {
  // Confirm that the role is a global role
  const roleDetail = roleDetails[role];
  if (roleDetail.scope !== RoleScope.GLOBAL) {
    throw new Exceptions.InvalidRequestException(
      'Role must be a global role to create a global invite'
    );
  }

  // Create a new invite
  const invite: InvitesDBFields = {
    inviteType: RoleScope.GLOBAL,
    role,
    name,
    createdBy,
    createdAt: Date.now(),
    expiry,
    usesOriginal,
    usesConsumed: 0,
    uses: [],
  };
  return await writeNewInvite(invite);
}

/**
 * Generate a short code identifier suitable for an invite.
 * May not be unique - uniqueness is handled by writeNewInvite.
 *
 * @returns {string} A six character identifier prefixed by the system code
 */
function generateInviteId(): string {
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
 * Store an invite, ensuring that the identifier is unique.
 * Will retry with new IDs if a collision occurs.
 *
 * @param {InvitesDBFields} invite - The invite data to store
 * @returns {Promise<ExistingInvitesDBDocument>} The saved invite document
 * @throws {Error} If maximum retry count is reached
 */
export async function writeNewInvite(
  invite: InvitesDBFields
): Promise<ExistingInvitesDBDocument> {
  // Get the invites DB
  const inviteDb = getInvitesDB();

  // Prevent infinite loops if something else is going on
  const maxCount = 5;
  let count = 0;

  // Build our document with ID
  const doc: InvitesDBDocument = {...invite, _id: generateInviteId()};

  // Try to write with unique ID, retry if collision occurs
  while (count < maxCount) {
    const res = await writeNewDocument({db: inviteDb, data: doc});
    if (res.wrote) {
      return {...doc, _rev: res._rev};
    } else {
      count = count + 1;
      doc._id = generateInviteId();
    }
  }

  throw new Error(
    'Reached the maximum number of retries at generating unique invites! Consider a more durable/unique ID generation function or clear out the invites database. Cannot safely proceed.'
  );
}

/**
 * Delete an invite from the database.
 *
 * @param {Object} params - The parameters for deleting the invite
 * @param {ExistingInvitesDBDocument} params.invite - The invite document to delete
 * @returns {Promise<ExistingInvitesDBDocument>} The deleted invite document
 * @throws {Error} If the invite cannot be found
 */
export async function deleteInvite({
  invite,
}: {
  invite: ExistingInvitesDBDocument;
}): Promise<ExistingInvitesDBDocument> {
  const inviteDb = getInvitesDB();
  // Get the invite from the db to ensure we have the most recent revision
  const fetched = await getInvite({inviteId: invite._id});
  if (fetched) {
    await inviteDb.remove({
      ...fetched,
    });
    return fetched;
  } else {
    throw Error('Unable to find invite in database to delete');
  }
}

/**
 * Retrieve an invite by its ID.
 *
 * @param {Object} params - The parameters for retrieving the invite
 * @param {string} params.inviteId - The ID of the invite to retrieve
 * @returns {Promise<ExistingInvitesDBDocument | null>} The invite document if found, null otherwise
 */
export async function getInvite({
  inviteId,
}: {
  inviteId: string;
}): Promise<ExistingInvitesDBDocument | null> {
  const inviteDb = getInvitesDB();
  try {
    return await inviteDb.get(inviteId);
  } catch {
    // Invite not found
    return null;
  }
}

/**
 * Record usage of an invite by a user.
 *
 * Also checks for validity (though you should do this prior to calling this
 * function)
 *
 * NOTE: DOES NOT save the user - that is the responsibility of the caller - so as to
 * enable efficiently managing this save point/transaction
 *
 * @param {Object} params - The parameters for recording invite usage
 * @param {ExistingInvitesDBDocument} params.invite - The invite document
 * @param {string} params.userId - ID of the user using the invite
 * @returns {Promise<ExistingInvitesDBDocument>} The updated invite document
 * @throws {Error} If the invite has expired or exceeded usage limits
 */
export async function consumeInvite({
  invite,
  user,
}: {
  invite: ExistingInvitesDBDocument;
  user: PeopleDBDocument;
}): Promise<ExistingInvitesDBDocument> {
  const now = Date.now();

  const {isValid, reason} = isInviteValid({invite});
  if (!isValid) {
    throw new Error(
      'This invite is invalid, reason: ' + (reason ?? 'Unspecified.')
    );
  }

  // Update the invite with the new usage
  const updatedInvite: ExistingInvitesDBDocument = {
    ...invite,
    usesConsumed: invite.usesConsumed + 1,
    uses: [
      ...invite.uses,
      {
        userId: user._id,
        usedAt: now,
      },
    ],
  };

  // Save the updated invite
  const inviteDb = getInvitesDB();
  const result = await safeWriteDocument({
    db: inviteDb,
    data: updatedInvite,
  });

  // Now grant the associated role
  if (invite.inviteType === RoleScope.GLOBAL) {
    addGlobalRole({user, role: invite.role});
  } else if (invite.resourceId && invite.resourceType === Resource.TEAM) {
    addTeamRole({user, role: invite.role, teamId: invite.resourceId});
  } else if (invite.resourceId && invite.resourceType === Resource.PROJECT) {
    addProjectRole({user, role: invite.role, projectId: invite.resourceId});
  } else {
    throw new Exceptions.InternalSystemError(
      'No invite target for resource type: ' + invite.resourceType
    );
  }

  return {
    ...updatedInvite,
    // This will be defined when writeOnClash = true (as default)
    _rev: result!.rev,
  };
}

/**
 * Get all invites for a specific resource.
 *
 * @param {Object} params - The parameters for retrieving invites
 * @param {Resource.TEAM | Resource.PROJECT} params.resourceType - Type of resource
 * @param {string} params.resourceId - ID of the resource
 * @returns {Promise<ExistingInvitesDBDocument[]>} Array of invite documents
 * @throws {Error} If unable to connect to the invites database
 */
export async function getInvitesForResource({
  resourceType,
  resourceId,
}: {
  resourceType: Resource.TEAM | Resource.PROJECT;
  resourceId: string;
}): Promise<ExistingInvitesDBDocument[]> {
  const inviteDb = getInvitesDB();
  if (inviteDb) {
    const result = await inviteDb.find({
      selector: {
        resourceType: {$eq: resourceType},
        resourceId: {$eq: resourceId},
      },
    });
    return result.docs as ExistingInvitesDBDocument[];
  } else {
    throw Error('Unable to connect to invites database');
  }
}

/**
 * Get all global invites
 *
 * @returns {Promise<ExistingInvitesDBDocument[]>} Array of invite documents
 * @throws {Error} If unable to connect to the invites database
 */
export async function getGlobalInvites(): Promise<ExistingInvitesDBDocument[]> {
  const inviteDb = getInvitesDB();
  if (inviteDb) {
    const result = await inviteDb.find({
      selector: {
        inviteType: {$eq: RoleScope.GLOBAL},
      },
    });
    return result.docs as ExistingInvitesDBDocument[];
  } else {
    throw Error('Unable to connect to invites database');
  }
}

/**
 * Check if an invite is valid (not expired and not exceeded usage limits).
 *
 * @param {Object} params - The parameters for checking invite validity
 * @param {ExistingInvitesDBDocument} params.invite - The invite document to check
 * @returns {Object} Object containing validity status and reason if invalid
 */
export function isInviteValid({invite}: {invite: ExistingInvitesDBDocument}): {
  isValid: boolean;
  reason?: string;
} {
  const now = Date.now();

  if (invite.expiry < now) {
    return {
      isValid: false,
      reason: 'Invite has expired',
    };
  }

  if (
    invite.usesOriginal !== undefined &&
    invite.usesConsumed >= invite.usesOriginal
  ) {
    return {
      isValid: false,
      reason: 'Invite has been used the maximum number of times',
    };
  }

  return {
    isValid: true,
  };
}
