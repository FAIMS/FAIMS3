// SPDX-License-Identifier: Apache-2.0
/**
 * Shared client side of the list contract every paginated endpoint follows:
 * `limit` + exclusive `startKey` in, `{<items>, nextStartKey?}` out.
 *
 * - {@link listPath} builds the request path.
 * - {@link usePagedList} drives a table: one page per request, Next follows
 *   `nextStartKey`, Previous replays the cursor the page was reached with.
 * - {@link useInfiniteList} drives a picker: pages accumulate behind a
 *   "Get more" button.
 * - {@link useListSearch} holds a search box's text and the debounced `q`
 *   sent to lists that support search.
 *
 * Resource hooks in `queries.ts` and `map-asset-hooks.ts` are thin wrappers
 * that supply a request builder and the name of the items field.
 */
import type {
  DataTableServerPagination,
  DataTableServerSearch,
} from '@/components/data-table/pagination';
import type {User} from '@/context/auth-provider';
import {useInfiniteQuery, useQuery} from '@tanstack/react-query';
import {useEffect, useMemo, useState} from 'react';
import {get} from './api-fetch';

/** A list response: some items field plus the optional cursor to the next page. */
export type ListResponse = {nextStartKey?: string};

/**
 * The paging part of a list request. `q` is the search text, on lists that
 * support it; a search pages like any other list.
 */
export type ListPageArgs = {limit?: number; startKey?: string; q?: string};

/** Path to GET and the React Query key that identifies that exact page. */
export type ListRequest = {path: string; queryKey: readonly unknown[]};

/** Default rows per page for Control Centre tables. */
export const TABLE_DEFAULT_PAGE_SIZE = 15;

/** Rows per "Get more" step in pickers. */
export const PICKER_PAGE_SIZE = 25;

/** How long typing must pause before a search request is sent. */
export const LIST_SEARCH_DEBOUNCE_MS = 300;

/**
 * Text of a search box and the `q` to request with.
 *
 * `input` follows every keystroke. `q` is the trimmed text once typing has
 * paused for `delayMs`, so a request is not sent per letter. Clearing the box
 * clears `q` at once.
 */
export function useListSearch(delayMs: number = LIST_SEARCH_DEBOUNCE_MS) {
  const [input, setInputState] = useState('');
  const [q, setQ] = useState('');
  const trimmed = input.trim();

  useEffect(() => {
    if (trimmed === '') return;
    const timer = setTimeout(() => setQ(trimmed), delayMs);
    return () => clearTimeout(timer);
  }, [trimmed, delayMs]);

  const setInput = (value: string) => {
    setInputState(value);
    if (value.trim() === '') setQ('');
  };
  return {input, setInput, q};
}

/**
 * `base` plus a query string of the defined params. `undefined`, `null`,
 * `false` and `''` are left out, so a flag is sent only when it is on.
 */
export function listPath(
  base: string,
  params: Record<string, string | number | boolean | null | undefined>
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === false) continue;
    if (value === '') continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `${base}?${qs}` : base;
}

type CursorState = {
  scope: string;
  startKey: string | undefined;
  /** `startKey` of each earlier page, oldest first; its length is the page index. */
  stack: (string | undefined)[];
};

/**
 * Cursor-stack state for one table. `scope` names the filters in force; when
 * it changes the table goes back to the first page, because a cursor from one
 * list means nothing in another.
 */
export function useListCursor({
  scope,
  defaultPageSize = TABLE_DEFAULT_PAGE_SIZE,
}: {
  scope: string;
  defaultPageSize?: number;
}) {
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [state, setState] = useState<CursorState>({
    scope,
    startKey: undefined,
    stack: [],
  });

  if (state.scope !== scope) {
    setState({scope, startKey: undefined, stack: []});
  }
  const current = state.scope === scope ? state : undefined;

  return {
    pageSize,
    startKey: current?.startKey,
    pageIndex: current?.stack.length ?? 0,
    /** Move to the page that starts after `nextStartKey`. */
    advance: (nextStartKey: string) =>
      setState(prev => ({
        ...prev,
        stack: [...prev.stack, prev.startKey],
        startKey: nextStartKey,
      })),
    goPrevious: () =>
      setState(prev =>
        prev.stack.length === 0
          ? prev
          : {
              ...prev,
              startKey: prev.stack[prev.stack.length - 1],
              stack: prev.stack.slice(0, -1),
            }
      ),
    goFirst: () =>
      setState(prev => ({...prev, stack: [], startKey: undefined})),
    changePageSize: (size: number) => {
      setPageSize(size);
      setState(prev => ({...prev, stack: [], startKey: undefined}));
    },
  };
}

export type ListCursor = ReturnType<typeof useListCursor>;

/**
 * Table paging controls for a cursor and the query showing its page.
 * Next stays available whenever `nextStartKey` is set, even on a short or
 * empty page: the server may have skipped rows the caller cannot see.
 */
export function pagedListControls(
  cursor: ListCursor,
  query: {data?: ListResponse; isPending: boolean; isFetching: boolean}
) {
  const nextStartKey = query.data?.nextStartKey;
  const hasNextPage = nextStartKey !== undefined && !query.isFetching;
  const canPreviousPage = cursor.pageIndex > 0;
  const goNext = () => {
    if (nextStartKey === undefined || query.isFetching) return;
    cursor.advance(nextStartKey);
  };
  const serverPagination: DataTableServerPagination = {
    pageIndex: cursor.pageIndex,
    pageSize: cursor.pageSize,
    hasNextPage,
    canPreviousPage,
    onNextPage: goNext,
    onPreviousPage: cursor.goPrevious,
    onFirstPage: cursor.goFirst,
    onPageSizeChange: cursor.changePageSize,
  };
  return {
    pageSize: cursor.pageSize,
    pageIndex: cursor.pageIndex,
    hasNextPage,
    canPreviousPage,
    /** True while the page shown is not the page asked for. */
    tableLoading: query.isPending || query.isFetching,
    goNext,
    goPrevious: cursor.goPrevious,
    goFirst: cursor.goFirst,
    changePageSize: cursor.changePageSize,
    /** Ready to pass as `<DataTable serverPagination>`. */
    serverPagination,
  };
}

/**
 * One table page of a paginated list. `buildRequest` turns the current
 * `limit` / `startKey` into a path and query key; `itemsKey` names the array
 * in the response. `fetchPage` replaces the plain GET when rows need work
 * before display (it runs for the visible page only).
 *
 * With `searchable`, the hook also holds a search box: `buildRequest`
 * receives the debounced `q`, a new search starts again from the first page,
 * and `serverSearch` is ready to pass to `<DataTable>`.
 */
export function usePagedList<
  TResponse extends ListResponse,
  TKey extends keyof TResponse,
>({
  user,
  enabled = true,
  scope,
  searchable = false,
  defaultPageSize,
  buildRequest,
  itemsKey,
  fetchPage,
}: {
  user: User | null;
  enabled?: boolean;
  scope: string;
  /** The list accepts `q`. Off for lists with no search (e.g. the archive). */
  searchable?: boolean;
  defaultPageSize?: number;
  buildRequest: (
    page: Required<Pick<ListPageArgs, 'limit'>> & ListPageArgs
  ) => ListRequest;
  itemsKey: TKey;
  fetchPage?: (path: string) => Promise<TResponse>;
}) {
  const search = useListSearch();
  const q = searchable ? search.q : '';
  // A cursor belongs to one search: a new `q` is a new scope.
  const cursor = useListCursor({
    scope: JSON.stringify([scope, q]),
    defaultPageSize,
  });
  const {path, queryKey} = buildRequest({
    limit: cursor.pageSize,
    startKey: cursor.startKey,
    ...(q ? {q} : {}),
  });
  const serverSearch: DataTableServerSearch | undefined = searchable
    ? {value: search.input, onChange: search.setInput}
    : undefined;
  const query = useQuery({
    queryKey,
    queryFn: () => (fetchPage ? fetchPage(path) : get<TResponse>(path, user)),
    enabled: !!user && enabled,
  });
  return {
    ...query,
    items: query.data?.[itemsKey] as TResponse[TKey] | undefined,
    ...pagedListControls(cursor, query),
    /** Ready to pass as `<DataTable serverSearch>`; absent when not searchable. */
    serverSearch,
  };
}

/**
 * A list that grows a page at a time, for pickers. `items` is every row
 * fetched so far in server order; call `fetchNextPage` while `hasNextPage`.
 */
export function useInfiniteList<
  TResponse extends ListResponse,
  TKey extends keyof TResponse,
>({
  user,
  enabled = true,
  pageSize = PICKER_PAGE_SIZE,
  buildRequest,
  itemsKey,
}: {
  user: User | null;
  enabled?: boolean;
  pageSize?: number;
  buildRequest: (
    page: Required<Pick<ListPageArgs, 'limit'>> & ListPageArgs
  ) => ListRequest;
  itemsKey: TKey;
}) {
  // The key names the list, not a page: drop the cursor so every page of the
  // same list shares one infinite query.
  const {queryKey} = buildRequest({limit: pageSize});
  const query = useInfiniteQuery({
    queryKey: [...queryKey, 'infinite'],
    queryFn: ({pageParam}) =>
      get<TResponse>(
        buildRequest({limit: pageSize, startKey: pageParam}).path,
        user
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: lastPage => lastPage.nextStartKey,
    enabled: !!user && enabled,
  });
  type Item = TResponse[TKey] extends Array<infer T> ? T : never;
  const items = useMemo(
    () => (query.data?.pages ?? []).flatMap(page => page[itemsKey] as Item[]),
    [query.data, itemsKey]
  );
  return {...query, items};
}
