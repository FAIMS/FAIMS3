// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: couchListingPage.ts
 * Description:
 *   Reusable cursor pagination over CouchDB listing views. Every paginated
 *   list GET (templates, notebooks, teams, users, map layers, members,
 *   invites, tokens) shares these constants, query fields, cursor codec,
 *   range builder and the scan-capped page loop. A resource pager supplies
 *   only a view name, a key prefix and an `include` predicate.
 */

import {z} from 'zod';

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

/** Page size when a list GET omits `limit`. No list GET dumps. */
export const LIST_DEFAULT_LIMIT = 50;
/** Absolute ceiling for a list GET `limit`. */
export const LIST_LIMIT_MAX = 500;
/**
 * Per-request listing-view scan cap (same number as max `limit`). A caller who
 * cannot read most rows iterates with `nextStartKey` instead of forcing a
 * full-catalogue scan in one HTTP request.
 */
export const LIST_VIEW_SCAN_MAX = 500;
/** Max Couch listing-view queries used to fill one page. */
export const LIST_VIEW_QUERY_MAX = 5;
/** A JSON cursor (sort key + id) is longer than a bare document id. */
export const LIST_CURSOR_MAX_LENGTH = 512;

// ---------------------------------------------------------------------------
// Query + response schemas
// ---------------------------------------------------------------------------

/** True when `limit` is omitted/empty or a decimal integer 1…`max`. */
export function isValidListLimit(
  limit: string | undefined,
  max: number = LIST_LIMIT_MAX
): boolean {
  if (limit === undefined || limit === '') return true;
  if (!/^[0-9]+$/.test(limit)) return false;
  const n = Number(limit);
  return n >= 1 && n <= max;
}

/**
 * `limit` query field: optional decimal string 1…`max`. Query strings are
 * always strings, so the value stays a string; use {@link resolveListLimit}.
 */
export function listLimitQueryFieldWithMax(max: number) {
  return z
    .string()
    .max(16)
    .refine(value => isValidListLimit(value, max), {
      message: `limit must be between 1 and ${max}`,
    })
    .optional();
}

/** `limit` query field with the shared {@link LIST_LIMIT_MAX} ceiling. */
export const listLimitQueryField = listLimitQueryFieldWithMax(LIST_LIMIT_MAX);

/** Exclusive `startKey` cursor query field (the previous `nextStartKey`). */
export const listStartKeyQueryField = z
  .string()
  .max(LIST_CURSOR_MAX_LENGTH)
  .optional();

/**
 * Spread into every `GetListXQuerySchema` so all list GETs share one
 * `limit` / `startKey` contract.
 */
export const listPageQueryFields = {
  limit: listLimitQueryField,
  startKey: listStartKeyQueryField,
};

/** Parsed `limit`, or `defaultLimit` when omitted/empty. */
export function resolveListLimit(
  limit: string | undefined,
  defaultLimit: number = LIST_DEFAULT_LIMIT
): number {
  return limit !== undefined && limit !== ''
    ? parseInt(limit, 10)
    : defaultLimit;
}

/** `startKey` with the empty string treated as omitted. */
export function resolveListStartKey(
  startKey: string | undefined
): string | undefined {
  return startKey !== undefined && startKey !== '' ? startKey : undefined;
}

/**
 * Page response schema: `{[itemsKey]: T[], nextStartKey?: string}`.
 * `nextStartKey` is present only when more rows remain.
 */
export function paginatedListSchema<T extends z.ZodType, K extends string>(
  itemSchema: T,
  itemsKey: K
) {
  return z.object({
    [itemsKey]: z.array(itemSchema),
    nextStartKey: z.string().optional(),
  } as {[P in K]: z.ZodArray<T>} & {
    nextStartKey: z.ZodOptional<z.ZodString>;
  });
}

/** One page from {@link queryListingPage}. */
export type ListingPage<T> = {
  items: T[];
  /** Pass back as `startKey` for the next page. Absent on the last page. */
  nextStartKey?: string;
};

/**
 * Shapes a pager result as a list response body: `{[itemsKey]: items}` plus
 * `nextStartKey` only when there is one.
 */
export function toPaginatedList<T, K extends string>(
  page: ListingPage<T>,
  itemsKey: K
): {[P in K]: T[]} & {nextStartKey?: string} {
  return {
    [itemsKey]: page.items,
    ...(page.nextStartKey !== undefined
      ? {nextStartKey: page.nextStartKey}
      : {}),
  } as {[P in K]: T[]} & {nextStartKey?: string};
}

// ---------------------------------------------------------------------------
// Cursor
// ---------------------------------------------------------------------------

/** One scalar of a listing cursor. */
export type ListCursorPart = string | number;
/**
 * The part of a listing-view key after the range prefix, e.g.
 * `[updatedAtMs, id]` or `[nameLower, id]`. The last part is the row id so
 * the cursor is unique.
 */
export type ListCursor = readonly ListCursorPart[];
/** Expected scalar type of each cursor part, in order. */
export type ListCursorShape = readonly ('string' | 'number')[];

/** Most listings: `[sortMs, id]`. */
export const LIST_CURSOR_SHAPE_MS_ID = [
  'number',
  'string',
] as const satisfies ListCursorShape;
/** Name-ordered listings: `[nameLower, id]`. */
export const LIST_CURSOR_SHAPE_NAME_ID = [
  'string',
  'string',
] as const satisfies ListCursorShape;

function matchesCursorShape(
  parts: unknown,
  shape: ListCursorShape
): parts is ListCursor {
  if (!Array.isArray(parts) || parts.length !== shape.length) return false;
  return shape.every((expected, i) => {
    const part = parts[i];
    return expected === 'number'
      ? typeof part === 'number' && Number.isFinite(part)
      : typeof part === 'string';
  });
}

/** Opaque `nextStartKey` for a cursor. */
export function encodeListCursor(cursor: ListCursor): string {
  return JSON.stringify(cursor);
}

/**
 * Parses a `startKey`. Returns `undefined` when it is missing, empty, not
 * JSON, or not an array of the expected scalars; callers answer an
 * unparsable cursor with an empty page and no `nextStartKey`.
 */
export function parseListCursor(
  startKey: string | undefined,
  shape: ListCursorShape = LIST_CURSOR_SHAPE_MS_ID
): ListCursor | undefined {
  if (startKey === undefined || startKey === '') return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(startKey);
  } catch {
    return undefined;
  }
  return matchesCursorShape(parsed, shape) ? parsed : undefined;
}

/**
 * Cursor for a listing-view row key: the key with its range prefix removed.
 * Returns `undefined` when the key is not an array of that shape.
 */
export function listCursorFromViewKey(
  key: unknown,
  prefixLength: number,
  shape: ListCursorShape = LIST_CURSOR_SHAPE_MS_ID
): ListCursor | undefined {
  if (!Array.isArray(key) || key.length !== prefixLength + shape.length) {
    return undefined;
  }
  const suffix = key.slice(prefixLength);
  return matchesCursorShape(suffix, shape) ? suffix : undefined;
}

function sameCursor(a: ListCursor, b: ListCursor): boolean {
  return a.length === b.length && a.every((part, i) => part === b[i]);
}

// ---------------------------------------------------------------------------
// Range
// ---------------------------------------------------------------------------

/** Sorts after every string and number in CouchDB collation. */
const LISTING_KEY_MAX = {};
/**
 * Appended to a string to make the upper bound of "every string that starts
 * with it": a very high code point, as the CouchDB guide recommends.
 */
const LISTING_STRING_PREFIX_MAX = '\ufff0';

/** View query range for one listing-key prefix. */
export type ListingViewRange = {
  startkey: unknown[];
  endkey: unknown[];
  descending?: boolean;
};

/**
 * Range covering every key that starts with `prefix`, optionally seeking to
 * `cursor` (inclusive; the pager drops the cursor row itself).
 *
 * Descending (default) reads highest sort value first, e.g. newest
 * `updatedAt`. Ascending suits name-ordered listings.
 *
 * `startsWith` narrows the range to keys whose first part after `prefix` is
 * a string starting with it, and always reads ascending. CouchDB collates
 * strings by language rules, not by code unit, so the range can hold a few
 * keys that do not literally start with it; callers check each row.
 */
export function listingViewRange({
  prefix = [],
  cursor,
  descending = true,
  startsWith,
}: {
  prefix?: readonly unknown[];
  cursor?: ListCursor;
  descending?: boolean;
  startsWith?: string;
}): ListingViewRange {
  if (startsWith !== undefined) {
    return {
      startkey: cursor ? [...prefix, ...cursor] : [...prefix, startsWith],
      endkey: [
        ...prefix,
        startsWith + LISTING_STRING_PREFIX_MAX,
        LISTING_KEY_MAX,
      ],
    };
  }
  if (descending) {
    return {
      startkey: cursor ? [...prefix, ...cursor] : [...prefix, LISTING_KEY_MAX],
      endkey: [...prefix],
      descending: true,
    };
  }
  return {
    startkey: cursor ? [...prefix, ...cursor] : [...prefix],
    endkey: [...prefix, LISTING_KEY_MAX],
  };
}

/** Whole-prefix range in ascending key order (no cursor), for full walks. */
export function listingViewPrefixRange(
  prefix: readonly unknown[]
): ListingViewRange {
  return listingViewRange({prefix, descending: false});
}

// ---------------------------------------------------------------------------
// Page loop
// ---------------------------------------------------------------------------

/** A view row as returned by PouchDB / CouchDB `query`. */
export type ListingViewRow<V> = {
  id: string;
  key: unknown;
  value: V;
};

/** Options the pager passes to the view query. */
export type ListingViewQueryOptions = ListingViewRange & {
  include_docs: false;
  limit: number;
};

/**
 * The only database capability the pager needs. A PouchDB database satisfies
 * it with `(view, options) => db.query(view, options)`; tests can pass an
 * in-memory function.
 */
export type ListingViewQuery<V> = (
  view: string,
  options: ListingViewQueryOptions
) => Promise<{rows: Array<{id?: string; key?: unknown; value?: V | null}>}>;

/**
 * True for a real listing row: a document id that is not a design document
 * and a non-null thin `value`.
 */
export function isListingViewRow<V>(row: {
  id?: string;
  key?: unknown;
  value?: V | null;
}): row is ListingViewRow<V> {
  return row.value != null && !!row.id && !row.id.startsWith('_');
}

export type QueryListingPageArgs<V> = {
  /** Runs the view query, e.g. `(view, options) => db.query(view, options)`. */
  query: ListingViewQuery<V>;
  /** View name, e.g. `index/listingByTeam`. */
  view: string;
  /**
   * Leading key elements shared by every row in this listing, e.g.
   * `[archivedFlag]` or `[teamId, archivedFlag]`. The rest of the key is the
   * cursor.
   */
  prefix?: readonly unknown[];
  /** Key order. Default descending (newest first). */
  descending?: boolean;
  /** Scalars after the prefix. Default `[sortMs, id]`. */
  cursorShape?: ListCursorShape;
  /**
   * Reads only keys whose first part after `prefix` is a string starting
   * with this, in ascending order (`descending` is ignored). The first
   * cursor part must be a string. See {@link listingViewRange}.
   */
  keyStartsWith?: string;
  /** Visible rows wanted. */
  limit: number;
  /** Exclusive cursor from the previous page's `nextStartKey`. */
  startKey?: string;
  /**
   * Keeps a row on the page. Archive/status filters, visibility and
   * permission checks live here; rows it rejects still count towards the
   * scan cap.
   */
  include?: (value: V, row: ListingViewRow<V>) => boolean | Promise<boolean>;
  /**
   * Called once per view query with the rows it returned, before `include`
   * sees any of them. Lets a caller load related data for the whole batch
   * in one query instead of one per row.
   */
  onBatch?: (rows: ListingViewRow<V>[]) => Promise<void>;
  /** Max view rows examined in this call. */
  scanMax?: number;
  /** Max view queries in this call. */
  queryMax?: number;
};

/**
 * One page of thin listing-view rows, filled with rows `include` accepts.
 *
 * - `startKey` is exclusive. The row it names must still be the first row of
 *   the range; an unknown or unparsable cursor returns an empty page with no
 *   `nextStartKey`.
 * - Examines at most `scanMax` rows over at most `queryMax` queries. When the
 *   cap stops the scan before `limit` rows are found, the page is short (or
 *   empty) and still carries `nextStartKey`.
 * - `nextStartKey` is set whenever view rows remain after the last one
 *   examined.
 *
 * Query errors propagate to the caller.
 */
export async function queryListingPage<V>({
  query,
  view,
  prefix = [],
  descending = true,
  cursorShape = LIST_CURSOR_SHAPE_MS_ID,
  keyStartsWith,
  limit,
  startKey,
  include,
  onBatch,
  scanMax = LIST_VIEW_SCAN_MAX,
  queryMax = LIST_VIEW_QUERY_MAX,
}: QueryListingPageArgs<V>): Promise<ListingPage<V>> {
  let exclusiveAfter = parseListCursor(startKey, cursorShape);
  if (startKey !== undefined && startKey !== '' && !exclusiveAfter) {
    return {items: []};
  }
  // A cursor from outside the searched range is unknown: it would also put
  // the start of the Couch range after its end, which Couch rejects.
  if (keyStartsWith !== undefined && exclusiveAfter) {
    const first = exclusiveAfter[0];
    if (typeof first !== 'string' || !first.startsWith(keyStartsWith)) {
      return {items: []};
    }
  }

  type CursorRow = {row: ListingViewRow<V>; cursor: ListCursor};

  const visible: V[] = [];
  let examined = 0;
  let queries = 0;
  let lastExamined: ListCursor | undefined;
  let requireExactStart = exclusiveAfter !== undefined;
  let moreRemain = false;

  while (visible.length < limit && examined < scanMax && queries < queryMax) {
    const remainingScan = scanMax - examined;
    const remainingQueries = queryMax - queries;
    // The cursor row comes back first and is dropped, so ask for one more.
    const extra = exclusiveAfter ? 1 : 0;
    const remainingFill = limit - visible.length;
    // Spread the scan budget over the remaining queries so a mostly-hidden
    // catalogue still reaches the scan cap within `queryMax` queries.
    const minBatch = Math.ceil((remainingScan + extra) / remainingQueries);
    const batchLimit = Math.min(
      remainingScan + extra,
      Math.max(remainingFill + extra, minBatch)
    );

    // One lookahead row tells us whether the view continues past this batch,
    // so a page that ends exactly on the last row carries no `nextStartKey`.
    const result = await query(view, {
      ...listingViewRange({
        prefix,
        cursor: exclusiveAfter,
        descending,
        startsWith: keyStartsWith,
      }),
      include_docs: false,
      limit: batchLimit + 1,
    });
    queries++;
    const couchExhausted = result.rows.length <= batchLimit;

    let rows: CursorRow[] = [];
    for (const row of result.rows.slice(0, batchLimit)) {
      if (!isListingViewRow<V>(row)) continue;
      const cursor = listCursorFromViewKey(row.key, prefix.length, cursorShape);
      if (cursor) rows.push({row, cursor});
    }

    if (exclusiveAfter) {
      const startsAtCursor =
        rows.length > 0 && sameCursor(rows[0].cursor, exclusiveAfter);
      if (requireExactStart) {
        if (!startsAtCursor) return {items: []};
        requireExactStart = false;
      }
      if (startsAtCursor) rows = rows.slice(1);
      exclusiveAfter = undefined;
    }

    if (rows.length === 0) {
      moreRemain = false;
      break;
    }
    if (onBatch) await onBatch(rows.map(({row}) => row));

    for (let i = 0; i < rows.length; i++) {
      const {row, cursor} = rows[i];
      if (examined >= scanMax) {
        moreRemain = true;
        break;
      }
      examined++;
      lastExamined = cursor;
      if (include && !(await include(row.value, row))) continue;
      visible.push(row.value);
      if (visible.length >= limit) {
        moreRemain = i < rows.length - 1 || !couchExhausted;
        break;
      }
    }

    if (visible.length >= limit) break;
    if (examined >= scanMax) {
      moreRemain = moreRemain || !couchExhausted;
      break;
    }
    if (couchExhausted) {
      moreRemain = false;
      break;
    }
    exclusiveAfter = lastExamined;
  }

  return {
    items: visible,
    ...(moreRemain && lastExamined !== undefined
      ? {nextStartKey: encodeListCursor(lastExamined)}
      : {}),
  };
}
