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
/** View value: template list metadata only (no ui-specification / form payload). */
export const TEMPLATES_LISTING_BY_TEMPLATE_ID = `${INDEX_DOCUMENT_NAME}/${TEMPLATES_LISTING_BY_TEMPLATE_ID_POSTFIX}`;
/**
 * Same list shape as {@link TEMPLATES_LISTING_BY_TEMPLATE_ID}, keyed by
 * `[ownedByTeamId, archivedFlag, _id]` so team pages can seek uniquely.
 */
export const TEMPLATES_LISTING_BY_TEAM_ID = `${INDEX_DOCUMENT_NAME}/${TEMPLATES_LISTING_BY_TEAM_ID_POSTFIX}`;

/** First key component for active (non-archived) listing ranges. */
export const TEMPLATE_LIST_ACTIVE_FLAG = 0;
/** First key component for archived listing ranges. */
export const TEMPLATE_LIST_ARCHIVED_FLAG = 1;

export function templateListingArchivedFlag(
  includeArchived: boolean
): typeof TEMPLATE_LIST_ACTIVE_FLAG | typeof TEMPLATE_LIST_ARCHIVED_FLAG {
  return includeArchived
    ? TEMPLATE_LIST_ARCHIVED_FLAG
    : TEMPLATE_LIST_ACTIVE_FLAG;
}

/** Couch `{}` high sentinel so `[flag, {}]` sorts after `[flag, anyId]`. */
const LISTING_KEY_MAX = {};

/**
 * Inclusive Couch range for the global listing view (`[archivedFlag, _id]`).
 * When `startKey` is set, the range starts at that template `_id` (caller
 * treats it as exclusive).
 */
export function templateListingGlobalRange({
  includeArchived,
  startKey,
}: {
  includeArchived: boolean;
  startKey?: string;
}): {startkey: unknown[]; endkey: unknown[]} {
  const flag = templateListingArchivedFlag(includeArchived);
  return {
    startkey:
      startKey !== undefined && startKey !== '' ? [flag, startKey] : [flag],
    endkey: [flag, LISTING_KEY_MAX],
  };
}

/**
 * Inclusive Couch range for the team listing view
 * (`[ownedByTeamId, archivedFlag, _id]`).
 */
export function templateListingTeamRange({
  teamId,
  includeArchived,
  startKey,
}: {
  teamId: string;
  includeArchived: boolean;
  startKey?: string;
}): {startkey: unknown[]; endkey: unknown[]} {
  const flag = templateListingArchivedFlag(includeArchived);
  return {
    startkey:
      startKey !== undefined && startKey !== ''
        ? [teamId, flag, startKey]
        : [teamId, flag],
    endkey: [teamId, flag, LISTING_KEY_MAX],
  };
}

/** Unbounded team range covering both archive flags (startup / id walks). */
export function templateListingTeamAllRange(teamId: string): {
  startkey: unknown[];
  endkey: unknown[];
} {
  return {startkey: [teamId], endkey: [teamId, LISTING_KEY_MAX]};
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
        emit([archived, doc._id], row);
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
        emit([doc.ownedByTeamId, archived, doc._id], row);
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
