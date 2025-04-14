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

import {NonUniqueProjectID} from '../../types';
import {Resource, Role} from '../../permission/model';
import {ResourceRole} from '../../permission/types';

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

// This is the v1.1 or prior user model - these represent entries in the people
// DB
export interface PeopleV1Fields {
  user_id: string;
  name: string;
  emails: Email[];
  // CouchDB accessible roles array either <role> or <projectId>||<projectRole>
  roles: string[];
  // This is the explicitly granted roles for each project: projectId -> projectRole[]
  project_roles: AllProjectRoles;
  // These are global roles
  other_roles: OtherRoles;
  // This maps the profile (e.g. local) -> info about that profile
  profiles: UserServiceProfiles;
  // This is deprecated - never used
  owned: NonUniqueProjectID[];
}
export type PeopleV1Document = PouchDB.Core.ExistingDocument<PeopleV1Fields>;

export type ResourceRoleMap = {
  [resource in Resource]?: {resourceId: string; role: Role}[] | undefined;
};

export interface PeopleV2Fields {
  // Unique user ID - same as _id in all cases thus far
  user_id: string;

  // Full name
  name: string;

  // Emails associated with this profile
  emails: Email[];

  // A list of global scope roles (these roles apply globally if global role,
  // and to all resources if it's a resource role)
  globalRoles: Role[];

  // A list of explicitly granted resource scoped roles e.g. {Resource.PROJECT :
  // {resourceId: '1234', role: 'survey-manager'}}
  resourceRoles: ResourceRole[];

  // This links profile information to profiles
  profiles: UserServiceProfiles;
}
export type PeopleV2Document = PouchDB.Core.ExistingDocument<PeopleV2Fields>;

// V3 adds teams
export interface PeopleV3Fields {
  // Unique user ID - same as _id in all cases thus far
  user_id: string;

  // Full name
  name: string;

  // Emails associated with this profile
  emails: Email[];

  // This links profile information to profiles
  profiles: UserServiceProfiles;

  // Explicitly granted roles - we don't store the flattened/resolved roles
  // This way we can be more careful about understanding where roles came from

  // Project roles
  projectRoles: ResourceRole[];

  // Team roles
  teamRoles: ResourceRole[];

  // Template roles
  templateRoles: ResourceRole[];

  // Global (non resource-specific roles)
  globalRoles: Role[];
}
export type PeopleV3Document = PouchDB.Core.ExistingDocument<PeopleV3Fields>;
// We are at v3
export type PeopleDBFields = PeopleV3Fields;

export type PeopleDBDocument = PouchDB.Core.Document<PeopleDBFields>;
export type ExistingPeopleDBDocument =
  PouchDB.Core.ExistingDocument<PeopleDBFields>;
export type PeopleDB = PouchDB.Database<PeopleDBFields>;
