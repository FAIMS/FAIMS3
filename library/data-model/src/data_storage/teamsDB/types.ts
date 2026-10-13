// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: src/datamodel/users.ts
 * Description:
 *   Data models related to users.
 */

import {DatabaseInterface} from '../../types';

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
export type TeamsDB = DatabaseInterface<TeamsDBFields>;
