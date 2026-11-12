// SPDX-License-Identifier: Apache-2.0
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {convertToCouchDBString} from '../utils';
import {
  listingSearchMap,
  listingSearchPrefix,
} from '../../listing/listingSearch';

// Index constants
const INDEX_DOCUMENT_NAME = 'index';
const TEMPLATES_BY_TEAM_ID_POSTFIX = 'byTeamId';
const TEMPLATES_LISTING_BY_TEMPLATE_ID_POSTFIX = 'listingByTemplateId';
const TEMPLATES_LISTING_BY_TEAM_ID_POSTFIX = 'listingByTeam';
const TEMPLATES_SEARCH_POSTFIX = 'search';

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

/**
 * Name search over non-archived templates, keyed
 * `[scopeKind, scopeId, word, _id]` for the whole catalogue and the owning
 * team. See `listingSearch.ts`.
 */
export const TEMPLATES_SEARCH = `${INDEX_DOCUMENT_NAME}/${TEMPLATES_SEARCH_POSTFIX}`;

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
 * Search view, key prefix and listing view for one GET /api/templates?q=
 * page; spread into `queryListingSearchPage` with `loadRows` reading
 * `listingView`. Non-archived templates only.
 */
export function templateSearchViewAndPrefix({teamId}: {teamId?: string}): {
  view: string;
  prefix: unknown[];
  listingView: string;
} {
  return {
    view: TEMPLATES_SEARCH,
    prefix: listingSearchPrefix(
      teamId ? {kind: 'team', id: teamId} : undefined
    ),
    listingView: TEMPLATES_LISTING_BY_TEMPLATE_ID,
  };
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
    // GET /api/templates?q=. Rows point at the `listingByTemplateId` row.
    [TEMPLATES_SEARCH_POSTFIX]: {
      map: listingSearchMap((doc, tokenize) => {
        if (!doc || !doc._id || doc._id[0] === '_') {
          return;
        }
        if (doc.archived === true) {
          return;
        }
        var createdMs = Date.parse(doc.createdAt);
        if (!(createdMs > 0)) {
          createdMs = 0;
        }
        var tokens = tokenize(doc.name);
        var value = {tokens: tokens, key: [0, createdMs, doc._id]};
        for (var i = 0; i < tokens.length; i++) {
          emit(['all', '', tokens[i], doc._id], value);
          if (doc.ownedByTeamId) {
            emit(['team', doc.ownedByTeamId, tokens[i], doc._id], value);
          }
        }
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
