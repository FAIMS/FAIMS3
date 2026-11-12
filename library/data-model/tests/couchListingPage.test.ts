// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: couchListingPage.test.ts
 * Description:
 *   Tests for the shared Couch listing pager. The view query is an in-memory
 *   function, so the page loop runs without a database.
 */

import {
  encodeListCursor,
  isListingViewRow,
  isValidListLimit,
  LIST_CURSOR_SHAPE_NAME_ID,
  LIST_DEFAULT_LIMIT,
  LIST_LIMIT_MAX,
  listCursorFromViewKey,
  listingViewPrefixRange,
  listingViewRange,
  listPageQueryFields,
  ListingViewQuery,
  ListingViewQueryOptions,
  paginatedListSchema,
  parseListCursor,
  queryListingPage,
  resolveListLimit,
  resolveListStartKey,
} from '../src/listing';
import {z} from 'zod';

type Item = {_id: string; hidden?: boolean};
type Row = {id: string; key: unknown[]; value: Item | null};

/** CouchDB collation for the key parts used here: numbers, strings, `{}`. */
function comparePart(a: unknown, b: unknown): number {
  const rank = (v: unknown) =>
    typeof v === 'number' ? 0 : typeof v === 'string' ? 1 : 2;
  if (rank(a) !== rank(b)) return rank(a) - rank(b);
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'string' && typeof b === 'string') {
    return a < b ? -1 : a > b ? 1 : 0;
  }
  return 0;
}

function compareKeys(a: unknown[], b: unknown[]): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const c = comparePart(a[i], b[i]);
    if (c !== 0) return c;
  }
  return a.length - b.length;
}

/** In-memory view honouring startkey / endkey / descending / limit. */
function memoryView(rows: Row[]): {
  query: ListingViewQuery<Item>;
  calls: ListingViewQueryOptions[];
} {
  const calls: ListingViewQueryOptions[] = [];
  const query: ListingViewQuery<Item> = async (_view, options) => {
    calls.push(options);
    const descending = options.descending === true;
    const low = descending ? options.endkey : options.startkey;
    const high = descending ? options.startkey : options.endkey;
    const sorted = [...rows]
      .filter(
        row => compareKeys(row.key, low) >= 0 && compareKeys(row.key, high) <= 0
      )
      .sort((a, b) => compareKeys(a.key, b.key));
    if (descending) sorted.reverse();
    return {rows: sorted.slice(0, options.limit)};
  };
  return {query, calls};
}

/** `count` rows keyed `[flag, ms, id]`, ms ascending with the index. */
function msRows(
  count: number,
  {
    flag = 0,
    hidden = () => false,
  }: {flag?: number; hidden?: (i: number) => boolean} = {}
): Row[] {
  return Array.from({length: count}, (_, i) => {
    const id = `doc-${String(i).padStart(4, '0')}`;
    return {
      id,
      key: [flag, 1000 + i, id],
      value: {_id: id, ...(hidden(i) ? {hidden: true} : {})},
    };
  });
}

async function walk(
  args: Omit<Parameters<typeof queryListingPage<Item>>[0], 'startKey'>
): Promise<{pages: Item[][]; ids: string[]}> {
  const pages: Item[][] = [];
  let startKey: string | undefined;
  for (let i = 0; i < 1000; i++) {
    const page = await queryListingPage<Item>({...args, startKey});
    pages.push(page.items);
    if (page.nextStartKey === undefined) break;
    startKey = page.nextStartKey;
  }
  return {pages, ids: pages.flat().map(item => item._id)};
}

describe('list query fields', () => {
  const schema = z.object({...listPageQueryFields});

  it('accepts an omitted or empty limit and decimal 1…max', () => {
    expect(schema.safeParse({}).success).toBe(true);
    expect(schema.safeParse({limit: ''}).success).toBe(true);
    expect(schema.safeParse({limit: '1'}).success).toBe(true);
    expect(schema.safeParse({limit: String(LIST_LIMIT_MAX)}).success).toBe(
      true
    );
  });

  it('rejects zero, over-max and non-decimal limits', () => {
    for (const limit of [
      '0',
      String(LIST_LIMIT_MAX + 1),
      '-1',
      '1.5',
      '1e2',
      'ten',
    ]) {
      expect(schema.safeParse({limit}).success).toBe(false);
      expect(isValidListLimit(limit)).toBe(false);
    }
  });

  it('rejects an over-long startKey', () => {
    expect(schema.safeParse({startKey: 'x'.repeat(513)}).success).toBe(false);
    expect(schema.safeParse({startKey: 'x'.repeat(512)}).success).toBe(true);
  });

  it('resolves defaults', () => {
    expect(resolveListLimit(undefined)).toBe(LIST_DEFAULT_LIMIT);
    expect(resolveListLimit('')).toBe(LIST_DEFAULT_LIMIT);
    expect(resolveListLimit('7')).toBe(7);
    expect(resolveListLimit(undefined, 150)).toBe(150);
    expect(resolveListStartKey('')).toBeUndefined();
    expect(resolveListStartKey(undefined)).toBeUndefined();
    expect(resolveListStartKey('[1,"a"]')).toBe('[1,"a"]');
  });

  it('builds a page response schema under the given items key', () => {
    const page = paginatedListSchema(z.object({_id: z.string()}), 'things');
    expect(page.parse({things: [{_id: 'a'}]})).toEqual({things: [{_id: 'a'}]});
    expect(page.parse({things: [], nextStartKey: 'k'})).toEqual({
      things: [],
      nextStartKey: 'k',
    });
    expect(page.safeParse({items: []}).success).toBe(false);
    expect(page.safeParse([{_id: 'a'}]).success).toBe(false);
  });
});

describe('list cursors', () => {
  it('round-trips [ms, id] and [name, id]', () => {
    expect(parseListCursor(encodeListCursor([5, 'a']))).toEqual([5, 'a']);
    expect(
      parseListCursor(
        encodeListCursor(['ada', 'user-1']),
        LIST_CURSOR_SHAPE_NAME_ID
      )
    ).toEqual(['ada', 'user-1']);
  });

  it('returns undefined for missing, non-JSON and wrong-shape cursors', () => {
    expect(parseListCursor(undefined)).toBeUndefined();
    expect(parseListCursor('')).toBeUndefined();
    expect(parseListCursor('bare-id')).toBeUndefined();
    expect(parseListCursor('{"a":1}')).toBeUndefined();
    expect(parseListCursor('[1]')).toBeUndefined();
    expect(parseListCursor('[1,"a","b"]')).toBeUndefined();
    expect(parseListCursor('["1","a"]')).toBeUndefined();
    expect(parseListCursor('[null,"a"]')).toBeUndefined();
    expect(parseListCursor('[1,{"$gt":null}]')).toBeUndefined();
    expect(
      parseListCursor('[1,"a"]', LIST_CURSOR_SHAPE_NAME_ID)
    ).toBeUndefined();
  });

  it('reads the cursor from a view key after the prefix', () => {
    expect(listCursorFromViewKey([0, 5, 'a'], 1)).toEqual([5, 'a']);
    expect(listCursorFromViewKey(['team', 1, 5, 'a'], 2)).toEqual([5, 'a']);
    expect(listCursorFromViewKey([5, 'a'], 0)).toEqual([5, 'a']);
    expect(listCursorFromViewKey([0, 5, 'a'], 2)).toBeUndefined();
    expect(listCursorFromViewKey('a', 0)).toBeUndefined();
    expect(listCursorFromViewKey([0, 'x', 'a'], 1)).toBeUndefined();
  });
});

describe('listing view ranges', () => {
  it('descending range uses the {} high sentinel', () => {
    expect(listingViewRange({prefix: ['team', 0]})).toEqual({
      startkey: ['team', 0, {}],
      endkey: ['team', 0],
      descending: true,
    });
    expect(listingViewRange({})).toEqual({
      startkey: [{}],
      endkey: [],
      descending: true,
    });
  });

  it('seeks to the cursor', () => {
    expect(listingViewRange({prefix: [1], cursor: [5, 'a']})).toEqual({
      startkey: [1, 5, 'a'],
      endkey: [1],
      descending: true,
    });
    expect(
      listingViewRange({prefix: [0], cursor: ['ada', 'u1'], descending: false})
    ).toEqual({startkey: [0, 'ada', 'u1'], endkey: [0, {}]});
  });

  it('prefix range covers the whole prefix ascending', () => {
    expect(listingViewPrefixRange(['team'])).toEqual({
      startkey: ['team'],
      endkey: ['team', {}],
    });
  });
});

describe('isListingViewRow', () => {
  it('skips design documents and null values', () => {
    expect(isListingViewRow({id: 'a', key: [], value: {}})).toBe(true);
    expect(isListingViewRow({id: '_design/index', key: [], value: {}})).toBe(
      false
    );
    expect(isListingViewRow({id: 'a', key: [], value: null})).toBe(false);
    expect(isListingViewRow({key: [], value: {}})).toBe(false);
  });
});

describe('queryListingPage', () => {
  it('pages newest first with an exclusive cursor and no repeats', async () => {
    const {query} = memoryView(msRows(7));
    const first = await queryListingPage<Item>({
      query,
      view: 'v',
      prefix: [0],
      limit: 3,
    });
    expect(first.items.map(i => i._id)).toEqual([
      'doc-0006',
      'doc-0005',
      'doc-0004',
    ]);
    expect(first.nextStartKey).toBe(encodeListCursor([1004, 'doc-0004']));

    const {pages, ids} = await walk({query, view: 'v', prefix: [0], limit: 3});
    expect(pages.map(p => p.length)).toEqual([3, 3, 1]);
    expect(ids).toEqual([
      'doc-0006',
      'doc-0005',
      'doc-0004',
      'doc-0003',
      'doc-0002',
      'doc-0001',
      'doc-0000',
    ]);
  });

  it('omits nextStartKey when the last row exactly fills the page', async () => {
    const {query} = memoryView(msRows(3));
    const page = await queryListingPage<Item>({
      query,
      view: 'v',
      prefix: [0],
      limit: 3,
    });
    expect(page.items).toHaveLength(3);
    expect(page.nextStartKey).toBeUndefined();
  });

  it('returns an empty last page for an empty view', async () => {
    const {query, calls} = memoryView([]);
    expect(
      await queryListingPage<Item>({query, view: 'v', prefix: [0], limit: 5})
    ).toEqual({items: []});
    expect(calls).toHaveLength(1);
  });

  it('stays inside the key prefix', async () => {
    const {query} = memoryView([
      ...msRows(3, {flag: 0}),
      ...msRows(4, {flag: 1}).map(row => ({
        ...row,
        id: `arch-${row.id}`,
        value: {_id: `arch-${row.id}`},
        key: [1, row.key[1], `arch-${row.id}`],
      })),
    ]);
    const active = await walk({query, view: 'v', prefix: [0], limit: 2});
    expect(active.ids).toEqual(['doc-0002', 'doc-0001', 'doc-0000']);
    const archived = await walk({query, view: 'v', prefix: [1], limit: 2});
    expect(archived.ids).toHaveLength(4);
    expect(archived.ids.every(id => id.startsWith('arch-'))).toBe(true);
  });

  it('pages ascending name-ordered keys', async () => {
    const names = ['ada', 'bob', 'bob', 'cy', 'dee'];
    const rows: Row[] = names.map((name, i) => ({
      id: `u${i}`,
      key: [0, name, `u${i}`],
      value: {_id: `u${i}`},
    }));
    const {query} = memoryView(rows);
    const {pages, ids} = await walk({
      query,
      view: 'v',
      prefix: [0],
      descending: false,
      cursorShape: LIST_CURSOR_SHAPE_NAME_ID,
      limit: 2,
    });
    expect(ids).toEqual(['u0', 'u1', 'u2', 'u3', 'u4']);
    expect(pages.map(p => p.length)).toEqual([2, 2, 1]);
  });

  it('returns an empty page without a cursor for an unparsable startKey', async () => {
    const {query, calls} = memoryView(msRows(5));
    for (const startKey of ['doc-0001', '[1]', '{"a":1}', '["a","b"]']) {
      expect(
        await queryListingPage<Item>({
          query,
          view: 'v',
          prefix: [0],
          limit: 2,
          startKey,
        })
      ).toEqual({items: []});
    }
    expect(calls).toHaveLength(0);
  });

  it('returns an empty page without a cursor when the cursor row is gone', async () => {
    const {query} = memoryView(msRows(5));
    expect(
      await queryListingPage<Item>({
        query,
        view: 'v',
        prefix: [0],
        limit: 2,
        startKey: encodeListCursor([1002, 'not-a-row']),
      })
    ).toEqual({items: []});
    expect(
      await queryListingPage<Item>({
        query,
        view: 'v',
        prefix: [0],
        limit: 2,
        startKey: encodeListCursor([9999, 'doc-0004']),
      })
    ).toEqual({items: []});
  });

  it('treats an empty startKey as the first page', async () => {
    const {query} = memoryView(msRows(2));
    const page = await queryListingPage<Item>({
      query,
      view: 'v',
      prefix: [0],
      limit: 5,
      startKey: '',
    });
    expect(page.items).toHaveLength(2);
  });

  it('fills the page past rows the include predicate rejects', async () => {
    // Newest first: 9 (hidden), 8, 7 (hidden), 6, …
    const {query} = memoryView(msRows(10, {hidden: i => i % 2 === 1}));
    const include = (item: Item) => item.hidden !== true;
    const first = await queryListingPage<Item>({
      query,
      view: 'v',
      prefix: [0],
      limit: 3,
      include,
    });
    expect(first.items.map(i => i._id)).toEqual([
      'doc-0008',
      'doc-0006',
      'doc-0004',
    ]);
    expect(first.nextStartKey).toBe(encodeListCursor([1004, 'doc-0004']));

    const {ids} = await walk({
      query,
      view: 'v',
      prefix: [0],
      limit: 3,
      include,
    });
    expect(ids).toEqual([
      'doc-0008',
      'doc-0006',
      'doc-0004',
      'doc-0002',
      'doc-0000',
    ]);
  });

  it('awaits an async include predicate and passes the row', async () => {
    const {query} = memoryView(msRows(4));
    const seen: string[] = [];
    const page = await queryListingPage<Item>({
      query,
      view: 'v',
      prefix: [0],
      limit: 10,
      include: async (item, row) => {
        seen.push(row.id);
        return item._id !== 'doc-0002';
      },
    });
    expect(page.items.map(i => i._id)).toEqual([
      'doc-0003',
      'doc-0001',
      'doc-0000',
    ]);
    expect(seen).toEqual(['doc-0003', 'doc-0002', 'doc-0001', 'doc-0000']);
  });

  it('scan cap returns an empty page with nextStartKey before a later visible row', async () => {
    // Only the oldest row is visible; 20 hidden rows sit in front of it.
    const {query, calls} = memoryView(msRows(21, {hidden: i => i > 0}));
    const include = (item: Item) => item.hidden !== true;
    const first = await queryListingPage<Item>({
      query,
      view: 'v',
      prefix: [0],
      limit: 1,
      include,
      scanMax: 10,
      queryMax: 5,
    });
    expect(first.items).toEqual([]);
    expect(first.nextStartKey).toBe(encodeListCursor([1011, 'doc-0011']));
    expect(calls.length).toBeLessThanOrEqual(5);

    const {pages, ids} = await walk({
      query,
      view: 'v',
      prefix: [0],
      limit: 1,
      include,
      scanMax: 10,
      queryMax: 5,
    });
    expect(ids).toEqual(['doc-0000']);
    expect(pages.map(p => p.length)).toEqual([0, 0, 1]);
  });

  it('never examines more than scanMax rows or runs more than queryMax queries', async () => {
    const {query, calls} = memoryView(msRows(200, {hidden: () => true}));
    let examined = 0;
    const page = await queryListingPage<Item>({
      query,
      view: 'v',
      prefix: [0],
      limit: 5,
      include: () => {
        examined++;
        return false;
      },
      scanMax: 50,
      queryMax: 3,
    });
    expect(page.items).toEqual([]);
    expect(page.nextStartKey).toBeDefined();
    expect(examined).toBe(50);
    expect(calls.length).toBeLessThanOrEqual(3);
  });

  it('omits nextStartKey when the scan cap lands on the last view row', async () => {
    const {query} = memoryView(msRows(10, {hidden: () => true}));
    const page = await queryListingPage<Item>({
      query,
      view: 'v',
      prefix: [0],
      limit: 5,
      include: () => false,
      scanMax: 10,
      queryMax: 5,
    });
    expect(page).toEqual({items: []});
  });

  it('ends without a cursor when Couch is exhausted before the page fills', async () => {
    const {query} = memoryView(msRows(4, {hidden: i => i < 3}));
    const page = await queryListingPage<Item>({
      query,
      view: 'v',
      prefix: [0],
      limit: 3,
      include: item => item.hidden !== true,
    });
    expect(page).toEqual({items: [{_id: 'doc-0003'}]});
  });

  it('ignores design-document and null-value rows', async () => {
    const {query} = memoryView([
      ...msRows(2),
      {id: '_design/index', key: [0, 5000, '_design/index'], value: {_id: 'x'}},
      {id: 'doc-null', key: [0, 4000, 'doc-null'], value: null},
    ]);
    const page = await queryListingPage<Item>({
      query,
      view: 'v',
      prefix: [0],
      limit: 10,
    });
    expect(page.items.map(i => i._id)).toEqual(['doc-0001', 'doc-0000']);
  });

  it('propagates query errors', async () => {
    await expect(
      queryListingPage<Item>({
        query: async () => {
          throw new Error('couch down');
        },
        view: 'v',
        limit: 1,
      })
    ).rejects.toThrow('couch down');
  });
});
