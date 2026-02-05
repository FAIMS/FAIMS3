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
 * Filename: src/datamodel/users.ts
 * Description:
 *   Data models related to users.
 */

import {Resource, Role, RoleScope} from '../../permission';
import {DatabaseInterface} from '../../types';

export type V1InviteDBFields = {
  // The project it refers to
  project_id: string;
  // Role (as untyped string - could be admin, team, user etc)
  role: string;
};

export type V2InviteDBFields = {
  // The project it refers to
  projectId: string;
  // Role (enum)
  role: Role;
};
export type V2InvitesDocument = PouchDB.Core.Document<V2InviteDBFields>;

export type V3InviteDBFields = {
  // What was the purpose of creating this invite?
  name: string;

  // What is the expiry timestamp
  expiry: number;

  // What type of resource is this invite for? (Currently supports teams and
  // surveys)
  resourceType: Resource.TEAM | Resource.PROJECT;

  // What type of resource is this invite for? (Currently supports teams and
  // surveys)
  resourceId: string;

  // What role should it grant?
  role: Role;

  // What is the ID of the user who created the invite?
  createdBy: string;

  // What is the ms timestamp when this was first created?
  createdAt: number;

  // How many uses were originally requested (optional -> infinite)
  usesOriginal?: number;

  // How many uses have been used (optional -> infinite)
  usesConsumed: number;

  // The log of user IDs for who have consumed this invite
  uses: {
    // Who
    userId: string;
    // When
    usedAt: number;
  }[];
};

export type V4InviteDBFields = {
  // What was the purpose of creating this invite?
  name: string;

  // What is the expiry timestamp
  expiry: number;

  // Is this a global or resource specific invite?
  inviteType: RoleScope;

  // What type of resource is this invite for? (Currently supports teams and
  // surveys), undefined for global invites
  resourceType?: Resource.TEAM | Resource.PROJECT;

  // What type of resource is this invite for? (Currently supports teams and
  // surveys), undefined for global invites
  resourceId?: string;

  // What role should it grant?
  role: Role;

  // What is the ID of the user who created the invite?
  createdBy: string;

  // What is the ms timestamp when this was first created?
  createdAt: number;

  // How many uses were originally requested (optional -> infinite)
  usesOriginal?: number;

  // How many uses have been used (optional -> infinite)
  usesConsumed: number;

  // The log of user IDs for who have consumed this invite
  uses: {
    // Who
    userId: string;
    // When
    usedAt: number;
  }[];
};

export type InvitesDBFields = V4InviteDBFields;
export type ExistingInvitesDBDocument =
  PouchDB.Core.ExistingDocument<InvitesDBFields>;
export type InvitesDBDocument = PouchDB.Core.Document<InvitesDBFields>;
export type InvitesDB = DatabaseInterface<InvitesDBFields>;
