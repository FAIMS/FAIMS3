// SPDX-License-Identifier: Apache-2.0
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {convertToCouchDBString} from '../utils';

// Index constants
const INDEX_DOCUMENT_NAME = 'index';
const TEMPLATES_BY_TEAM_ID_POSTFIX = 'byTeamId';
const TEMPLATES_LISTING_BY_TEMPLATE_ID_POSTFIX = 'listingByTemplateId';
const TEMPLATES_LISTING_BY_TEAM_ID_POSTFIX = 'listingByTeam';

export const TEMPLATES_BY_TEAM_ID = `${INDEX_DOCUMENT_NAME}/${TEMPLATES_BY_TEAM_ID_POSTFIX}`;
/**
 * Thin listing rows (no `uiSpecification`). Keyed
 * `[archivedFlag, createdAtMs, _id]` so Control Centre pages match the
 * created-date column (newest first when queried descending).
 */
export const TEMPLATES_LISTING_BY_TEMPLATE_ID = `${INDEX_DOCUMENT_NAME}/${TEMPLATES_LISTING_BY_TEMPLATE_ID_POSTFIX}`;
/**
 * Same list shape as {@link TEMPLATES_LISTING_BY_TEMPLATE_ID}, keyed by
 * `[ownedByTeamId, archivedFlag, createdAtMs, _id]`.
 */
export const TEMPLATES_LISTING_BY_TEAM_ID = `${INDEX_DOCUMENT_NAME}/${TEMPLATES_LISTING_BY_TEAM_ID_POSTFIX}`;

/** First key component for active (non-archived) listing ranges. */
export const TEMPLATE_LIST_ACTIVE_FLAG = 0;
/** First key component for archived listing ranges. */
export const TEMPLATE_LIST_ARCHIVED_FLAG = 1;

/** Maps `includeArchived` to {@link TEMPLATE_LIST_ARCHIVED_FLAG} or {@link TEMPLATE_LIST_ACTIVE_FLAG}. */
export function templateListingArchivedFlag(
  includeArchived: boolean
): typeof TEMPLATE_LIST_ACTIVE_FLAG | typeof TEMPLATE_LIST_ARCHIVED_FLAG {
  return includeArchived
    ? TEMPLATE_LIST_ARCHIVED_FLAG
    : TEMPLATE_LIST_ACTIVE_FLAG;
}

/**
 * Listing view and key prefix for one GET /api/templates page. The rest of
 * each key is the `[createdAtMs, templateId]` cursor, so pass both to
 * `queryListingPage` / `listingViewRange`.
 */
export function templateListingViewAndPrefix({
  teamId,
  includeArchived,
}: {
  teamId?: string;
  includeArchived: boolean;
}): {view: string; prefix: unknown[]} {
  const flag = templateListingArchivedFlag(includeArchived);
  return teamId
    ? {view: TEMPLATES_LISTING_BY_TEAM_ID, prefix: [teamId, flag]}
    : {view: TEMPLATES_LISTING_BY_TEMPLATE_ID, prefix: [flag]};
}

/**
 * Design document for indexing by key fields
 */
const indexDocument = {
  _id: `_design/${INDEX_DOCUMENT_NAME}`,
  views: {
    [TEMPLATES_BY_TEAM_ID_POSTFIX]: {
      map: convertToCouchDBString(doc => {
        if (
          doc &&
          doc.ownedByTeamId !== undefined &&
          doc.ownedByTeamId.length > 0
        ) {
          emit(doc.ownedByTeamId, 1);
        }
      }),
    },
    [TEMPLATES_LISTING_BY_TEMPLATE_ID_POSTFIX]: {
      map: convertToCouchDBString(doc => {
        if (!doc) {
          return;
        }
        if (!doc._id || doc._id[0] === '_') {
          return;
        }
        var row = {...doc};
        delete row.uiSpecification;
        var archived = doc.archived === true ? 1 : 0;
        var createdMs = Date.parse(doc.createdAt);
        if (!(createdMs > 0)) {
          createdMs = 0;
        }
        emit([archived, createdMs, doc._id], row);
      }),
    },
    [TEMPLATES_LISTING_BY_TEAM_ID_POSTFIX]: {
      map: convertToCouchDBString(doc => {
        if (!doc) {
          return;
        }
        if (!doc._id || doc._id[0] === '_') {
          return;
        }
        if (!doc.ownedByTeamId) {
          return;
        }
        var row = {...doc};
        delete row.uiSpecification;
        var archived = doc.archived === true ? 1 : 0;
        var createdMs = Date.parse(doc.createdAt);
        if (!(createdMs > 0)) {
          createdMs = 0;
        }
        emit([doc.ownedByTeamId, archived, createdMs, doc._id], row);
      }),
    },
  },
};

/**
 * Exports all design documents for the templates database
 */
export const templatesDbDesignDocuments = {
  indexDocument,
};
