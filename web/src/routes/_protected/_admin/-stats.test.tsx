// SPDX-License-Identifier: Apache-2.0
/*
 * Stats page: denied without VIEW_SYSTEM_STATS, fetches on landing, Refresh
 * POSTs once, and team/people tables page from the API.
 */
import {Action, Role} from '@faims3/data-model';
import {fireEvent, render, screen} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {User} from '@/context/auth-provider';
import {displayIsoTimestamp} from '@/lib/time';

const canSeeStats = vi.hoisted(() => ({value: true}));

const useGetAdminStats = vi.hoisted(() => vi.fn());
const useGetAdminStatsTeams = vi.hoisted(() => vi.fn());
const useGetAdminStatsPeople = vi.hoisted(() => vi.fn());
const useRefreshAdminStats = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/use-breadcrumbs', () => ({
  useBreadcrumbUpdate: () => undefined,
}));

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (opts: {component: unknown}) => opts,
}));

vi.mock('@/hooks/auth-hooks', () => ({
  useRequiredUser: () => mockUser,
  useIsAuthorisedTo: ({action}: {action: Action}) =>
    action === Action.VIEW_SYSTEM_STATS ? canSeeStats.value : false,
}));

vi.mock('@/hooks/queries', () => ({
  useGetAdminStats: (args: unknown) => useGetAdminStats(args),
  useGetAdminStatsTeams: (args: unknown) => useGetAdminStatsTeams(args),
  useGetAdminStatsPeople: (args: unknown) => useGetAdminStatsPeople(args),
  useRefreshAdminStats: (args: unknown) => useRefreshAdminStats(args),
}));

import {StatsPage} from './stats';

const mockUser: User = {
  user: {
    id: 'admin',
    name: 'Admin',
    email: 'admin@example.com',
    isVerified: true,
  },
  token: 'token',
  refreshToken: 'refresh',
  decodedToken: {
    username: 'admin',
    name: 'Admin',
    server: 'http://localhost',
    exp: 9e9,
    globalRoles: [Role.GENERAL_ADMIN],
    resourceRoles: [],
  },
};

const overall = {
  generatedAt: '2026-11-08T10:00:00.000Z',
  expiresAt: '2026-11-08T10:02:00.000Z',
  teamCount: 2,
  userCount: 4,
  loggedInUserCount: 1,
  notebookCount: 3,
  archivedNotebookCount: 1,
  templateCount: 1,
  archivedTemplateCount: 0,
  mapAssetCount: 0,
  mapAssetByteCount: 2_097_152,
  recordCount: 5,
  attachmentCount: 2,
  byteCount: 1_474_208,
  disabledUserCount: 0,
  inviteCount: 0,
  longLivedTokenCount: 0,
  tombstoneCount: 0,
  incomplete: false,
};

/** React Query stub: idle unless the test overlays `data` / fetch flags. */
function idleQuery(extra: Record<string, unknown> = {}) {
  return {
    data: undefined,
    isPending: false,
    isFetched: false,
    isFetching: false,
    ...extra,
  };
}

describe('Stats page', () => {
  const refreshMutate = vi.fn();

  beforeEach(() => {
    canSeeStats.value = true;
    refreshMutate.mockReset();
    useGetAdminStats.mockReset();
    useGetAdminStatsTeams.mockReset();
    useGetAdminStatsPeople.mockReset();
    useRefreshAdminStats.mockReset();
    useGetAdminStats.mockReturnValue(idleQuery());
    useGetAdminStatsTeams.mockReturnValue(
      idleQuery({data: {teams: [], total: 0}})
    );
    useGetAdminStatsPeople.mockReturnValue(
      idleQuery({data: {people: [], total: 0}})
    );
    useRefreshAdminStats.mockReturnValue({
      mutate: refreshMutate,
      isPending: false,
    });
  });

  it('shows a denied state without VIEW_SYSTEM_STATS', () => {
    canSeeStats.value = false;
    render(<StatsPage />);
    expect(
      screen.getByText('You do not have access to view this page.')
    ).toBeDefined();
    expect(screen.queryByTestId('web-stats-load')).toBeNull();
    expect(screen.queryByTestId('web-stats-refresh')).toBeNull();
    expect(screen.queryByTestId('web-stats-generated-at')).toBeNull();
    expect(useGetAdminStats).toHaveBeenCalledWith(
      expect.objectContaining({enabled: false})
    );
  });

  it('fetches on landing and Refresh POSTs once', () => {
    useGetAdminStats.mockImplementation(({enabled}: {enabled: boolean}) =>
      idleQuery({
        data: enabled ? overall : undefined,
        isFetched: enabled,
      })
    );
    useGetAdminStatsTeams.mockImplementation(
      ({
        enabled,
        limit,
        offset,
      }: {
        enabled: boolean;
        limit: number;
        offset: number;
      }) =>
        idleQuery({
          data: enabled
            ? {
                teams: [
                  {
                    teamId: 't1',
                    name: 'Team 1',
                    notebookCount: 1,
                    recordCount: 1,
                    attachmentCount: 0,
                    byteCount: 10_240,
                    mapAssetByteCount: 512,
                  },
                ],
                total: 25,
                limit,
                offset,
              }
            : {teams: [], total: 0},
          isFetched: enabled,
        })
    );
    useGetAdminStatsPeople.mockImplementation(({enabled}: {enabled: boolean}) =>
      idleQuery({
        data: enabled ? {people: [], total: 0} : {people: [], total: 0},
        isFetched: enabled,
      })
    );

    render(<StatsPage />);

    expect(useGetAdminStats).toHaveBeenCalledWith(
      expect.objectContaining({enabled: true})
    );
    expect(useGetAdminStatsTeams).toHaveBeenCalledWith(
      expect.objectContaining({enabled: true, limit: 10, offset: 0})
    );
    expect(useGetAdminStatsPeople).toHaveBeenCalledWith(
      expect.objectContaining({enabled: true, limit: 10, offset: 0})
    );
    expect(screen.queryByTestId('web-stats-load')).toBeNull();
    expect(screen.queryByTestId('web-stats-empty')).toBeNull();
    expect(screen.queryByTestId('web-stats-cache-times')).toBeNull();
    expect(screen.queryByText(/cached until/i)).toBeNull();
    expect(screen.getByTestId('web-stats-generated-at').textContent).toBe(
      `Generated ${displayIsoTimestamp(overall.generatedAt)}`
    );
    expect(
      screen.getByTestId('web-stats-generated-at').getAttribute('dateTime')
    ).toBe(overall.generatedAt);
    expect(screen.queryByText('Storage (bytes)')).toBeNull();
    expect(screen.getByText('Logged in users')).toBeDefined();
    expect(screen.getByText('1.41 MB')).toBeDefined();
    expect(screen.getByText('2 MB')).toBeDefined();
    expect(screen.getByText('10 KB')).toBeDefined();
    expect(screen.getByText('512 Bytes')).toBeDefined();

    fireEvent.click(screen.getByTestId('web-stats-refresh'));

    expect(refreshMutate).toHaveBeenCalled();
    const lastTeamsCall = useGetAdminStatsTeams.mock.calls.at(-1)?.[0] as {
      refresh?: boolean;
    };
    const lastPeopleCall = useGetAdminStatsPeople.mock.calls.at(-1)?.[0] as {
      refresh?: boolean;
    };
    expect(lastTeamsCall).not.toHaveProperty('refresh');
    expect(lastPeopleCall).not.toHaveProperty('refresh');
  });

  it('renders a warning alert when the snapshot is incomplete', () => {
    useGetAdminStats.mockReturnValue(
      idleQuery({data: {...overall, incomplete: true}, isFetched: true})
    );

    render(<StatsPage />);

    expect(screen.getByTestId('web-stats-incomplete').textContent).toMatch(
      /could not be scanned/i
    );
  });

  it('passes pagination params through to the list queries', () => {
    useGetAdminStats.mockReturnValue(
      idleQuery({data: overall, isFetched: true})
    );
    useGetAdminStatsTeams.mockImplementation(
      ({limit, offset}: {limit: number; offset: number}) =>
        idleQuery({
          data: {teams: [], total: 25, limit, offset},
          isFetched: true,
        })
    );
    useGetAdminStatsPeople.mockImplementation(
      ({limit, offset}: {limit: number; offset: number}) =>
        idleQuery({
          data: {people: [], total: 25, limit, offset},
          isFetched: true,
        })
    );

    render(<StatsPage />);

    expect(useGetAdminStatsTeams).toHaveBeenCalledWith(
      expect.objectContaining({limit: 10, offset: 0})
    );

    const nextButtons = screen.getAllByRole('button', {
      name: 'Go to next page',
    });
    fireEvent.click(nextButtons[0]);

    expect(useGetAdminStatsTeams).toHaveBeenCalledWith(
      expect.objectContaining({limit: 10, offset: 10})
    );
  });
});
