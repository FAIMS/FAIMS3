// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: listingSearch.test.ts
 * Description:
 *   Tests for list search. The views are the real design-document map
 *   functions, run over sample documents into an in-memory view, so the
 *   search rows, their pointers and the listing rows they point at are the
 *   ones CouchDB would build.
 */

import {
  encodeListCursor,
  LIST_SEARCH_MAX_LENGTH,
  ListingSearchPointer,
  listingSearchKeepsRow,
  listingSearchMap,
  listingSearchPrefix,
  listingSearchTokens,
  listingViewRange,
  ListingViewQuery,
  listSearchQueryField,
  parseListingSearch,
  queryListingSearchPage,
} from '../src/listing';
import {
  mapAssetSearchViewAndPrefix,
  mapAssetsDesignDocuments,
} from '../src/data_storage/mapAssetsDB/design';
import {
  peopleDesignDocuments,
  peopleSearchViewAndPrefix,
} from '../src/data_storage/peopleDB/design';
import {
  projectsDbDesignDocuments,
  projectSearchViewAndPrefix,
} from '../src/data_storage/projectsDB/design';
import {
  teamsDesignDocuments,
  teamSearchViewAndPrefix,
} from '../src/data_storage/teamsDB/design';
import {
  templatesDbDesignDocuments,
  templateSearchViewAndPrefix,
} from '../src/data_storage/templatesDB/design';

type Doc = Record<string, unknown> & {_id: string};
type Row = {id: string; key: unknown[]; value: unknown};
type DesignDoc = {_id: string; views: Record<string, {map: string}>};

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

/** Runs a design document's map source over `docs`, as CouchDB would. */
function runMap(source: string, docs: Doc[]): Row[] {
  const rows: Row[] = [];
  let current = '';
  const emit = (key: unknown[], value: unknown) =>
    rows.push({id: current, key, value});
  const map = new Function('emit', `return (${source});`)(emit) as (
    doc: Doc
  ) => void;
  for (const doc of docs) {
    current = doc._id;
    map(doc);
  }
  return rows.sort((a, b) => compareKeys(a.key, b.key));
}

/** View name (`ddoc/view`) to its rows over `docs`. */
function buildViews(design: DesignDoc, docs: Doc[]): Map<string, Row[]> {
  const ddoc = design._id.replace('_design/', '');
  return new Map(
    Object.entries(design.views).map(([name, view]) => [
      `${ddoc}/${name}`,
      runMap(view.map, docs),
    ])
  );
}

/** In-memory database over `views`: range queries and exact-key loads. */
function memoryDb(views: Map<string, Row[]>) {
  const rowsOf = (view: string) => {
    const rows = views.get(view);
    if (!rows) throw new Error(`no view ${view}`);
    return rows;
  };
  const query: ListingViewQuery<ListingSearchPointer> = async (
    view,
    options
  ) => ({
    rows: rowsOf(view)
      .filter(
        row =>
          compareKeys(row.key, options.startkey) >= 0 &&
          compareKeys(row.key, options.endkey) <= 0
      )
      .slice(0, options.limit) as Array<{
      id: string;
      key: unknown;
      value: ListingSearchPointer;
    }>,
  });
  const loads: unknown[][][] = [];
  const loadRows = (view: string) => async (keys: unknown[][]) => {
    loads.push(keys);
    return {
      rows: keys.flatMap(key =>
        rowsOf(view).filter(row => compareKeys(row.key, key) === 0)
      ) as Array<{id: string; key: unknown; value: Doc}>,
    };
  };
  return {query, loadRows, loads};
}

const project = (
  id: string,
  name: string,
  extra: Record<string, unknown> = {}
): Doc => ({
  _id: id,
  name,
  status: 'OPEN',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  uiSpecification: {big: true},
  ...extra,
});

/** Searches the projects design document over `docs`, one page at a time. */
function projectSearch(docs: Doc[]) {
  const db = memoryDb(
    buildViews(projectsDbDesignDocuments.indexDocument, docs)
  );
  const page = (
    q: string,
    {
      limit = 50,
      startKey,
      teamId,
      templateId,
      include,
    }: {
      limit?: number;
      startKey?: string;
      teamId?: string;
      templateId?: string;
      include?: (row: Doc) => boolean;
    } = {}
  ) => {
    const {view, prefix, listingView} = projectSearchViewAndPrefix({
      teamId,
      templateId,
    });
    return queryListingSearchPage<Doc>({
      query: db.query,
      view,
      prefix,
      search: parseListingSearch(q)!,
      loadRows: db.loadRows(listingView),
      limit,
      startKey,
      include,
    });
  };
  /** Every page of a search, as ids. */
  const walk = async (
    q: string,
    options: Omit<NonNullable<Parameters<typeof page>[1]>, 'startKey'> = {}
  ) => {
    const pages: string[][] = [];
    let startKey: string | undefined;
    for (let i = 0; i < 100; i++) {
      const result = await page(q, {...options, startKey});
      pages.push(result.items.map(item => item._id));
      if (result.nextStartKey === undefined) break;
      startKey = result.nextStartKey;
    }
    return pages;
  };
  return {page, walk, loads: db.loads};
}

describe('listingSearchTokens', () => {
  it('lowercases and splits on whitespace and punctuation', () => {
    expect(
      listingSearchTokens('Blue Team Notebook — 2026/04 (draft_v2)')
    ).toEqual(['blue', 'team', 'notebook', '2026', '04', 'draft', 'v2']);
    expect(listingSearchTokens('Peter.Baker+test@Example.org')).toEqual([
      'peter',
      'baker',
      'test',
      'example',
      'org',
    ]);
  });

  it('keeps letters outside ASCII', () => {
    expect(listingSearchTokens('Élan Vital · 野外調査、第二')).toEqual([
      'élan',
      'vital',
      '野外調査',
      '第二',
    ]);
  });

  it('lists each word once', () => {
    expect(listingSearchTokens('Blue blue BLUE bluebird')).toEqual([
      'blue',
      'bluebird',
    ]);
  });

  it('bounds the words per text and the length of a word', () => {
    const many = Array.from({length: 60}, (_, i) => `w${i}`).join(' ');
    expect(listingSearchTokens(many)).toHaveLength(40);
    expect(listingSearchTokens('x'.repeat(200))).toEqual(['x'.repeat(64)]);
  });

  it('never cuts a word in the middle of a surrogate pair', () => {
    // 'a' then 40 emoji is 81 code units; unit 64 is the first half of one.
    const [word] = listingSearchTokens('a' + '😀'.repeat(40));
    expect(word).toBe('a' + '😀'.repeat(31));
    // CouchDB rejects a key holding half a pair as invalid UTF-8.
    expect(word.isWellFormed()).toBe(true);
    expect(parseListingSearch('a' + '😀'.repeat(40))?.rangeToken).toBe(word);
  });

  it('returns no words for blank, punctuation-only or non-string input', () => {
    for (const text of ['', '   ', '--- !!', undefined, null, 7, {}]) {
      expect(listingSearchTokens(text)).toEqual([]);
    }
  });
});

describe('listingSearchMap', () => {
  it('builds a self-contained map that tokenises like the API', () => {
    const source = listingSearchMap((doc, tokenize) => {
      // @ts-expect-error `emit` is supplied by the view engine.
      emit(tokenize(doc.name), null);
    });
    const [row] = runMap(source, [{_id: 'a', name: 'Blue Team — Notebook'}]);
    expect(row.key).toEqual(listingSearchTokens('Blue Team — Notebook'));
  });
});

describe('parseListingSearch', () => {
  it('is undefined when q holds no word', () => {
    for (const q of [undefined, '', '  ', '--', '()']) {
      expect(parseListingSearch(q)).toBeUndefined();
    }
  });

  it('ranges on the longest word, the first of equals', () => {
    expect(parseListingSearch('Blue notebook team')).toEqual({
      tokens: ['blue', 'notebook', 'team'],
      rangeToken: 'notebook',
    });
    expect(parseListingSearch('blue team')?.rangeToken).toBe('blue');
  });

  it('accepts q up to the length limit', () => {
    expect(
      listSearchQueryField.safeParse('x'.repeat(LIST_SEARCH_MAX_LENGTH)).success
    ).toBe(true);
    expect(
      listSearchQueryField.safeParse('x'.repeat(LIST_SEARCH_MAX_LENGTH + 1))
        .success
    ).toBe(false);
    expect(listSearchQueryField.safeParse(undefined).success).toBe(true);
  });
});

describe('listingSearchKeepsRow', () => {
  const blu = parseListingSearch('blu')!;

  it('keeps a row whose word starts with the range word', () => {
    expect(listingSearchKeepsRow(blu, 'blue', ['blue', 'team'])).toBe(true);
  });

  it('drops near misses a collated range can include', () => {
    expect(listingSearchKeepsRow(blu, 'blá', ['blá'])).toBe(false);
    expect(listingSearchKeepsRow(blu, 7, ['blue'])).toBe(false);
  });

  it('keeps only the first of several matching words of one document', () => {
    const tokens = ['bluebird', 'blue', 'sky'];
    expect(listingSearchKeepsRow(blu, 'blue', tokens)).toBe(true);
    expect(listingSearchKeepsRow(blu, 'bluebird', tokens)).toBe(false);
  });

  it('requires every other typed word to start a word of the document', () => {
    const search = parseListingSearch('notebook bl te')!;
    expect(
      listingSearchKeepsRow(search, 'notebook', ['blue', 'team', 'notebook'])
    ).toBe(true);
    expect(
      listingSearchKeepsRow(search, 'notebook', ['blue', 'notebook'])
    ).toBe(false);
  });
});

describe('listingViewRange startsWith', () => {
  it('covers the strings starting with the text, ascending', () => {
    expect(listingViewRange({prefix: ['all', ''], startsWith: 'blu'})).toEqual({
      startkey: ['all', '', 'blu'],
      endkey: ['all', '', 'blu\ufff0', {}],
    });
  });

  it('seeks to the cursor', () => {
    expect(
      listingViewRange({
        prefix: ['all', ''],
        startsWith: 'blu',
        cursor: ['blue', 'p1'],
      }).startkey
    ).toEqual(['all', '', 'blue', 'p1']);
  });
});

describe('queryListingSearchPage', () => {
  const docs = [
    project('p1', 'Blue Team Notebook', {ownedByTeamId: 't-blue'}),
    project('p2', 'Red Team Notebook', {ownedByTeamId: 't-red'}),
    project('p3', 'Bluebird survey', {
      ownedByTeamId: 't-blue',
      templateId: 'tpl-1',
    }),
    project('p4', 'Blue Bluebird blues', {templateId: 'tpl-1'}),
    project('p5', 'Old blue notebook', {status: 'ARCHIVED'}),
    project('p6', 'Coastal erosion'),
  ];

  it('finds documents with a word starting with the text', async () => {
    const {walk} = projectSearch(docs);
    expect((await walk('blu')).flat().sort()).toEqual(['p1', 'p3', 'p4']);
    expect((await walk('TEAM')).flat().sort()).toEqual(['p1', 'p2']);
    expect((await walk('eros')).flat()).toEqual(['p6']);
  });

  it('does not match the middle of a word', async () => {
    const {walk} = projectSearch(docs);
    expect((await walk('lue')).flat()).toEqual([]);
  });

  it('never returns archived surveys', async () => {
    const {walk} = projectSearch(docs);
    expect((await walk('old')).flat()).toEqual([]);
  });

  it('requires every word typed', async () => {
    const {walk} = projectSearch(docs);
    expect((await walk('notebook blue')).flat()).toEqual(['p1']);
    expect((await walk('team note')).flat().sort()).toEqual(['p1', 'p2']);
    expect((await walk('blue coastal')).flat()).toEqual([]);
  });

  it('returns the listing row, not the stored document', async () => {
    const {page} = projectSearch(docs);
    const {items} = await page('eros');
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('Coastal erosion');
    expect(items[0].uiSpecification).toBeUndefined();
  });

  it('lists a document once however many of its words match', async () => {
    const {walk} = projectSearch(docs);
    // p4 has rows for "blue", "bluebird" and "blues"; one page at a time, so
    // nothing but the row itself can tell a repeat from a first sighting.
    const pages = await walk('blu', {limit: 1});
    const ids = pages.flat();
    expect(ids.sort()).toEqual(['p1', 'p3', 'p4']);
    expect(pages.every(page => page.length <= 1)).toBe(true);
  });

  it('orders by matched word, then id', async () => {
    const {walk} = projectSearch(docs);
    // "blue" (p1, p4) sorts before "bluebird" (p3).
    expect((await walk('blu')).flat()).toEqual(['p1', 'p4', 'p3']);
  });

  it('pages without gaps and ends without a cursor', async () => {
    const many = Array.from({length: 23}, (_, i) =>
      project(`s${String(i).padStart(2, '0')}`, `Survey site ${i}`)
    );
    const {page, walk} = projectSearch(many);
    const pages = await walk('survey', {limit: 10});
    expect(pages.map(p => p.length)).toEqual([10, 10, 3]);
    expect(new Set(pages.flat()).size).toBe(23);
    // A page that ends exactly on the last match carries no cursor.
    expect((await page('survey', {limit: 23})).nextStartKey).toBeUndefined();
  });

  it('narrows to one team or one template', async () => {
    const {walk} = projectSearch(docs);
    expect((await walk('blu', {teamId: 't-blue'})).flat().sort()).toEqual([
      'p1',
      'p3',
    ]);
    expect((await walk('blu', {templateId: 'tpl-1'})).flat().sort()).toEqual([
      'p3',
      'p4',
    ]);
    expect((await walk('blu', {teamId: 't-none'})).flat()).toEqual([]);
  });

  it('applies include to the listing row and fills the page past it', async () => {
    const {page} = projectSearch(docs);
    const result = await page('blu', {
      limit: 2,
      include: row => row._id !== 'p1',
    });
    expect(result.items.map(item => item._id)).toEqual(['p4', 'p3']);
  });

  it('loads listing rows once per view query, for matches only', async () => {
    const {page, loads} = projectSearch(docs);
    await page('blu');
    // p4's two repeat rows are not loaded.
    expect(loads).toHaveLength(1);
    expect(loads[0]).toHaveLength(3);
  });

  it('answers an unknown or out-of-range cursor with an empty page', async () => {
    const {page} = projectSearch(docs);
    for (const startKey of [
      'not json',
      encodeListCursor(['blue', 'nope']),
      encodeListCursor(['zebra', 'p1']),
      encodeListCursor([1, 'p1']),
    ]) {
      expect(await page('blu', {startKey})).toEqual({items: []});
    }
  });

  it('skips a match whose listing row is gone', async () => {
    const views = buildViews(projectsDbDesignDocuments.indexDocument, docs);
    const db = memoryDb(views);
    const {view, prefix} = projectSearchViewAndPrefix({});
    const result = await queryListingSearchPage<Doc>({
      query: db.query,
      view,
      prefix,
      search: parseListingSearch('blu')!,
      loadRows: async () => ({rows: []}),
      limit: 10,
    });
    expect(result).toEqual({items: []});
  });
});

describe('search views of each resource', () => {
  const createdAt = '2026-02-03T04:05:06.000Z';
  const cases: Array<{
    name: string;
    design: DesignDoc;
    spec: {view: string; prefix: unknown[]; listingView: string};
    doc: Doc;
    hidden: Doc;
    q: string;
  }> = [
    {
      name: 'surveys',
      design: projectsDbDesignDocuments.indexDocument,
      spec: projectSearchViewAndPrefix({}),
      doc: project('p', 'Coastal Erosion', {createdAt}),
      hidden: project('x', 'Coastal Archive', {status: 'ARCHIVED'}),
      q: 'coast',
    },
    {
      name: 'surveys of a team',
      design: projectsDbDesignDocuments.indexDocument,
      spec: projectSearchViewAndPrefix({teamId: 't1'}),
      doc: project('p', 'Coastal Erosion', {ownedByTeamId: 't1'}),
      hidden: project('x', 'Coastal Other', {ownedByTeamId: 't2'}),
      q: 'coast',
    },
    {
      name: 'surveys of a template',
      design: projectsDbDesignDocuments.indexDocument,
      spec: projectSearchViewAndPrefix({templateId: 'tpl', teamId: 't1'}),
      doc: project('p', 'Coastal Erosion', {templateId: 'tpl'}),
      hidden: project('x', 'Coastal Other', {templateId: 'other'}),
      q: 'coast',
    },
    {
      name: 'templates',
      design: templatesDbDesignDocuments.indexDocument,
      spec: templateSearchViewAndPrefix({}),
      doc: {
        _id: 't',
        name: 'Soil Template',
        createdAt,
        updatedAt: createdAt,
        archived: false,
      },
      hidden: {
        _id: 'x',
        name: 'Soil Old',
        createdAt,
        updatedAt: createdAt,
        archived: true,
      },
      q: 'soil',
    },
    {
      name: 'templates of a team',
      design: templatesDbDesignDocuments.indexDocument,
      spec: templateSearchViewAndPrefix({teamId: 't1'}),
      doc: {
        _id: 't',
        name: 'Soil Template',
        createdAt,
        updatedAt: createdAt,
        ownedByTeamId: 't1',
      },
      hidden: {
        _id: 'x',
        name: 'Soil Other',
        createdAt,
        updatedAt: createdAt,
        ownedByTeamId: 't2',
      },
      q: 'soil',
    },
    {
      name: 'teams',
      design: teamsDesignDocuments.designDoc,
      spec: teamSearchViewAndPrefix(),
      doc: {
        _id: 'team',
        name: 'Blue Team',
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
      },
      hidden: {
        _id: 'x',
        name: 'Blue Old',
        createdAt: 1,
        updatedAt: 1,
        archived: true,
      },
      q: 'blue',
    },
    {
      name: 'users by name',
      design: peopleDesignDocuments.designDoc,
      spec: peopleSearchViewAndPrefix(),
      doc: {
        _id: 'u',
        user_id: 'u',
        name: 'Ada Lovelace',
        emails: [{email: 'countess@engine.example', verified: true}],
      },
      hidden: {_id: 'x', user_id: 'x', name: 'Ada Disabled', disabled: true},
      q: 'love',
    },
    {
      name: 'users by email',
      design: peopleDesignDocuments.designDoc,
      spec: peopleSearchViewAndPrefix(),
      doc: {
        _id: 'u',
        user_id: 'u',
        name: 'Ada Lovelace',
        emails: [{email: 'countess@engine.example', verified: true}],
      },
      hidden: {_id: 'x', user_id: 'x', name: 'Charles', emails: []},
      q: 'countess@engine',
    },
    {
      name: 'map layers',
      design: mapAssetsDesignDocuments.indexDocument,
      spec: mapAssetSearchViewAndPrefix({}),
      doc: {
        _id: 'a',
        docType: 'asset',
        name: 'Harbour Chart',
        createdAt: 5,
        updatedAt: 5,
      },
      hidden: {_id: 'x', docType: 'link', name: 'Harbour link', createdAt: 6},
      q: 'harb',
    },
    {
      name: 'map layers of a team',
      design: mapAssetsDesignDocuments.indexDocument,
      spec: mapAssetSearchViewAndPrefix({teamId: 't1'}),
      doc: {
        _id: 'a',
        docType: 'asset',
        name: 'Harbour Chart',
        createdAt: 5,
        updatedAt: 5,
        ownedByTeamId: 't1',
      },
      hidden: {
        _id: 'x',
        docType: 'asset',
        name: 'Harbour Other',
        createdAt: 6,
        updatedAt: 6,
        ownedByTeamId: 't2',
      },
      q: 'harb',
    },
  ];

  it.each(cases)(
    '$name: finds the listing row and leaves the rest out',
    async ({design, spec, doc, hidden, q}) => {
      const views = buildViews(design, [doc, hidden]);
      const db = memoryDb(views);
      const page = await queryListingSearchPage<Doc>({
        query: db.query,
        view: spec.view,
        prefix: spec.prefix,
        search: parseListingSearch(q)!,
        loadRows: db.loadRows(spec.listingView),
        limit: 10,
      });
      expect(page.items.map(item => item._id)).toEqual([doc._id]);
      // The result is the listing view's own value for that document.
      const listed = views
        .get(spec.listingView)!
        .find(row => row.id === doc._id);
      expect(page.items[0]).toEqual(listed!.value);
    }
  );

  it('keys every search row under a known scope prefix', () => {
    const scopes = [
      listingSearchPrefix(),
      listingSearchPrefix({kind: 'team', id: 't1'}),
      listingSearchPrefix({kind: 'template', id: 'tpl'}),
    ];
    const rows = runMap(
      projectsDbDesignDocuments.indexDocument.views.search.map,
      [project('p', 'Coastal', {ownedByTeamId: 't1', templateId: 'tpl'})]
    );
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(scopes).toContainEqual(row.key.slice(0, 2));
      expect(row.key.slice(2)).toEqual(['coastal', 'p']);
    }
  });
});
