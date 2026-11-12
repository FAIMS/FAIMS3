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
const PROJECTS_BY_TEAM_ID_POSTFIX = 'byTeamId';
const PROJECTS_LISTING_BY_PROJECT_ID_POSTFIX = 'listingByProjectId';
const PROJECTS_LISTING_BY_TEAM_ID_POSTFIX = 'listingByTeam';
const PROJECTS_LISTING_BY_TEMPLATE_ID_POSTFIX = 'listingByTemplate';
const PROJECTS_SEARCH_POSTFIX = 'search';

export const PROJECTS_BY_TEAM_ID = `${INDEX_DOCUMENT_NAME}/${PROJECTS_BY_TEAM_ID_POSTFIX}`;
/**
 * View value: project list metadata only (no ui-specification / form
 * payload). Keyed `[statusFlag, createdAtMs, _id]` so GET /api/notebooks
 * pages newest first within a status range.
 */
export const PROJECTS_LISTING_BY_PROJECT_ID = `${INDEX_DOCUMENT_NAME}/${PROJECTS_LISTING_BY_PROJECT_ID_POSTFIX}`;
/**
 * Same list shape as {@link PROJECTS_LISTING_BY_PROJECT_ID}, keyed
 * `[ownedByTeamId, statusFlag, createdAtMs, _id]`.
 */
export const PROJECTS_LISTING_BY_TEAM_ID = `${INDEX_DOCUMENT_NAME}/${PROJECTS_LISTING_BY_TEAM_ID_POSTFIX}`;
/**
 * Same list shape as {@link PROJECTS_LISTING_BY_PROJECT_ID}, keyed
 * `[templateId, statusFlag, createdAtMs, _id]` (surveys made from a template).
 */
export const PROJECTS_LISTING_BY_TEMPLATE_ID = `${INDEX_DOCUMENT_NAME}/${PROJECTS_LISTING_BY_TEMPLATE_ID_POSTFIX}`;

/**
 * Name search over active (OPEN and CLOSED) surveys, keyed
 * `[scopeKind, scopeId, word, _id]` for the whole catalogue, the owning team
 * and the source template. See `listingSearch.ts`.
 */
export const PROJECTS_SEARCH = `${INDEX_DOCUMENT_NAME}/${PROJECTS_SEARCH_POSTFIX}`;

/**
 * Status key component for ARCHIVED surveys. Lower than
 * {@link PROJECT_LIST_ACTIVE_FLAG} so a descending walk over both
 * (`status=all`) lists active surveys first.
 */
export const PROJECT_LIST_ARCHIVED_FLAG = 0;
/** Status key component for OPEN and CLOSED surveys. */
export const PROJECT_LIST_ACTIVE_FLAG = 1;

/** `status` filter on GET /api/notebooks. */
export type ProjectListStatus = 'active' | 'archived' | 'all';

/**
 * Listing view, key prefix and cursor shape for one GET /api/notebooks page;
 * spread into `queryListingPage`.
 *
 * - `active` (OPEN + CLOSED) and `archived` range over one status flag; the
 *   cursor is `[createdAtMs, projectId]`.
 * - `all` ranges over both flags, so the cursor is
 *   `[statusFlag, createdAtMs, projectId]`: active surveys newest first,
 *   then archived surveys newest first.
 *
 * `templateId` takes the template view; otherwise `teamId` takes the team
 * view. A caller passing both filters the other one itself.
 */
export function projectListingViewAndPrefix({
  teamId,
  templateId,
  status,
}: {
  teamId?: string;
  templateId?: string;
  status: ProjectListStatus;
}): {
  view: string;
  prefix: unknown[];
  cursorShape: ('string' | 'number')[];
} {
  const scope = templateId
    ? {view: PROJECTS_LISTING_BY_TEMPLATE_ID, prefix: [templateId]}
    : teamId
      ? {view: PROJECTS_LISTING_BY_TEAM_ID, prefix: [teamId]}
      : {view: PROJECTS_LISTING_BY_PROJECT_ID, prefix: []};
  if (status === 'all') {
    return {...scope, cursorShape: ['number', 'number', 'string']};
  }
  return {
    view: scope.view,
    prefix: [
      ...scope.prefix,
      status === 'archived'
        ? PROJECT_LIST_ARCHIVED_FLAG
        : PROJECT_LIST_ACTIVE_FLAG,
    ],
    cursorShape: ['number', 'string'],
  };
}

/**
 * Search view, key prefix and listing view for one GET /api/notebooks?q=
 * page; spread into `queryListingSearchPage` with `loadRows` reading
 * `listingView`. Active surveys only.
 *
 * `templateId` takes the template scope; otherwise `teamId` takes the team
 * scope. A caller passing both filters the other one itself.
 */
export function projectSearchViewAndPrefix({
  teamId,
  templateId,
}: {
  teamId?: string;
  templateId?: string;
}): {view: string; prefix: unknown[]; listingView: string} {
  return {
    view: PROJECTS_SEARCH,
    prefix: listingSearchPrefix(
      templateId
        ? {kind: 'template', id: templateId}
        : teamId
          ? {kind: 'team', id: teamId}
          : undefined
    ),
    listingView: PROJECTS_LISTING_BY_PROJECT_ID,
  };
}

/**
 * Design document for indexing by key fields
 */
const indexDocument = {
  _id: `_design/${INDEX_DOCUMENT_NAME}`,
  views: {
    [PROJECTS_BY_TEAM_ID_POSTFIX]: {
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
    [PROJECTS_LISTING_BY_PROJECT_ID_POSTFIX]: {
      map: convertToCouchDBString(doc => {
        if (!doc) {
          return;
        }
        if (!doc._id || doc._id[0] === '_') {
          return;
        }
        var row = {...doc};
        delete row.uiSpecification;
        var status = doc.status === 'ARCHIVED' ? 0 : 1;
        var createdMs = Date.parse(doc.createdAt);
        if (!(createdMs > 0)) {
          createdMs = 0;
        }
        emit([status, createdMs, doc._id], row);
      }),
    },
    [PROJECTS_LISTING_BY_TEAM_ID_POSTFIX]: {
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
        var status = doc.status === 'ARCHIVED' ? 0 : 1;
        var createdMs = Date.parse(doc.createdAt);
        if (!(createdMs > 0)) {
          createdMs = 0;
        }
        emit([doc.ownedByTeamId, status, createdMs, doc._id], row);
      }),
    },
    [PROJECTS_LISTING_BY_TEMPLATE_ID_POSTFIX]: {
      map: convertToCouchDBString(doc => {
        if (!doc) {
          return;
        }
        if (!doc._id || doc._id[0] === '_') {
          return;
        }
        if (!doc.templateId) {
          return;
        }
        var row = {...doc};
        delete row.uiSpecification;
        var status = doc.status === 'ARCHIVED' ? 0 : 1;
        var createdMs = Date.parse(doc.createdAt);
        if (!(createdMs > 0)) {
          createdMs = 0;
        }
        emit([doc.templateId, status, createdMs, doc._id], row);
      }),
    },
    // GET /api/notebooks?q=. Rows point at the `listingByProjectId` row.
    [PROJECTS_SEARCH_POSTFIX]: {
      map: listingSearchMap((doc, tokenize) => {
        if (!doc || !doc._id || doc._id[0] === '_') {
          return;
        }
        if (doc.status === 'ARCHIVED') {
          return;
        }
        var createdMs = Date.parse(doc.createdAt);
        if (!(createdMs > 0)) {
          createdMs = 0;
        }
        var tokens = tokenize(doc.name);
        var value = {tokens: tokens, key: [1, createdMs, doc._id]};
        for (var i = 0; i < tokens.length; i++) {
          emit(['all', '', tokens[i], doc._id], value);
          if (doc.ownedByTeamId) {
            emit(['team', doc.ownedByTeamId, tokens[i], doc._id], value);
          }
          if (doc.templateId) {
            emit(['template', doc.templateId, tokens[i], doc._id], value);
          }
        }
      }),
    },
  },
};

/**
 * Exports all design documents for the projects database
 */
export const projectsDbDesignDocuments = {
  indexDocument,
};
