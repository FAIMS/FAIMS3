// SPDX-License-Identifier: Apache-2.0
import type {User} from '@/context/auth-provider';
import {config} from '@/constants';
import {ProjectStatus, Role} from '@faims3/data-model';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {cleanup, render, screen} from '@testing-library/react';
import {createElement, type ReactNode} from 'react';
import {afterEach, describe, expect, it, vi} from 'vitest';

const {mockUser, useMapAssetLinksMock, usePagedProjectsMock} = vi.hoisted(
  () => ({
    mockUser: {
      current: null as User | null,
    },
    useMapAssetLinksMock: vi.fn(),
    usePagedProjectsMock: vi.fn(),
  })
);

vi.mock('@/context/auth-provider', () => ({
  useAuth: () => ({
    user: mockUser.current,
    isExpired: () => false,
  }),
  isUserExpired: () => false,
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  Link: ({children}: {children: ReactNode}) => <a>{children}</a>,
}));

vi.mock('@/hooks/map-asset-hooks', () => ({
  useMapAssetLinks: useMapAssetLinksMock,
  invalidateMapAssets: vi.fn(),
  linkMapAsset: vi.fn(),
  unlinkMapAsset: vi.fn(),
}));

vi.mock('@/hooks/queries', () => ({
  get: vi.fn(),
  usePagedProjects: usePagedProjectsMock,
  useGetTeam: () => ({data: undefined, isLoading: false, isError: false}),
  useGetTemplate: () => ({data: undefined, isLoading: false, isError: false}),
}));

import {MapLayerLinkedSurveys} from './linked-surveys';

function adminUser(): User {
  return {
    token: 'token',
    refreshToken: 'refresh',
    user: {
      id: 'admin',
      name: 'Admin',
      email: 'admin@example.com',
      isVerified: true,
    },
    decodedToken: {
      username: 'admin',
      name: 'Admin',
      server: 'http://localhost',
      exp: 9e9,
      globalRoles: [Role.GENERAL_ADMIN],
      resourceRoles: [],
    },
  } as User;
}

function guestUser(): User {
  return {
    token: 'token',
    refreshToken: 'refresh',
    user: {
      id: 'guest',
      name: 'Guest',
      email: 'guest@example.com',
      isVerified: true,
    },
    decodedToken: {
      username: 'guest',
      name: 'Guest',
      server: 'http://localhost',
      exp: 9e9,
      globalRoles: [Role.GENERAL_USER],
      resourceRoles: [{resourceId: 'survey-1', role: Role.PROJECT_GUEST}],
    },
  } as User;
}

const survey = {
  _id: 'survey-1',
  name: 'Survey One',
  description: 'Field notes',
  createdBy: 'admin',
  createdAt: '2025-04-02T05:30:00.000Z',
  updatedAt: '2026-01-15T14:45:00.000Z',
  status: ProjectStatus.OPEN,
};

const paged = {
  notebooks: [survey],
  tableLoading: false,
  isError: false,
  isPending: false,
  pageSize: 15,
  serverPagination: {
    pageIndex: 0,
    pageSize: 15,
    hasNextPage: false,
    canPreviousPage: false,
    onNextPage: () => undefined,
    onPreviousPage: () => undefined,
    onFirstPage: () => undefined,
    onPageSizeChange: () => undefined,
  },
  serverSearch: {value: '', onChange: () => undefined},
};

function renderTab() {
  const queryClient = new QueryClient({
    defaultOptions: {queries: {retry: false}},
  });
  return render(
    createElement(
      QueryClientProvider,
      {client: queryClient},
      createElement(MapLayerLinkedSurveys, {assetId: 'asset-1'})
    )
  );
}

afterEach(() => {
  cleanup();
  mockUser.current = null;
  useMapAssetLinksMock.mockReset();
  usePagedProjectsMock.mockReset();
});

describe('MapLayerLinkedSurveys', () => {
  it('shows the unlinked table and Link action for Super Users with no links', () => {
    mockUser.current = adminUser();
    useMapAssetLinksMock.mockReturnValue({
      data: [],
      isPending: false,
      isError: false,
    });
    usePagedProjectsMock.mockReturnValue(paged);

    renderTab();

    expect(screen.getByTestId('web-map-layers-linked-empty')).toBeDefined();
    expect(
      screen.queryByRole('heading', {
        name: `Linked ${config.notebookNamePluralCapitalized}`,
      })
    ).toBeNull();
    expect(screen.getByTestId('web-map-layers-available')).toBeDefined();
    expect(
      screen.getByRole('heading', {
        name: `Available ${config.notebookNamePluralCapitalized}`,
      })
    ).toBeDefined();
    expect(screen.getByTestId('web-map-layers-link-survey')).toBeDefined();
    expect(screen.getByText('Survey One')).toBeDefined();
  });

  it('hides the unlinked table when the user cannot administer any survey', () => {
    mockUser.current = guestUser();
    useMapAssetLinksMock.mockReturnValue({
      data: [],
      isPending: false,
      isError: false,
    });
    usePagedProjectsMock.mockReturnValue(paged);

    renderTab();

    expect(screen.queryByTestId('web-map-layers-available')).toBeNull();
    expect(screen.queryByTestId('web-map-layers-link-survey')).toBeNull();
  });
});
