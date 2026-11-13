// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: listingSearch.ts
 * Description:
 *   Name search for paginated list GETs (`q`), built on CouchDB views.
 *
 *   A search view emits one row per word of a document's searchable text,
 *   keyed `[scopeKind, scopeId, word, _id]`. A query is a key range over the
 *   words that start with the typed text, so it is index-backed and pages
 *   with the same `limit` / `startKey` / `nextStartKey` contract as the
 *   unfiltered list.
 *
 *   The match is "a word of the name starts with each word typed": `blu` and
 *   `team` both find "Blue Team Notebook", `lue` does not. Results are in
 *   word order, then id.
 *
 *   Search rows are pointers. They carry the document's words and the key of
 *   its row in the resource's listing view; the pager loads the listing rows
 *   for each batch, so a search result is the same row the plain list
 *   returns and the index does not hold a copy of it per word.
 */

import {z} from 'zod';
import {
  isListingViewRow,
  LIST_CURSOR_SHAPE_NAME_ID,
  ListingPage,
  ListingViewQuery,
  ListingViewRow,
  queryListingPage,
} from './couchListingPage';

// ---------------------------------------------------------------------------
// Query field
// ---------------------------------------------------------------------------

/** Longest `q` a list GET accepts. */
export const LIST_SEARCH_MAX_LENGTH = 100;

/** `q` query field: optional search text. */
export const listSearchQueryField = z
  .string()
  .max(LIST_SEARCH_MAX_LENGTH)
  .optional();

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------

/**
 * The distinct lowercased words of `text`, in order of first appearance.
 * Words are split on whitespace and punctuation; at most 40 words of at most
 * 64 characters are kept, which bounds the index rows one document adds.
 *
 * Runs in the API and, as source text, inside CouchDB map functions (see
 * {@link listingSearchMap}), so both always split the same way. It must
 * stay self-contained: no imports and no outer constants. Like the other
 * map functions it reaches CouchDB as the compiled source, unchanged.
 */
export function listingSearchTokens(text: unknown): string[] {
  if (typeof text !== 'string') {
    return [];
  }
  // Whitespace; ASCII punctuation and symbols (four ranges, written as code
  // points so no character needs escaping); then Latin-1, general and CJK
  // punctuation.
  const words = text
    .toLowerCase()
    .split(
      /[\s\u0021-\u002f\u003a-\u0040\u005b-\u0060\u007b-\u007e\u00a1-\u00bf\u2010-\u2027\u2030-\u205e\u3000-\u303f]+/
    );
  const tokens: string[] = [];
  for (let i = 0; i < words.length && tokens.length < 40; i++) {
    let word = words[i].slice(0, 64);
    // Cutting at 64 can split a surrogate pair (an emoji, say). Drop the
    // stray half: CouchDB rejects a key that is not valid UTF-8.
    const last = word.charCodeAt(word.length - 1);
    if (last >= 0xd800 && last <= 0xdbff) {
      word = word.slice(0, -1);
    }
    if (word && tokens.indexOf(word) === -1) {
      tokens.push(word);
    }
  }
  return tokens;
}

/**
 * Source of a CouchDB map function that calls `map(doc, tokenize)`, where
 * `tokenize` is {@link listingSearchTokens}. `map` is embedded as source
 * text, so like every map function it can use only its arguments and
 * `emit`.
 */
export function listingSearchMap(
  map: (doc: any, tokenize: (text: unknown) => string[]) => void
): string {
  return `function (doc) {
  return (${map.toString()})(doc, ${listingSearchTokens.toString()});
}`;
}

// ---------------------------------------------------------------------------
// View rows
// ---------------------------------------------------------------------------

/** Scope kind of search rows that cover the whole catalogue. */
export const LISTING_SEARCH_SCOPE_ALL = 'all';
/** Scope kind of search rows for the documents one team owns. */
export const LISTING_SEARCH_SCOPE_TEAM = 'team';
/** Scope kind of search rows for the surveys made from one template. */
export const LISTING_SEARCH_SCOPE_TEMPLATE = 'template';

/** Narrows a search to one team's or one template's documents. */
export type ListingSearchScope = {
  kind: typeof LISTING_SEARCH_SCOPE_TEAM | typeof LISTING_SEARCH_SCOPE_TEMPLATE;
  id: string;
};

/**
 * Leading `[scopeKind, scopeId]` of the search keys in `scope`; the whole
 * catalogue when omitted. The rest of each key is the `[word, _id]` cursor.
 */
export function listingSearchPrefix(scope?: ListingSearchScope): unknown[] {
  return scope ? [scope.kind, scope.id] : [LISTING_SEARCH_SCOPE_ALL, ''];
}

/** Value of a search view row. */
export type ListingSearchPointer = {
  /** Every word of the document, from {@link listingSearchTokens}. */
  tokens: string[];
  /** Key of the document's row in the resource's listing view. */
  key: unknown[];
};

function isListingSearchPointer(value: unknown): value is ListingSearchPointer {
  const pointer = value as Partial<ListingSearchPointer> | null;
  return (
    !!pointer &&
    Array.isArray(pointer.key) &&
    Array.isArray(pointer.tokens) &&
    pointer.tokens.every(token => typeof token === 'string')
  );
}

// ---------------------------------------------------------------------------
// Query
// ---------------------------------------------------------------------------

/** A parsed `q`. */
export type ListingSearch = {
  /** Every word typed; each must start some word of a matching document. */
  tokens: string[];
  /**
   * The word the view range is read on: the longest typed, as the one
   * likely to match fewest rows. The other words are checked per row.
   */
  rangeToken: string;
};

/**
 * Parses `q`. Returns `undefined` when it holds no word (missing, blank or
 * punctuation only); the caller then serves the plain list.
 */
export function parseListingSearch(
  q: string | undefined
): ListingSearch | undefined {
  const tokens = listingSearchTokens(q);
  if (tokens.length === 0) return undefined;
  const rangeToken = tokens.reduce((longest, token) =>
    token.length > longest.length ? token : longest
  );
  return {tokens, rangeToken};
}

/**
 * True when the search row keyed on `rowToken` is the one row to keep for a
 * document whose words are `docTokens`:
 *
 * - `rowToken` really starts with the range word (the Couch range can
 *   include near misses);
 * - every other typed word starts some word of the document;
 * - of the document's words that start with the range word, `rowToken` is
 *   the first in code-unit order. A document with several such words has a
 *   row for each in the range; this keeps exactly one, without remembering
 *   earlier pages.
 */
export function listingSearchKeepsRow(
  search: ListingSearch,
  rowToken: unknown,
  docTokens: readonly string[]
): boolean {
  if (typeof rowToken !== 'string') return false;
  if (!rowToken.startsWith(search.rangeToken)) return false;
  for (const token of docTokens) {
    if (token < rowToken && token.startsWith(search.rangeToken)) return false;
  }
  return search.tokens.every(
    typed =>
      typed === search.rangeToken ||
      docTokens.some(token => token.startsWith(typed))
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

/**
 * Loads listing-view rows by exact key, e.g.
 * `keys => db.query(LISTING_VIEW, {keys, include_docs: false})`.
 */
export type ListingRowsByKey<R> = (
  keys: unknown[][]
) => Promise<{rows: Array<{id?: string; key?: unknown; value?: R | null}>}>;

export type QueryListingSearchPageArgs<R> = {
  /** Runs the search view query. */
  query: ListingViewQuery<ListingSearchPointer>;
  /** Search view name, e.g. `index/search`. */
  view: string;
  /** From {@link listingSearchPrefix}. */
  prefix: readonly unknown[];
  /** From {@link parseListingSearch}. */
  search: ListingSearch;
  /** Loads the listing rows the search rows point at. */
  loadRows: ListingRowsByKey<R>;
  /** Visible rows wanted. */
  limit: number;
  /** Exclusive cursor from the previous page's `nextStartKey`. */
  startKey?: string;
  /** Keeps a matching row on the page (visibility, permissions). */
  include?: (row: R) => boolean | Promise<boolean>;
  /** Max search rows examined in this call. */
  scanMax?: number;
  /** Max search view queries in this call. */
  queryMax?: number;
};

/**
 * One page of listing rows whose words match `search`, in word order then
 * id. Same paging rules as {@link queryListingPage}: exclusive `startKey`,
 * an unknown cursor returns an empty page, and the scan cap can return a
 * short page that still carries `nextStartKey`.
 *
 * Each search view query is followed by one `loadRows` call for that
 * batch's matches.
 */
export async function queryListingSearchPage<R>({
  query,
  view,
  prefix,
  search,
  loadRows,
  limit,
  startKey,
  include,
  scanMax,
  queryMax,
}: QueryListingSearchPageArgs<R>): Promise<ListingPage<R>> {
  const keeps = (row: ListingViewRow<ListingSearchPointer>) =>
    isListingSearchPointer(row.value) &&
    Array.isArray(row.key) &&
    listingSearchKeepsRow(search, row.key[prefix.length], row.value.tokens);

  /** Listing rows of the current batch's matches, by document id. */
  const loaded = new Map<string, R>();
  /** Rows accepted so far, in page order. */
  const kept: R[] = [];

  const page = await queryListingPage<ListingSearchPointer>({
    query,
    view,
    prefix,
    cursorShape: LIST_CURSOR_SHAPE_NAME_ID,
    keyStartsWith: search.rangeToken,
    limit,
    startKey,
    ...(scanMax !== undefined ? {scanMax} : {}),
    ...(queryMax !== undefined ? {queryMax} : {}),
    onBatch: async rows => {
      loaded.clear();
      const matches = rows.filter(keeps);
      if (matches.length === 0) return;
      const result = await loadRows(matches.map(row => row.value.key));
      for (const row of result.rows) {
        if (isListingViewRow<R>(row)) loaded.set(row.id, row.value);
      }
    },
    include: async (_pointer, row) => {
      if (!keeps(row)) return false;
      // No listing row: the document left the listing since it was indexed.
      const listed = loaded.get(row.id);
      if (listed === undefined) return false;
      if (include && !(await include(listed))) return false;
      kept.push(listed);
      return true;
    },
  });

  return {
    items: kept,
    ...(page.nextStartKey !== undefined
      ? {nextStartKey: page.nextStartKey}
      : {}),
  };
}
