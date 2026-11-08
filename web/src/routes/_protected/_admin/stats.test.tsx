// SPDX-License-Identifier: Apache-2.0
import {Action, Role} from '@faims3/data-model';
import {fireEvent, render, screen} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {User} from '@/context/auth-provider';

const canSeeStats = vi.hoisted(() => ({value: true}));

const useGetAdminStats = vi.hoisted(() => vi.fn());
const useGetAdminStatsTeams = vi.hoisted(() => vi.fn());
const useGetAdminStatsPeople = vi.hoisted(() => vi.fn());

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
  notebookCount: 3,
  archivedNotebookCount: 1,
  templateCount: 1,
  archivedTemplateCount: 0,
  mapAssetCount: 0,
  recordCount: 5,
  attachmentCount: 2,
  byteCount: 100,
  disabledUserCount: 0,
  inviteCount: 0,
  longLivedTokenCount: 0,
  tombstoneCount: 0,
  incomplete: false,
};

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
  beforeEach(() => {
    canSeeStats.value = true;
    useGetAdminStats.mockReset();
    useGetAdminStatsTeams.mockReset();
    useGetAdminStatsPeople.mockReset();
    useGetAdminStats.mockReturnValue(idleQuery());
    useGetAdminStatsTeams.mockReturnValue(
      idleQuery({data: {teams: [], total: 0}})
    );
    useGetAdminStatsPeople.mockReturnValue(
      idleQuery({data: {people: [], total: 0}})
    );
  });

  it('shows a denied state without VIEW_SYSTEM_STATS', () => {
    canSeeStats.value = false;
    render(<StatsPage />);
    expect(
      screen.getByText('You do not have access to view this page.')
    ).toBeDefined();
    expect(screen.queryByTestId('web-stats-load')).toBeNull();
  });

  it('does not enable stats queries until Load, then Refresh bypasses cache', () => {
    useGetAdminStats.mockImplementation(
      ({enabled}: {enabled: boolean; refresh: boolean}) =>
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
                    byteCount: 10,
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
      expect.objectContaining({enabled: false, refresh: false})
    );
    expect(useGetAdminStatsTeams).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
        limit: 10,
        offset: 0,
        refresh: false,
      })
    );
    expect(screen.getByTestId('web-stats-empty')).toBeDefined();
    expect(screen.queryByTestId('web-stats-cache-times')).toBeNull();

    fireEvent.click(screen.getByTestId('web-stats-load'));

    expect(useGetAdminStats).toHaveBeenCalledWith(
      expect.objectContaining({enabled: true, refresh: false})
    );
    expect(screen.getByTestId('web-stats-cache-times').textContent).toContain(
      overall.generatedAt
    );
    expect(screen.getByTestId('web-stats-cache-times').textContent).toContain(
      overall.expiresAt
    );
    expect(
      screen.getByText(
        'as of 2026-11-08T10:00:00.000Z, cached until 2026-11-08T10:02:00.000Z'
      )
    ).toBeDefined();

    fireEvent.click(screen.getByTestId('web-stats-refresh'));

    expect(useGetAdminStats).toHaveBeenCalledWith(
      expect.objectContaining({enabled: true, refresh: true})
    );
    expect(useGetAdminStatsTeams).toHaveBeenCalledWith(
      expect.objectContaining({enabled: true, refresh: true})
    );
    expect(useGetAdminStatsPeople).toHaveBeenCalledWith(
      expect.objectContaining({enabled: true, refresh: true})
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
    fireEvent.click(screen.getByTestId('web-stats-load'));

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
