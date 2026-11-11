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

/**
 * Page cursor for GET /api/templates: JSON `[createdAtMs, templateId]`.
 * Matches the listing-view key suffix so Next/Previous stay on created-date
 * order.
 */
export type TemplateListCursor = [createdAtMs: number, templateId: string];

/** Maps `includeArchived` to {@link TEMPLATE_LIST_ARCHIVED_FLAG} or {@link TEMPLATE_LIST_ACTIVE_FLAG}. */
export function templateListingArchivedFlag(
  includeArchived: boolean
): typeof TEMPLATE_LIST_ACTIVE_FLAG | typeof TEMPLATE_LIST_ARCHIVED_FLAG {
  return includeArchived
    ? TEMPLATE_LIST_ARCHIVED_FLAG
    : TEMPLATE_LIST_ACTIVE_FLAG;
}

/** Couch `{}` high sentinel so `[flag, {}]` sorts after `[flag, ms, id]`. */
const LISTING_KEY_MAX = {};

/** Encode a listing page cursor as JSON `[createdAtMs, templateId]`. */
export function encodeTemplateListCursor(
  createdAtMs: number,
  templateId: string
): string {
  return JSON.stringify([createdAtMs, templateId] satisfies TemplateListCursor);
}

/**
 * Parse a JSON `[createdAtMs, templateId]` cursor. Missing/empty or any other
 * shape (including a bare template id) returns undefined — callers must treat
 * that as “empty page”, not “start of the catalogue”.
 */
export function parseTemplateListCursor(
  startKey?: string
): TemplateListCursor | undefined {
  if (startKey === undefined || startKey === '') return undefined;
  try {
    const parsed = JSON.parse(startKey);
    if (
      Array.isArray(parsed) &&
      parsed.length === 2 &&
      typeof parsed[0] === 'number' &&
      Number.isFinite(parsed[0]) &&
      typeof parsed[1] === 'string' &&
      parsed[1].length > 0
    ) {
      return [parsed[0], parsed[1]];
    }
  } catch {
    // Invalid JSON or the wrong shape.
  }
  return undefined;
}

/**
 * Read `[createdAtMs, templateId]` from a listing-view row key.
 * Global keys are `[flag, ms, id]`; team keys are `[teamId, flag, ms, id]`.
 */
export function templateListCursorFromViewKey(
  key: unknown,
  {teamId}: {teamId?: string} = {}
): TemplateListCursor | undefined {
  if (!Array.isArray(key)) return undefined;
  if (teamId) {
    if (
      key.length >= 4 &&
      typeof key[2] === 'number' &&
      Number.isFinite(key[2]) &&
      typeof key[3] === 'string' &&
      key[3].length > 0
    ) {
      return [key[2], key[3]];
    }
    return undefined;
  }
  if (
    key.length >= 3 &&
    typeof key[1] === 'number' &&
    Number.isFinite(key[1]) &&
    typeof key[2] === 'string' &&
    key[2].length > 0
  ) {
    return [key[1], key[2]];
  }
  return undefined;
}

type ListingRange = {
  startkey: unknown[];
  endkey: unknown[];
  descending: true;
};

/**
 * Newest-first Couch range for the global listing view
 * (`[archivedFlag, createdAtMs, _id]`). `startKey` is inclusive (caller skips
 * the matching first row).
 */
export function templateListingGlobalRange({
  includeArchived,
  startKey,
}: {
  includeArchived: boolean;
  startKey?: TemplateListCursor;
}): ListingRange {
  const flag = templateListingArchivedFlag(includeArchived);
  return {
    startkey: startKey
      ? [flag, startKey[0], startKey[1]]
      : [flag, LISTING_KEY_MAX],
    endkey: [flag],
    descending: true,
  };
}

/**
 * Newest-first Couch range for the team listing view
 * (`[ownedByTeamId, archivedFlag, createdAtMs, _id]`).
 */
export function templateListingTeamRange({
  teamId,
  includeArchived,
  startKey,
}: {
  teamId: string;
  includeArchived: boolean;
  startKey?: TemplateListCursor;
}): ListingRange {
  const flag = templateListingArchivedFlag(includeArchived);
  return {
    startkey: startKey
      ? [teamId, flag, startKey[0], startKey[1]]
      : [teamId, flag, LISTING_KEY_MAX],
    endkey: [teamId, flag],
    descending: true,
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
