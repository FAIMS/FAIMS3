// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: src/data_storage/tombstoneDB/types.ts
 * Description:
 *   Document models for the survey tombstone database.
 */

import {DatabaseInterface} from '../../types';

export type TombstoneV1Document =
  PouchDB.Core.ExistingDocument<TombstoneV1Fields>;

/**
 * A tombstone records that a survey (project) was permanently deleted.
 * Document `_id` is the deleted project / survey ID.
 */
export interface TombstoneV1Fields {
  /** Display name of the survey at deletion time */
  name: string;

  /** When the survey was deleted (ms timestamp) */
  deletedAt: number;

  /** Who deleted it (user_id from PeopleDB) */
  deletedBy: string;

  /** Team that owned the survey, if any */
  ownedByTeamId?: string;

  /** Couch data DB name that was destroyed, if known */
  dataDbName?: string;
}

// We are at v1
export type TombstoneDBFields = TombstoneV1Fields;
export type ExistingTombstoneDBDocument =
  PouchDB.Core.ExistingDocument<TombstoneDBFields>;
export type TombstoneDBDocument = PouchDB.Core.Document<TombstoneDBFields>;
export type TombstoneDB = DatabaseInterface<TombstoneDBFields>;
