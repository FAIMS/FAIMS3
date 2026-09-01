/**
 * Exclusive last-updated window for record list and export queries.
 *
 * Bounds are epoch milliseconds. The Couch view key is `[updatedMs, recordId]`.
 * A page cursor is the JSON encoding of that key.
 */

import {DatabaseInterface} from '../types';

export const RECORD_BY_UPDATED_INDEX = 'index/recordByUpdated';

/** Exclusive epoch-ms window on record `updatedAt`. Either bound may be omitted. */
export type UpdatedTimeFilter = {
  updatedAfter?: number;
  updatedBefore?: number;
};

/** Couch view key / page cursor: `[updatedMs, recordId]`. */
export type UpdatedTimeCursor = [number, string];

/** True when at least one exclusive bound is set. */
export function hasUpdatedTimeFilter(
  filter?: UpdatedTimeFilter | null
): boolean {
  return (
    filter?.updatedAfter !== undefined || filter?.updatedBefore !== undefined
  );
}

/** Whether `updated` falls strictly inside the exclusive window. */
export function recordUpdatedInWindow(
  updated: Date | string | number,
  filter: UpdatedTimeFilter
): boolean {
  const ts =
    typeof updated === 'number'
      ? updated
      : updated instanceof Date
        ? updated.getTime()
        : Date.parse(updated);
  if (Number.isNaN(ts)) return false;
  if (filter.updatedAfter !== undefined && !(ts > filter.updatedAfter)) {
    return false;
  }
  if (filter.updatedBefore !== undefined && !(ts < filter.updatedBefore)) {
    return false;
  }
  return true;
}

/** Encode a page cursor as JSON `[updatedMs, recordId]`. */
export function encodeUpdatedTimeCursor(
  updatedMs: number,
  recordId: string
): string {
  return JSON.stringify([updatedMs, recordId] satisfies UpdatedTimeCursor);
}

/**
 * Parse a JSON `[updatedMs, recordId]` cursor. Returns undefined for a missing
 * or empty value, and for anything that is not that pair — including a bare
 * record id. Callers must treat undefined as “stop”, not “start of window”.
 */
export function parseUpdatedTimeCursor(
  startKey?: string
): UpdatedTimeCursor | undefined {
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

export type QueryRecordIdsByUpdatedResult = {
  recordIds: string[];
  keys: UpdatedTimeCursor[];
  nextStartKey?: string;
};

/**
 * Exclusive range query over `index/recordByUpdated`.
 *
 * - `updatedAfter` → `startkey: [updatedAfter + 1]` (`updated > after`)
 * - `updatedBefore` → `endkey: [updatedBefore]` (`updated < before`)
 * - `startKey` must be a JSON `[updatedMs, recordId]` cursor; anything else
 *   (including a bare record id) yields an empty page so the iterator cannot
 *   restart at the beginning of the window.
 */
export async function queryRecordIdsByUpdated({
  dataDb,
  updatedAfter,
  updatedBefore,
  limit,
  startKey,
}: {
  dataDb: DatabaseInterface;
  updatedAfter?: number;
  updatedBefore?: number;
  limit?: number;
  startKey?: string;
}): Promise<QueryRecordIdsByUpdatedResult> {
  const options: {[key: string]: unknown} = {};

  if (startKey !== undefined && startKey !== '') {
    const cursor = parseUpdatedTimeCursor(startKey);
    if (!cursor) {
      return {recordIds: [], keys: []};
    }
    options.startkey = cursor;
    options.skip = 1;
  } else if (updatedAfter !== undefined) {
    options.startkey = [updatedAfter + 1];
  }

  if (updatedBefore !== undefined) {
    options.endkey = [updatedBefore];
  }

  const requestedLimit = limit !== undefined && limit > 0 ? limit : undefined;
  if (requestedLimit !== undefined) {
    options.limit = requestedLimit + 1;
  }

  const result = await dataDb.query(RECORD_BY_UPDATED_INDEX, options);
  const rows = result.rows.filter(row => Array.isArray(row.key));

  const pageRows =
    requestedLimit !== undefined && rows.length > requestedLimit
      ? rows.slice(0, requestedLimit)
      : rows;

  const keys: UpdatedTimeCursor[] = [];
  const recordIds: string[] = [];
  for (const row of pageRows) {
    const key = row.key as UpdatedTimeCursor;
    keys.push(key);
    recordIds.push(typeof row.id === 'string' ? row.id : key[1]);
  }

  const nextStartKey =
    requestedLimit !== undefined &&
    rows.length > requestedLimit &&
    pageRows.length > 0
      ? encodeUpdatedTimeCursor(
          pageRows[pageRows.length - 1].key[0],
          typeof pageRows[pageRows.length - 1].id === 'string'
            ? pageRows[pageRows.length - 1].id
            : pageRows[pageRows.length - 1].key[1]
        )
      : undefined;

  return {
    recordIds,
    keys,
    ...(nextStartKey !== undefined ? {nextStartKey} : {}),
  };
}
