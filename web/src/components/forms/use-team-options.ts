// SPDX-License-Identifier: Apache-2.0
/**
 * Loads the teams a team picker offers, without downloading every team.
 *
 * GET /api/teams is paginated, so a picker cannot filter "the full list".
 * Two ways of loading cover every picker:
 *
 * - The caller knows exactly which teams qualify (a team-scoped creator: the
 *   ids are in their token). Those teams are fetched by id, so the result is
 *   complete however many teams exist.
 * - Any visible team qualifies (a global creator, or an assign-to-team
 *   dialog). Teams load a page at a time, newest first, and the picker shows
 *   "Get more" while further pages remain.
 */
import type {User} from '@/context/auth-provider';
import {get} from '@/hooks/api-fetch';
import {useInfiniteTeams} from '@/hooks/queries';
import {
  getUserResourcesForAction,
  type Action,
  type GetTeamByIdResponse,
} from '@faims3/data-model';
import {useQueries} from '@tanstack/react-query';
import {useMemo} from 'react';
import {
  getPossibleTeamsForAction,
  type TeamOption,
  type TeamPickerMore,
} from './template-team-field';

/**
 * Teams for a picker.
 *
 * @param eligibleTeamIds When set, exactly these teams are offered (archived
 *   or unreadable ones are dropped) and nothing is paged. When omitted, every
 *   visible active team is offered a page at a time.
 * @param ensureTeamId A team to offer even when it is not on a loaded page,
 *   such as the resource's current owner, so it can be the default value.
 */
export function useTeamOptions({
  user,
  eligibleTeamIds,
  ensureTeamId,
}: {
  user: User | null;
  eligibleTeamIds?: string[];
  ensureTeamId?: string;
}): {
  teams: TeamOption[];
  /** True until the options (and `ensureTeamId`) are ready to choose from. */
  isLoading: boolean;
  /** Paging state for the picker; absent when the options are complete. */
  more?: TeamPickerMore;
} {
  const fetchById = eligibleTeamIds !== undefined;
  const list = useInfiniteTeams({user, enabled: !fetchById});

  const idsToFetch = useMemo(
    () => [
      ...new Set(
        fetchById ? eligibleTeamIds : ensureTeamId ? [ensureTeamId] : []
      ),
    ],
    [fetchById, eligibleTeamIds, ensureTeamId]
  );
  // Same key as `useGetTeam`, so team pages and pickers share one cache.
  const fetched = useQueries({
    queries: idsToFetch.map(teamId => ({
      queryKey: ['teams', teamId],
      queryFn: () => get<GetTeamByIdResponse>(`/api/teams/${teamId}`, user),
      enabled: !!user,
      retry: false,
    })),
  });
  const fetchedPending = fetched.some(query => query.isPending);
  const fetchedTeams = fetched.flatMap(query =>
    query.data && !query.data.archived
      ? [{_id: query.data._id, name: query.data.name}]
      : []
  );
  // `useQueries` returns a new array every render; this string changes only
  // when the fetched teams do.
  const fetchedSignature = JSON.stringify(fetchedTeams);

  const teams = useMemo(() => {
    const byId = JSON.parse(fetchedSignature) as TeamOption[];
    if (fetchById) {
      return byId.sort((a, b) => a.name.localeCompare(b.name));
    }
    const loaded = list.items.map(({_id, name}) => ({_id, name}));
    const missing = byId.filter(
      team => !loaded.some(other => other._id === team._id)
    );
    return [...missing, ...loaded];
  }, [fetchById, fetchedSignature, list.items]);

  if (fetchById) {
    return {teams, isLoading: fetchedPending};
  }
  return {
    teams,
    isLoading: list.isPending || fetchedPending,
    more: {
      paged: (list.data?.pages.length ?? 0) > 1 || list.hasNextPage,
      hasNextPage: list.hasNextPage,
      isFetchingNextPage: list.isFetchingNextPage,
      fetchNextPage: () => void list.fetchNextPage(),
    },
  };
}

/**
 * Teams the user may put a new resource in.
 *
 * A global creator may use any visible team (paged, with Get more). A
 * team-scoped creator may use only the teams where their token grants
 * `createInTeamAction`; those are fetched by id so the list is complete and
 * the "exactly one team" callout is reliable.
 */
export function usePossibleTeamsForAction({
  user,
  canCreateGlobally,
  createInTeamAction,
  ensureTeamId,
}: {
  user: User;
  canCreateGlobally: boolean;
  createInTeamAction:
    | Action.CREATE_TEMPLATE_IN_TEAM
    | Action.CREATE_PROJECT_IN_TEAM
    | Action.CREATE_MAP_ASSET_IN_TEAM;
  ensureTeamId?: string;
}) {
  const decodedToken = user.decodedToken;
  const eligibleTeamIds = useMemo(
    () =>
      canCreateGlobally
        ? undefined
        : getUserResourcesForAction({decodedToken, action: createInTeamAction}),
    [canCreateGlobally, decodedToken, createInTeamAction]
  );
  const {teams, isLoading, more} = useTeamOptions({
    user,
    eligibleTeamIds,
    ensureTeamId,
  });
  const possibleTeams = useMemo(
    () =>
      getPossibleTeamsForAction({
        teams,
        canCreateGlobally,
        createInTeamAction,
        decodedToken,
      }),
    [teams, canCreateGlobally, createInTeamAction, decodedToken]
  );
  return {possibleTeams, isLoading, more};
}
