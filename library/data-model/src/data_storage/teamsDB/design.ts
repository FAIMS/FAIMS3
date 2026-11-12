// SPDX-License-Identifier: Apache-2.0
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {convertToCouchDBString} from '../utils';

const INDEX_DOCUMENT_NAME = 'indexes';
const TEAMS_LISTING_POSTFIX = 'listing';

/**
 * Team documents keyed `[archivedFlag, createdAtMs, _id]` so GET /api/teams
 * pages newest first within the active or archived range.
 */
export const TEAMS_LISTING = `${INDEX_DOCUMENT_NAME}/${TEAMS_LISTING_POSTFIX}`;

/** First key component for active (non-archived) teams. */
export const TEAM_LIST_ACTIVE_FLAG = 0;
/** First key component for archived teams. */
export const TEAM_LIST_ARCHIVED_FLAG = 1;

/**
 * Listing view and key prefix for one GET /api/teams page. The rest of each
 * key is the `[createdAtMs, teamId]` cursor. `includeArchived` is XOR: true
 * lists archived teams only.
 */
export function teamListingViewAndPrefix({
  includeArchived,
}: {
  includeArchived: boolean;
}): {view: string; prefix: unknown[]} {
  return {
    view: TEAMS_LISTING,
    prefix: [includeArchived ? TEAM_LIST_ARCHIVED_FLAG : TEAM_LIST_ACTIVE_FLAG],
  };
}

/**
 * Design document for indexing teams
 */
const designDoc = {
  _id: `_design/${INDEX_DOCUMENT_NAME}`,
  views: {
    [TEAMS_LISTING_POSTFIX]: {
      map: convertToCouchDBString(doc => {
        if (!doc || !doc._id || doc._id[0] === '_') {
          return;
        }
        var archived = doc.archived === true ? 1 : 0;
        var createdMs = doc.createdAt;
        if (!(createdMs > 0)) {
          createdMs = 0;
        }
        emit([archived, createdMs, doc._id], doc);
      }),
    },
  },
};

export const teamsDesignDocuments = {designDoc};
