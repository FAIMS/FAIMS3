// SPDX-License-Identifier: Apache-2.0
import {Action} from '@faims3/data-model';
import {render, screen} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {SidebarProvider} from '@/components/ui/sidebar';

const {authorised, mockUser} = vi.hoisted(() => {
  return {
    authorised: {
      canSeeUsers: false,
      canSeeStats: false,
      canSeeProjects: false,
      canSeeTemplates: false,
      canSeeMapLayers: false,
    },
    mockUser: {
      user: {
        id: 'admin',
        name: 'Admin',
        emails: [],
        globalRoles: ['GENERAL_ADMIN'],
      },
      token: 'token',
      refreshToken: 'refresh',
      decodedToken: {
        username: 'admin',
        name: 'Admin',
        server: 'http://localhost',
        exp: 9e9,
        globalRoles: ['GENERAL_ADMIN'],
        resourceRoles: [],
      },
    },
  };
});

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    children,
    ...rest
  }: {
    to: string;
    children: unknown;
    'data-testid'?: string;
  }) => (
    <a href={to} data-testid={rest['data-testid']}>
      {children as never}
    </a>
  ),
  useLocation: () => ({pathname: '/', search: {}}),
  useRouterState: ({
    select,
  }: {
    select: (state: {location: {search: Record<string, unknown>}}) => unknown;
  }) => select({location: {search: {}}}),
}));

vi.mock('@/hooks/auth-hooks', () => ({
  useRequiredUser: () => mockUser,
  useIsAuthorisedTo: ({action}: {action: Action}) => {
    if (action === Action.VIEW_USER_LIST) return authorised.canSeeUsers;
    if (action === Action.VIEW_SYSTEM_STATS) return authorised.canSeeStats;
    if (action === Action.LIST_PROJECTS) return authorised.canSeeProjects;
    if (action === Action.LIST_TEMPLATES) return authorised.canSeeTemplates;
    if (action === Action.LIST_MAP_ASSETS) return authorised.canSeeMapLayers;
    return false;
  },
}));

vi.mock('@/hooks/queries', () => ({
  useGetProjects: () => ({data: []}),
  useGetTemplates: () => ({data: []}),
  useGetTeams: () => ({data: {teams: []}}),
}));

vi.mock('@/context/auth-provider', () => ({
  useAuth: () => ({
    logout: vi.fn(),
    user: mockUser,
  }),
}));

import {AppSidebar} from './app-sidebar';

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
});

function renderSidebar() {
  return render(
    <SidebarProvider>
      <AppSidebar />
    </SidebarProvider>
  );
}

describe('AppSidebar stats nav', () => {
  it('hides the Stats item without VIEW_SYSTEM_STATS', () => {
    authorised.canSeeUsers = true;
    authorised.canSeeStats = false;
    renderSidebar();
    expect(screen.queryByTestId('web-nav-stats')).toBeNull();
    expect(screen.getByTestId('web-nav-users')).toBeDefined();
  });

  it('shows the Stats item next to Users when VIEW_SYSTEM_STATS is granted', () => {
    authorised.canSeeUsers = true;
    authorised.canSeeStats = true;
    renderSidebar();
    const stats = screen.getByTestId('web-nav-stats');
    const users = screen.getByTestId('web-nav-users');
    expect(stats).toBeDefined();
    expect(stats.getAttribute('href')).toBe('/stats');
    expect(stats.textContent).toContain('Stats');
    expect(
      users.compareDocumentPosition(stats) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });
});
