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

import {
  addProjectRole,
  InvitesDBFields,
  PeopleDBDocument,
} from '@faims3/data-model';
import {saveCouchUser} from './couchdb/users';

export async function acceptInvite(
  user: PeopleDBDocument,
  invite: InvitesDBFields
) {
  addProjectRole({user, projectId: invite.projectId, role: invite.role});
  await saveCouchUser(user);
}
