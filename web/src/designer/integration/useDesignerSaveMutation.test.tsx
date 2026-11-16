// SPDX-License-Identifier: Apache-2.0

import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {renderHook, waitFor} from '@testing-library/react';
import type {ReactNode} from 'react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {
  DesignerUiSpecConflictError,
  useDesignerSaveMutation,
} from './useDesignerSaveMutation';

vi.mock('sonner', () => ({
  toast: {
    loading: vi.fn(() => 'toast-id'),
    success: vi.fn(),
    error: vi.fn(),
    dismiss: vi.fn(),
  },
}));

const HASH = 'a'.repeat(64);

const wrapper = ({children}: {children: ReactNode}) => (
  <QueryClientProvider
    client={
      new QueryClient({
        defaultOptions: {mutations: {retry: false}, queries: {retry: false}},
      })
    }
  >
    {children}
  </QueryClientProvider>
);

describe('useDesignerSaveMutation', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('sends a quoted If-Match when a hash is supplied', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({uiSpecProperties: {hash: HASH}}),
    });
    vi.stubGlobal('fetch', fetchMock);

    const {result} = renderHook(
      () =>
        useDesignerSaveMutation({
          resourceType: 'projects',
          apiResourceType: 'notebooks',
          resourceId: 'proj-1',
          token: 'token',
        }),
      {wrapper}
    );

    const file = {
      name: 'notebook.json',
      text: async () => '{"metadata":{}}',
    } as File;
    await result.current.mutateAsyncWithToast(file, {ifMatch: HASH});

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)['If-Match']).toBe(
      `"${HASH}"`
    );
  });

  it('omits If-Match when publishing a confirmed overwrite', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', fetchMock);

    const {result} = renderHook(
      () =>
        useDesignerSaveMutation({
          resourceType: 'projects',
          apiResourceType: 'notebooks',
          resourceId: 'proj-1',
          token: 'token',
        }),
      {wrapper}
    );

    const file = {
      name: 'notebook.json',
      text: async () => '{"metadata":{}}',
    } as File;
    await result.current.mutateAsyncWithToast(file);

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(
      (init.headers as Record<string, string>)['If-Match']
    ).toBeUndefined();
  });

  it('throws DesignerUiSpecConflictError on 409 and does not retry', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      statusText: 'Conflict',
      text: async () =>
        JSON.stringify({
          error: {
            message: 'The live design has changed since this draft was opened.',
            status: 409,
          },
        }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const {result} = renderHook(
      () =>
        useDesignerSaveMutation({
          resourceType: 'projects',
          apiResourceType: 'notebooks',
          resourceId: 'proj-1',
          token: 'token',
        }),
      {wrapper}
    );

    const file = {
      name: 'notebook.json',
      text: async () => '{"metadata":{}}',
    } as File;
    await expect(
      result.current.mutateAsyncWithToast(file, {ifMatch: HASH})
    ).rejects.toBeInstanceOf(DesignerUiSpecConflictError);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });
});
