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

import {NonUniqueProjectID} from 'faims3-datamodel';
/*
 * This represents an arbitrary profile from an arbitrary service that where
 * information must be extracted. Specific services should use this internally,
 * or if they know exactly what the response is, use this type only when
 * interfacing with other systems which accept arbitrary profiles.
 */
export type UserServiceProfileUnlocked = any;
/*
 * This is used to pass around a user profile from an arbitrary service where
 * the details of the profile are *not* needed.
 */
export type UserServiceProfileLocked = unknown;

export type ServiceID = string;

export type UserServiceProfiles = {
  [ServiceID: string]: UserServiceProfileLocked;
};
export type CouchDBUsername = string;
export type CouchDBUserRole = string;
export type CouchDBUserRoles = CouchDBUserRole[];

export type Email = string;

export type ConductorRole = string;
export type AllProjectRoles = {[NonUniqueProjectID: string]: ConductorRole[]};
export type OtherRoles = ConductorRole[];

/* See
 * https://docs.couchdb.org/en/stable/intro/security.html#users-documents
 * for what the format that CouchDB wants is.
 */
export type PouchUser = {
  _id: string;
  _rev?: string;
  name: string;
  emails: Email[];
  type: 'user';
  roles: CouchDBUserRoles;
  profiles: UserServiceProfiles;
  owned: NonUniqueProjectID[];
};

export interface RoleInvite {
  _id: string;
  _rev?: string;
  _deleted?: boolean;
  requesting_user: string;
  unlimited?: boolean;
  project_id: NonUniqueProjectID;
  role: ConductorRole;
  number: number;
}
