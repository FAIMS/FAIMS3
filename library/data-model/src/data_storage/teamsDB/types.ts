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

export type TeamsV1Document = PouchDB.Core.ExistingDocument<TeamsV1Fields>;

export interface TeamsV1Fields {
  // A display name for the team
  name: string;

  // A description of the team
  description: string;

  // When was it created? ms timestamp
  createdAt: number;

  // When was it last updated? ms timestamp
  updatedAt: number;

  // Who created it (user_id of PeopleDB)
  createdBy: string;
}

// We are at v1
export type TeamsDBFields = TeamsV1Fields;
export type ExistingTeamsDBDocument =
  PouchDB.Core.ExistingDocument<TeamsDBFields>;
export type TeamsDBDocument = PouchDB.Core.Document<TeamsDBFields>;
export type TeamsDB = PouchDB.Database<TeamsDBFields>;
