// SPDX-License-Identifier: Apache-2.0
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {act, renderHook, waitFor} from '@testing-library/react';
import {createElement, type ReactNode} from 'react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {User} from '@/context/auth-provider';
import {
  listPath,
  useInfiniteList,
  useListCursor,
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
  ({limit, startKey}: ListPageArgs) => ({
    path: listPath('/api/things', {filter, limit, startKey}),
    queryKey: ['things', filter, limit ?? null, startKey ?? null],
  });

/**
 * Serves `/api/things` from `ids` the way the API does: `limit` rows after
 * the exclusive `startKey`, with `nextStartKey` while rows remain.
 */
function stubThingsApi(ids: string[]) {
  const fetchMock = vi.fn(async (input: unknown) => {
    const url = new URL(String(input));
    const limit = Number(url.searchParams.get('limit'));
    const startKey = url.searchParams.get('startKey');
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
