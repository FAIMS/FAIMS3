// SPDX-License-Identifier: Apache-2.0
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {act, renderHook, waitFor} from '@testing-library/react';
import {Action, Role} from '@faims3/data-model';
import {createElement, type ReactNode} from 'react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {User} from '@/context/auth-provider';
import {PICKER_PAGE_SIZE} from '@/hooks/paged-list';
import {usePossibleTeamsForAction, useTeamOptions} from './use-team-options';

type Team = {_id: string; name: string; archived?: boolean};

function userWith(
  resourceRoles: {resourceId: string; role: Role}[] = []
): User {
  return {
    user: {id: 'u', name: 'U', emails: [], globalRoles: []},
    token: 'token',
    refreshToken: 'refresh',
    decodedToken: {globalRoles: [], resourceRoles},
  } as unknown as User;
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {queries: {retry: false}},
  });
  return function Wrapper({children}: {children: ReactNode}) {
    return createElement(QueryClientProvider, {client: queryClient}, children);
  };
}

/**
 * Serves GET /api/teams/ (paged, in `teams` order, active only; with `q`,
 * only teams with a word starting with it) and GET /api/teams/:id (404 for
 * an unknown id).
 */
function stubTeamsApi(teams: Team[]) {
  const fetchMock = vi.fn(async (input: unknown) => {
    const url = new URL(String(input));
    const byId = url.pathname.match(/^\/api\/teams\/([^/]+)$/);
    if (byId) {
      const team = teams.find(t => t._id === byId[1]);
      return team
        ? {ok: true, json: async () => team}
        : {
            ok: false,
            status: 404,
            statusText: 'Not Found',
            json: async () => ({}),
          };
    }
    const q = url.searchParams.get('q')?.toLowerCase();
    const active = teams.filter(
      t =>
        !t.archived &&
        (!q ||
          t.name
            .toLowerCase()
            .split(' ')
            .some(word => word.startsWith(q)))
    );
    const limit = Number(url.searchParams.get('limit'));
    const startKey = url.searchParams.get('startKey');
    const from = startKey ? active.findIndex(t => t._id === startKey) + 1 : 0;
    const page = active.slice(from, from + limit);
    return {
      ok: true,
      json: async () => ({
        teams: page,
        ...(from + limit < active.length
          ? {nextStartKey: page[page.length - 1]._id}
          : {}),
      }),
    };
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const paths = (fetchMock: ReturnType<typeof stubTeamsApi>) =>
  fetchMock.mock.calls.map(([input]) => new URL(String(input)).pathname);

/** The `q` of each team-list request that had one, in order. */
const searches = (fetchMock: ReturnType<typeof stubTeamsApi>) =>
  fetchMock.mock.calls.flatMap(([input]) => {
    const q = new URL(String(input)).searchParams.get('q');
    return q === null ? [] : [q];
  });

const manyTeams = (count: number): Team[] =>
  Array.from({length: count}, (_, i) => ({
    _id: `team-${i + 1}`,
    name: `Team ${i + 1}`,
  }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useTeamOptions', () => {
  it('fetches exactly the eligible teams by id, however many teams exist', async () => {
    const fetchMock = stubTeamsApi([
      ...manyTeams(200),
      {_id: 'zebra', name: 'Zebra'},
      {_id: 'apple', name: 'Apple'},
      {_id: 'gone', name: 'Gone', archived: true},
    ]);
    const {result} = renderHook(
      () =>
        useTeamOptions({
          user: userWith(),
          eligibleTeamIds: ['zebra', 'apple', 'gone', 'deleted', 'zebra'],
        }),
      {wrapper: createWrapper()}
    );

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    // Archived and missing teams are dropped; the rest are in name order.
    expect(result.current.teams).toEqual([
      {_id: 'apple', name: 'Apple'},
      {_id: 'zebra', name: 'Zebra'},
    ]);
    expect(result.current.more).toBeUndefined();
    // The team list itself is never requested.
    expect(paths(fetchMock).sort()).toEqual([
      '/api/teams/apple',
      '/api/teams/deleted',
      '/api/teams/gone',
      '/api/teams/zebra',
    ]);
  });

  it('is ready at once when no team is eligible', () => {
    const fetchMock = stubTeamsApi(manyTeams(3));
    const {result} = renderHook(
      () => useTeamOptions({user: userWith(), eligibleTeamIds: []}),
      {wrapper: createWrapper()}
    );
    expect(result.current).toEqual({teams: [], isLoading: false});
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('pages every visible team and reports when more remain', async () => {
    const total = PICKER_PAGE_SIZE + 5;
    stubTeamsApi(manyTeams(total));
    const {result} = renderHook(() => useTeamOptions({user: userWith()}), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.teams).toHaveLength(PICKER_PAGE_SIZE);
    expect(result.current.more).toMatchObject({
      paged: true,
      hasNextPage: true,
    });

    act(() => result.current.more?.fetchNextPage());
    await waitFor(() => expect(result.current.teams).toHaveLength(total));
    // Still a paged picker after the last page arrives, with nothing more.
    expect(result.current.more).toMatchObject({
      paged: true,
      hasNextPage: false,
    });
  });

  it('is not paged when every team fits on the first page', async () => {
    stubTeamsApi(manyTeams(3));
    const {result} = renderHook(() => useTeamOptions({user: userWith()}), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.teams.map(t => t._id)).toEqual([
      'team-1',
      'team-2',
      'team-3',
    ]);
    expect(result.current.more).toMatchObject({
      paged: false,
      hasNextPage: false,
    });
  });

  it('offers ensureTeamId before its page is loaded, without duplicating it later', async () => {
    const total = PICKER_PAGE_SIZE + 5;
    const last = `team-${total}`;
    stubTeamsApi(manyTeams(total));
    const {result} = renderHook(
      () => useTeamOptions({user: userWith(), ensureTeamId: last}),
      {wrapper: createWrapper()}
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.teams[0]).toEqual({_id: last, name: `Team ${total}`});
    expect(result.current.teams).toHaveLength(PICKER_PAGE_SIZE + 1);

    act(() => result.current.more?.fetchNextPage());
    await waitFor(() => expect(result.current.teams).toHaveLength(total));
    expect(result.current.teams.filter(t => t._id === last)).toHaveLength(1);
  });

  it('does not offer an archived ensureTeamId', async () => {
    stubTeamsApi([...manyTeams(2), {_id: 'old', name: 'Old', archived: true}]);
    const {result} = renderHook(
      () => useTeamOptions({user: userWith(), ensureTeamId: 'old'}),
      {wrapper: createWrapper()}
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.teams.map(t => t._id)).toEqual(['team-1', 'team-2']);
  });
});

describe('useTeamOptions search', () => {
  const total = PICKER_PAGE_SIZE + 5;
  // Far past the first page: reachable only by Get more, or by searching.
  const zebra = {_id: 'zebra', name: 'Plains Zebra'};

  const renderOptions = (teams: Team[] = [...manyTeams(total), zebra]) => {
    const fetchMock = stubTeamsApi(teams);
    const hook = renderHook(() => useTeamOptions({user: userWith()}), {
      wrapper: createWrapper(),
    });
    return {...hook, fetchMock};
  };

  it('offers a search box, with no results while it is empty', async () => {
    const {result, fetchMock} = renderOptions();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.more?.search).toMatchObject({value: ''});
    expect(result.current.more?.search?.results).toBeUndefined();
    expect(searches(fetchMock)).toEqual([]);
  });

  it('finds a team that is not on a loaded page', async () => {
    const {result, fetchMock} = renderOptions();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const loaded = result.current.teams;
    expect(loaded.some(team => team._id === 'zebra')).toBe(false);

    act(() => result.current.more?.search?.onChange('zeb'));
    // Searching at once, before the request for the text is sent.
    expect(result.current.more?.search).toMatchObject({
      value: 'zeb',
      results: {teams: [], isPending: true, isError: false},
    });
    await waitFor(() =>
      expect(result.current.more?.search?.results).toEqual({
        teams: [zebra],
        isPending: false,
        isError: false,
      })
    );
    expect(searches(fetchMock)).toEqual(['zeb']);
    expect(result.current.more).toMatchObject({
      paged: true,
      hasNextPage: false,
    });
    // The options that defaults are derived from are not narrowed.
    expect(result.current.teams).toEqual(loaded);
    expect(result.current.isLoading).toBe(false);
  });

  it('sends one request once typing pauses, not one per letter', async () => {
    const {result, fetchMock} = renderOptions();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    for (const text of ['z', 'ze', 'zeb']) {
      act(() => result.current.more?.search?.onChange(text));
    }
    await waitFor(() =>
      expect(result.current.more?.search?.results?.teams).toEqual([zebra])
    );
    expect(searches(fetchMock)).toEqual(['zeb']);
  });

  it('pages the results with Get more', async () => {
    const {result} = renderOptions();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const loaded = result.current.teams.length;

    // Every "Team N" matches, so the results span two pages.
    act(() => result.current.more?.search?.onChange('team'));
    await waitFor(() =>
      expect(result.current.more?.search?.results?.teams).toHaveLength(
        PICKER_PAGE_SIZE
      )
    );
    expect(result.current.more?.hasNextPage).toBe(true);

    act(() => result.current.more?.fetchNextPage());
    await waitFor(() =>
      expect(result.current.more?.search?.results?.teams).toHaveLength(total)
    );
    expect(result.current.more?.hasNextPage).toBe(false);
    // Get more went to the results, not to the unsearched list.
    expect(result.current.teams).toHaveLength(loaded);
  });

  it('returns to the loaded teams when the box is emptied', async () => {
    const {result} = renderOptions();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.more?.search?.onChange('zeb'));
    await waitFor(() =>
      expect(result.current.more?.search?.results?.teams).toEqual([zebra])
    );

    act(() => result.current.more?.search?.onChange(''));
    expect(result.current.more?.search?.results).toBeUndefined();
    expect(result.current.more).toMatchObject({paged: true, hasNextPage: true});
  });

  it('reports a failed search without failing the picker', async () => {
    const {result, fetchMock} = renderOptions();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const listTeams = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (input: unknown) =>
      new URL(String(input)).searchParams.has('q')
        ? {
            ok: false,
            status: 500,
            statusText: 'Server Error',
            json: async () => ({}),
          }
        : listTeams(input)
    );

    act(() => result.current.more?.search?.onChange('zeb'));
    await waitFor(() =>
      expect(result.current.more?.search?.results).toMatchObject({
        isPending: false,
        isError: true,
      })
    );
    expect(result.current.isLoading).toBe(false);
    expect(result.current.teams).toHaveLength(PICKER_PAGE_SIZE);
  });

  it('has no search when the teams are fetched by id', async () => {
    stubTeamsApi([zebra]);
    const {result} = renderHook(
      () => useTeamOptions({user: userWith(), eligibleTeamIds: ['zebra']}),
      {wrapper: createWrapper()}
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.more).toBeUndefined();
  });
});

describe('usePossibleTeamsForAction', () => {
  it('gives a team-scoped creator the teams their token allows, beyond the first page', async () => {
    // The user's only team is the oldest of 200, far past any first page.
    const fetchMock = stubTeamsApi([
      ...manyTeams(200),
      {_id: 'mine', name: 'Mine'},
    ]);
    const user = userWith([
      {resourceId: 'mine', role: Role.TEAM_MANAGER},
      {resourceId: 'team-1', role: Role.TEAM_MEMBER},
    ]);
    const {result} = renderHook(
      () =>
        usePossibleTeamsForAction({
          user,
          canCreateGlobally: false,
          createInTeamAction: Action.CREATE_PROJECT_IN_TEAM,
        }),
      {wrapper: createWrapper()}
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.possibleTeams).toEqual([{_id: 'mine', name: 'Mine'}]);
    expect(result.current.more).toBeUndefined();
    expect(paths(fetchMock)).toEqual(['/api/teams/mine']);
  });

  it('gives a global creator every visible team, a page at a time', async () => {
    const total = PICKER_PAGE_SIZE + 1;
    stubTeamsApi(manyTeams(total));
    const {result} = renderHook(
      () =>
        usePossibleTeamsForAction({
          user: userWith(),
          canCreateGlobally: true,
          createInTeamAction: Action.CREATE_PROJECT_IN_TEAM,
        }),
      {wrapper: createWrapper()}
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.possibleTeams).toHaveLength(PICKER_PAGE_SIZE);
    expect(result.current.more?.hasNextPage).toBe(true);
  });
});
