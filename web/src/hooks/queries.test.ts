// SPDX-License-Identifier: Apache-2.0
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {renderHook, waitFor} from '@testing-library/react';
import {createElement, type ReactNode} from 'react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {User} from '@/context/auth-provider';
import {config} from '@/constants';
import {notebooksListPath, useGetProjects, useGetTemplates} from './queries';

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

describe('notebooksListPath', () => {
  it('keeps includeByteCount=true for the Projects index default', () => {
    expect(notebooksListPath()).toBe('/api/notebooks/?includeByteCount=true');
    expect(
      notebooksListPath({includeArchived: true, includeByteCount: true})
    ).toBe('/api/notebooks/?includeByteCount=true&includeArchived=true');
  });

  it('omits includeByteCount=true for the sidebar name-only fetch', () => {
    expect(notebooksListPath({includeByteCount: false})).toBe(
      '/api/notebooks/'
    );
    expect(notebooksListPath({includeByteCount: false})).not.toContain(
      'includeByteCount=true'
    );
  });
});

describe('useGetProjects includeByteCount', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('requests byte counts by default so the Projects index still has stats', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    });
    vi.stubGlobal('fetch', fetchMock);

    renderHook(() => useGetProjects({user: mockUser}), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toBe(`${config.apiUrl}/api/notebooks/?includeByteCount=true`);
  });

  it('does not request includeByteCount=true when the sidebar asks for names only', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    });
    vi.stubGlobal('fetch', fetchMock);

    renderHook(
      () => useGetProjects({user: mockUser, includeByteCount: false}),
      {wrapper: createWrapper()}
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).not.toContain('includeByteCount=true');
    expect(url).toBe(`${config.apiUrl}/api/notebooks/`);
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
