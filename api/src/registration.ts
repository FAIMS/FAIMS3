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
 * Filename: src/registration.ts
 * Description:
 *   Handle registration of new users via invites
 */

import {RoleInvite, ConductorRole} from './datamodel/users';
import {addProjectRoleToUser, saveUser} from './couchdb/users';
import {saveInvite, deleteInvite} from './couchdb/invites';
import {CLUSTER_ADMIN_GROUP_NAME} from './buildconfig';

export function userCanAddOtherRole(user: Express.User | undefined): boolean {
  if (user === undefined) {
    return false;
  }
  if (user.other_roles.includes(CLUSTER_ADMIN_GROUP_NAME)) {
    return true;
  }
  return false;
}

export function userCanRemoveOtherRole(
  user: Express.User | undefined,
  role: ConductorRole
): boolean {
  if (user === undefined) {
    return false;
  }
  if (
    user.other_roles.includes(CLUSTER_ADMIN_GROUP_NAME) &&
    role !== CLUSTER_ADMIN_GROUP_NAME
  ) {
    return true;
  }
  return false;
}

export async function acceptInvite(user: Express.User, invite: RoleInvite) {
  addProjectRoleToUser(user, invite.project_id, invite.role);
  await saveUser(user);

  if (!invite.unlimited) {
    invite.number--;
    if (invite.number === 0) {
      await deleteInvite(invite);
    } else {
      await saveInvite(invite);
    }
  }
}

export async function rejectInvite(invite: RoleInvite) {
  //await deleteInvite(invite);
  console.log('rejecting', invite);
}
