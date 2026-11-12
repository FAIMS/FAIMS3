// SPDX-License-Identifier: Apache-2.0
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {renderHook, waitFor} from '@testing-library/react';
import {createElement, type ReactNode} from 'react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {User} from '@/context/auth-provider';
import {config} from '@/constants';
import {
  buildNotebooksListRequest,
  buildTeamMembersListRequest,
  buildTeamsListRequest,
  buildUsersListRequest,
  useGetProjects,
  useGetTemplates,
} from './queries';

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

describe('buildNotebooksListRequest', () => {
  it('asks for a lean active page by default', () => {
    const {path, queryKey} = buildNotebooksListRequest({}, mockUser);
    expect(path).toBe('/api/notebooks/');
    expect(queryKey[0]).toBe('projects');
  });

  it('sends paging, status and filters, and never byte counts unless asked', () => {
    expect(
      buildNotebooksListRequest(
        {limit: 10, startKey: '[1,"a"]', status: 'archived'},
        mockUser
      ).path
    ).toBe(
      '/api/notebooks/?status=archived&limit=10&startKey=%5B1%2C%22a%22%5D'
    );
    expect(
      buildNotebooksListRequest({templateId: 'tpl', limit: 10}, mockUser).path
    ).toBe('/api/notebooks/?templateId=tpl&limit=10');
    expect(
      buildNotebooksListRequest({includeByteCount: true}, mockUser).path
    ).toBe('/api/notebooks/?includeByteCount=true');
  });

  it('keys team lists under projectsbyteam and every page separately', () => {
    const first = buildNotebooksListRequest(
      {teamId: 'team-a', limit: 10},
      mockUser
    );
    const second = buildNotebooksListRequest(
      {teamId: 'team-a', limit: 10, startKey: '[1,"a"]'},
      mockUser
    );
    expect(first.path).toBe('/api/notebooks/?teamId=team-a&limit=10');
    expect(first.queryKey.slice(0, 3)).toEqual([
      'projectsbyteam',
      'token',
      'team-a',
    ]);
    expect(second.queryKey).not.toEqual(first.queryKey);
  });
});

describe('useGetProjects', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('requests one page without byte counts and returns the page object', async () => {
    const page = {
      notebooks: [{_id: 'p1', name: 'One'}],
      nextStartKey: '[1,"p1"]',
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => page,
    });
    vi.stubGlobal('fetch', fetchMock);

    const {result} = renderHook(
      () => useGetProjects({user: mockUser, limit: 10}),
      {wrapper: createWrapper()}
    );

    await waitFor(() => expect(result.current.data).toEqual(page));
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toBe(`${config.apiUrl}/api/notebooks/?limit=10`);
    expect(url).not.toContain('includeByteCount');
  });
});

describe('list request builders', () => {
  it('teams: archived flag and paging, keyed under teams', () => {
    expect(buildTeamsListRequest({}).path).toBe('/api/teams/');
    const archived = buildTeamsListRequest({
      includeArchived: true,
      limit: 25,
      startKey: 'c',
    });
    expect(archived.path).toBe(
      '/api/teams/?includeArchived=true&limit=25&startKey=c'
    );
    expect(archived.queryKey[0]).toBe('teams');
    expect(archived.queryKey).not.toEqual(
      buildTeamsListRequest({limit: 25, startKey: 'c'}).queryKey
    );
  });

  it('users: disabled-only flag and paging, keyed under users', () => {
    expect(buildUsersListRequest({limit: 15}).path).toBe('/api/users?limit=15');
    const disabled = buildUsersListRequest({includeArchived: true, limit: 15});
    expect(disabled.path).toBe('/api/users?includeArchived=true&limit=15');
    expect(disabled.queryKey[0]).toBe('users');
  });

  it('team members: keyed under teamusers for the team', () => {
    const request = buildTeamMembersListRequest('team-a', {limit: 10});
    expect(request.path).toBe('/api/teams/team-a/members?limit=10');
    expect(request.queryKey.slice(0, 2)).toEqual(['teamusers', 'team-a']);
  });
});

describe('useGetTemplates limit (paginated GET)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('does not send limit when the caller omits it (API defaults to 50)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({templates: []}),
    });
    vi.stubGlobal('fetch', fetchMock);

    renderHook(() => useGetTemplates({user: mockUser}), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toBe(`${config.apiUrl}/api/templates`);
    expect(url).not.toContain('limit=');
  });

  it('sends limit when the sidebar requests the recent cap', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({templates: [], nextStartKey: 'cursor'}),
    });
    vi.stubGlobal('fetch', fetchMock);

    renderHook(() => useGetTemplates({user: mockUser, limit: 10}), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toBe(`${config.apiUrl}/api/templates?limit=10`);
  });
});
