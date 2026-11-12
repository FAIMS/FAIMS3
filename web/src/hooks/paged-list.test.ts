// SPDX-License-Identifier: Apache-2.0
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {act, renderHook, waitFor} from '@testing-library/react';
import {createElement, type ReactNode} from 'react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {User} from '@/context/auth-provider';
import {
  LIST_SEARCH_DEBOUNCE_MS,
  listPath,
  useInfiniteList,
  useListCursor,
  useListSearch,
  usePagedList,
  type ListPageArgs,
} from './paged-list';

const mockUser = {
  user: {id: 'admin', name: 'Admin', emails: [], globalRoles: []},
  token: 'token',
  refreshToken: 'refresh',
  decodedToken: null,
} as unknown as User;

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {queries: {retry: false}},
  });
  return function Wrapper({children}: {children: ReactNode}) {
    return createElement(QueryClientProvider, {client: queryClient}, children);
  };
}

type ThingPage = {things: {id: string}[]; nextStartKey?: string};

/** Request for one page of a made-up `/api/things` list. */
const buildThingsRequest =
  (filter: string) =>
  ({limit, startKey, q}: ListPageArgs) => ({
    path: listPath('/api/things', {filter, q, limit, startKey}),
    queryKey: ['things', filter, q ?? null, limit ?? null, startKey ?? null],
  });

/**
 * Serves `/api/things` from `allIds` the way the API does: `limit` rows after
 * the exclusive `startKey`, with `nextStartKey` while rows remain. With `q`,
 * only the ids that start with it.
 */
function stubThingsApi(allIds: string[]) {
  const fetchMock = vi.fn(async (input: unknown) => {
    const url = new URL(String(input));
    const limit = Number(url.searchParams.get('limit'));
    const startKey = url.searchParams.get('startKey');
    const q = url.searchParams.get('q');
    const ids = q ? allIds.filter(id => id.startsWith(q)) : allIds;
    const from = startKey ? ids.indexOf(startKey) + 1 : 0;
    const things = ids.slice(from, from + limit).map(id => ({id}));
    const more = from + limit < ids.length;
    const page: ThingPage = {
      things,
      ...(more ? {nextStartKey: things[things.length - 1].id} : {}),
    };
    return {ok: true, json: async () => page};
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const requestedUrls = (fetchMock: ReturnType<typeof stubThingsApi>) =>
  fetchMock.mock.calls.map(([input]) => {
    const url = new URL(String(input));
    return `${url.pathname}${url.search}`;
  });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('listPath', () => {
  it('returns the bare path when no param is set', () => {
    expect(listPath('/api/things', {})).toBe('/api/things');
    expect(
      listPath('/api/things', {
        a: undefined,
        b: null,
        c: false,
        d: '',
      })
    ).toBe('/api/things');
  });

  it('sends flags only when on, and encodes values', () => {
    expect(
      listPath('/api/things', {
        includeArchived: true,
        limit: 10,
        startKey: '[1,"a b"]',
      })
    ).toBe(
      '/api/things?includeArchived=true&limit=10&startKey=%5B1%2C%22a+b%22%5D'
    );
  });

  it('keeps a zero', () => {
    expect(listPath('/api/things', {offset: 0})).toBe('/api/things?offset=0');
  });
});

describe('useListCursor', () => {
  it('walks forward and back through the cursors it was given', () => {
    const {result} = renderHook(() =>
      useListCursor({scope: 'a', defaultPageSize: 10})
    );
    expect(result.current).toMatchObject({
      pageSize: 10,
      pageIndex: 0,
      startKey: undefined,
    });

    act(() => result.current.advance('k1'));
    act(() => result.current.advance('k2'));
    expect(result.current).toMatchObject({pageIndex: 2, startKey: 'k2'});

    act(() => result.current.goPrevious());
    expect(result.current).toMatchObject({pageIndex: 1, startKey: 'k1'});

    act(() => result.current.goPrevious());
    act(() => result.current.goPrevious());
    expect(result.current).toMatchObject({pageIndex: 0, startKey: undefined});
  });

  it('returns to the first page on First and on a page-size change', () => {
    const {result} = renderHook(() => useListCursor({scope: 'a'}));
    act(() => result.current.advance('k1'));
    act(() => result.current.goFirst());
    expect(result.current).toMatchObject({pageIndex: 0, startKey: undefined});

    act(() => result.current.advance('k1'));
    act(() => result.current.changePageSize(25));
    expect(result.current).toMatchObject({
      pageSize: 25,
      pageIndex: 0,
      startKey: undefined,
    });
  });

  it('drops the cursor when the scope changes', () => {
    const {result, rerender} = renderHook(
      ({scope}: {scope: string}) => useListCursor({scope}),
      {initialProps: {scope: 'active'}}
    );
    act(() => result.current.advance('k1'));
    rerender({scope: 'archived'});
    expect(result.current).toMatchObject({pageIndex: 0, startKey: undefined});
  });
});

describe('useListSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const pause = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

  it('holds q back until typing pauses, and trims it', () => {
    const {result} = renderHook(() => useListSearch());
    expect(result.current).toMatchObject({input: '', q: ''});

    act(() => result.current.setInput(' bl'));
    pause(LIST_SEARCH_DEBOUNCE_MS - 1);
    act(() => result.current.setInput(' blue '));
    // The box follows every keystroke; the pause restarts with each one.
    expect(result.current).toMatchObject({input: ' blue ', q: ''});
    pause(LIST_SEARCH_DEBOUNCE_MS - 1);
    expect(result.current.q).toBe('');
    pause(1);
    expect(result.current).toMatchObject({input: ' blue ', q: 'blue'});
  });

  it('clears q at once when the box is emptied', () => {
    const {result} = renderHook(() => useListSearch());
    act(() => result.current.setInput('blue'));
    pause(LIST_SEARCH_DEBOUNCE_MS);
    expect(result.current.q).toBe('blue');

    act(() => result.current.setInput('  '));
    expect(result.current).toMatchObject({input: '  ', q: ''});
    // No late search for the text that was there.
    pause(LIST_SEARCH_DEBOUNCE_MS);
    expect(result.current.q).toBe('');
  });

  it('does not search for text that was cleared before the pause ended', () => {
    const {result} = renderHook(() => useListSearch());
    act(() => result.current.setInput('blue'));
    act(() => result.current.setInput(''));
    pause(LIST_SEARCH_DEBOUNCE_MS);
    expect(result.current.q).toBe('');
  });
});

describe('usePagedList', () => {
  let fetchMock: ReturnType<typeof stubThingsApi>;

  beforeEach(() => {
    fetchMock = stubThingsApi(['a', 'b', 'c', 'd', 'e']);
  });

  const renderThings = (initialFilter = 'x') =>
    renderHook(
      ({filter}: {filter: string}) =>
        usePagedList<ThingPage, 'things'>({
          user: mockUser,
          scope: filter,
          defaultPageSize: 2,
          buildRequest: buildThingsRequest(filter),
          itemsKey: 'things',
        }),
      {wrapper: createWrapper(), initialProps: {filter: initialFilter}}
    );

  const ids = (items: {id: string}[] | undefined) => items?.map(t => t.id);

  it('fetches one page at a time and follows nextStartKey', async () => {
    const {result} = renderThings();

    await waitFor(() => expect(ids(result.current.items)).toEqual(['a', 'b']));
    expect(result.current.hasNextPage).toBe(true);
    expect(result.current.canPreviousPage).toBe(false);
    expect(result.current.serverPagination).toMatchObject({
      pageIndex: 0,
      pageSize: 2,
      hasNextPage: true,
      canPreviousPage: false,
    });

    act(() => result.current.goNext());
    await waitFor(() => expect(ids(result.current.items)).toEqual(['c', 'd']));
    expect(result.current.pageIndex).toBe(1);
    expect(result.current.canPreviousPage).toBe(true);

    act(() => result.current.goNext());
    await waitFor(() => expect(ids(result.current.items)).toEqual(['e']));
    // The last page has no cursor, so Next is off.
    expect(result.current.hasNextPage).toBe(false);

    act(() => result.current.goPrevious());
    await waitFor(() => expect(ids(result.current.items)).toEqual(['c', 'd']));

    // Previous replays the cursor that page was reached with (React Query
    // may refetch it), so no request is ever made for any other page.
    expect([...new Set(requestedUrls(fetchMock))]).toEqual([
      '/api/things?filter=x&limit=2',
      '/api/things?filter=x&limit=2&startKey=b',
      '/api/things?filter=x&limit=2&startKey=d',
    ]);
  });

  it('keeps Next available on an empty page that still has a cursor', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({things: [], nextStartKey: 'skipped'}),
      }))
    );
    const {result} = renderThings();
    await waitFor(() => expect(result.current.items).toEqual([]));
    expect(result.current.hasNextPage).toBe(true);
  });

  it('restarts from the first page when the page size or scope changes', async () => {
    const {result, rerender} = renderThings();
    await waitFor(() => expect(ids(result.current.items)).toEqual(['a', 'b']));
    act(() => result.current.goNext());
    await waitFor(() => expect(ids(result.current.items)).toEqual(['c', 'd']));

    act(() => result.current.changePageSize(3));
    await waitFor(() =>
      expect(ids(result.current.items)).toEqual(['a', 'b', 'c'])
    );
    expect(result.current.pageIndex).toBe(0);

    act(() => result.current.goNext());
    await waitFor(() => expect(ids(result.current.items)).toEqual(['d', 'e']));
    rerender({filter: 'y'});
    await waitFor(() =>
      expect(ids(result.current.items)).toEqual(['a', 'b', 'c'])
    );
    expect(result.current.pageIndex).toBe(0);
    expect(requestedUrls(fetchMock).at(-1)).toBe(
      '/api/things?filter=y&limit=3'
    );
  });

  describe('search', () => {
    const renderSearchable = () =>
      renderHook(
        () =>
          usePagedList<ThingPage, 'things'>({
            user: mockUser,
            scope: 'x',
            searchable: true,
            defaultPageSize: 2,
            buildRequest: buildThingsRequest('x'),
            itemsKey: 'things',
          }),
        {wrapper: createWrapper()}
      );

    beforeEach(() => {
      fetchMock = stubThingsApi(['a1', 'a2', 'a3', 'b1', 'b2']);
    });

    it('offers no search box unless the list is searchable', async () => {
      const {result} = renderThings();
      await waitFor(() => expect(result.current.items).toBeDefined());
      expect(result.current.serverSearch).toBeUndefined();
    });

    it('requests the text typed and pages through its results', async () => {
      const {result} = renderSearchable();
      await waitFor(() =>
        expect(ids(result.current.items)).toEqual(['a1', 'a2'])
      );
      expect(result.current.serverSearch?.value).toBe('');

      act(() => result.current.serverSearch?.onChange('a'));
      expect(result.current.serverSearch?.value).toBe('a');
      await waitFor(() =>
        expect(requestedUrls(fetchMock)).toContain(
          '/api/things?filter=x&q=a&limit=2'
        )
      );

      act(() => result.current.serverSearch?.onChange('b'));
      await waitFor(() =>
        expect(ids(result.current.items)).toEqual(['b1', 'b2'])
      );
      expect(result.current.hasNextPage).toBe(false);

      act(() => result.current.serverSearch?.onChange('a'));
      await waitFor(() =>
        expect(ids(result.current.items)).toEqual(['a1', 'a2'])
      );
      act(() => result.current.goNext());
      await waitFor(() => expect(ids(result.current.items)).toEqual(['a3']));
      expect(requestedUrls(fetchMock).at(-1)).toBe(
        '/api/things?filter=x&q=a&limit=2&startKey=a2'
      );
    });

    it('goes back to the first page when the search changes', async () => {
      const {result} = renderSearchable();
      await waitFor(() =>
        expect(ids(result.current.items)).toEqual(['a1', 'a2'])
      );
      act(() => result.current.goNext());
      await waitFor(() =>
        expect(ids(result.current.items)).toEqual(['a3', 'b1'])
      );
      expect(result.current.pageIndex).toBe(1);

      act(() => result.current.serverSearch?.onChange('b'));
      await waitFor(() =>
        expect(ids(result.current.items)).toEqual(['b1', 'b2'])
      );
      expect(result.current.pageIndex).toBe(0);
      // A cursor from the unsearched list is never sent with the search.
      expect(requestedUrls(fetchMock).at(-1)).toBe(
        '/api/things?filter=x&q=b&limit=2'
      );

      // Emptying the box returns to the first page of the whole list.
      act(() => result.current.serverSearch?.onChange(''));
      await waitFor(() =>
        expect(ids(result.current.items)).toEqual(['a1', 'a2'])
      );
      expect(result.current.pageIndex).toBe(0);
    });
  });

  it('does not fetch while disabled', () => {
    renderHook(
      () =>
        usePagedList<ThingPage, 'things'>({
          user: mockUser,
          enabled: false,
          scope: 'x',
          buildRequest: buildThingsRequest('x'),
          itemsKey: 'things',
        }),
      {wrapper: createWrapper()}
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses fetchPage instead of the plain GET when given', async () => {
    const fetchPage = vi.fn(async (path: string) => ({
      things: [{id: `from ${path}`}],
    }));
    const {result} = renderHook(
      () =>
        usePagedList<ThingPage, 'things'>({
          user: mockUser,
          scope: 'x',
          defaultPageSize: 2,
          buildRequest: buildThingsRequest('x'),
          itemsKey: 'things',
          fetchPage,
        }),
      {wrapper: createWrapper()}
    );
    await waitFor(() =>
      expect(ids(result.current.items)).toEqual([
        'from /api/things?filter=x&limit=2',
      ])
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('useInfiniteList', () => {
  it('accumulates pages in server order until the cursor runs out', async () => {
    const fetchMock = stubThingsApi(['a', 'b', 'c', 'd', 'e']);
    const {result} = renderHook(
      () =>
        useInfiniteList<ThingPage, 'things'>({
          user: mockUser,
          pageSize: 2,
          buildRequest: buildThingsRequest('x'),
          itemsKey: 'things',
        }),
      {wrapper: createWrapper()}
    );

    await waitFor(() =>
      expect(result.current.items.map(t => t.id)).toEqual(['a', 'b'])
    );
    expect(result.current.hasNextPage).toBe(true);

    await act(async () => {
      await result.current.fetchNextPage();
    });
    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() =>
      expect(result.current.items.map(t => t.id)).toEqual([
        'a',
        'b',
        'c',
        'd',
        'e',
      ])
    );
    expect(result.current.hasNextPage).toBe(false);
    expect(requestedUrls(fetchMock)).toEqual([
      '/api/things?filter=x&limit=2',
      '/api/things?filter=x&limit=2&startKey=b',
      '/api/things?filter=x&limit=2&startKey=d',
    ]);
  });
});
