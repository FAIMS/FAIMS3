// SPDX-License-Identifier: Apache-2.0
import {Action} from '@faims3/data-model';
import {cleanup, render, screen, within} from '@testing-library/react';
import type {AnchorHTMLAttributes, MouseEventHandler, ReactNode} from 'react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {
  ARCHIVE_TAB_LABELS,
  getVisibleArchiveTabs,
} from '@/archive/archive-tabs';
import {SidebarProvider} from '@/components/ui/sidebar';
import {config} from '@/constants';

/** One list page as the paginated GETs return it. */
type NamedPage<K extends string> = Record<K, {_id: string; name: string}[]> & {
  nextStartKey?: string;
};

const {
  authorised,
  mockUser,
  queryState,
  useGetProjectsMock,
  useGetTemplatesMock,
  useGetTeamsMock,
} = vi.hoisted(() => {
  const queryState = {
    projects: {notebooks: []} as NamedPage<'notebooks'>,
    templates: [] as unknown,
    teams: {teams: []} as NamedPage<'teams'>,
  };
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
    queryState,
    useGetProjectsMock: vi.fn(() => ({data: queryState.projects})),
    useGetTemplatesMock: vi.fn(() => ({data: queryState.templates})),
    useGetTeamsMock: vi.fn(() => ({data: queryState.teams})),
  };
});

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    children,
    search: _search,
    ...rest
  }: {
    to: string;
    children: ReactNode;
    search?: unknown;
    [key: string]: unknown;
  }) => (
    <a
      href={to}
      {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}
      onClick={event => {
        event.preventDefault();
        const restOnClick = (
          rest as {
            onClick?: MouseEventHandler<HTMLAnchorElement>;
          }
        ).onClick;
        restOnClick?.(event);
      }}
    >
      {children}
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
  useGetProjects: useGetProjectsMock,
  useGetTemplates: useGetTemplatesMock,
  useGetTeams: useGetTeamsMock,
}));

vi.mock('@/context/auth-provider', () => ({
  useAuth: () => ({
    logout: vi.fn(),
    user: mockUser,
  }),
}));

vi.mock('@/components/ui/collapsible', () => {
  const Passthrough = ({
    children,
    asChild: _asChild,
  }: {
    children: ReactNode;
    asChild?: boolean;
  }) => children;
  return {
    Collapsible: Passthrough,
    CollapsibleTrigger: Passthrough,
    CollapsibleContent: ({children}: {children: ReactNode}) => (
      <div>{children}</div>
    ),
  };
});

import {AppSidebar, SIDEBAR_CATALOGUE_RECENT_LIMIT} from './app-sidebar';

beforeEach(() => {
  cleanup();
  authorised.canSeeUsers = false;
  authorised.canSeeStats = false;
  authorised.canSeeProjects = false;
  authorised.canSeeTemplates = false;
  authorised.canSeeMapLayers = false;
  queryState.projects = {notebooks: []};
  queryState.templates = [];
  queryState.teams = {teams: []};
  useGetProjectsMock.mockClear();
  useGetTemplatesMock.mockClear();
  useGetTeamsMock.mockClear();
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

/** Render {@link AppSidebar} inside the shadcn sidebar provider. */
function renderSidebar() {
  return render(
    <SidebarProvider>
      <AppSidebar />
    </SidebarProvider>
  );
}

function namedItems(prefix: string, count: number) {
  return Array.from({length: count}, (_, i) => ({
    _id: `${prefix}-${i + 1}`,
    name: `${prefix} ${i + 1}`,
  }));
}

function navGroup(testId: string) {
  const link = screen.getByTestId(testId);
  const item = link.closest('[data-sidebar="menu-item"]');
  if (!item) {
    throw new Error(`No sidebar menu item for ${testId}`);
  }
  return within(item as HTMLElement);
}

function hrefs(group: ReturnType<typeof within>) {
  return group
    .getAllByRole('link')
    .map((link: HTMLElement) => link.getAttribute('href'));
}

function enableCatalogueNav() {
  authorised.canSeeProjects = true;
  authorised.canSeeTemplates = true;
}

/** Stats nav is next to Users and is hidden without VIEW_SYSTEM_STATS. */
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

describe('AppSidebar catalogue recent rows', () => {
  it('requests only the recent cap for every catalogue, without byte counts', () => {
    enableCatalogueNav();
    renderSidebar();
    expect(SIDEBAR_CATALOGUE_RECENT_LIMIT).toBe(10);
    for (const hook of [
      useGetProjectsMock,
      useGetTemplatesMock,
      useGetTeamsMock,
    ]) {
      expect(hook).toHaveBeenCalledWith(
        expect.objectContaining({limit: SIDEBAR_CATALOGUE_RECENT_LIMIT})
      );
    }
    const [projectArgs] = useGetProjectsMock.mock.calls[0] as unknown as [
      Record<string, unknown>,
    ];
    expect(projectArgs.includeByteCount).toBeUndefined();
  });

  it('shows 10 notebook names plus View all when the page has a nextStartKey', () => {
    enableCatalogueNav();
    queryState.projects = {
      notebooks: namedItems('project', 10),
      nextStartKey: '[1,"project-10"]',
    };
    renderSidebar();
    const projects = navGroup('web-nav-projects');
    const links = hrefs(projects);
    for (let i = 1; i <= 10; i++) {
      expect(links).toContain(`/projects/project-${i}`);
    }
    expect(
      projects.getByRole('link', {name: 'View all'}).getAttribute('href')
    ).toBe('/projects');
  });

  it('shows View all and not the empty placeholder when a notebook page is empty with nextStartKey', () => {
    enableCatalogueNav();
    queryState.projects = {notebooks: [], nextStartKey: 'cursor'};
    renderSidebar();
    const projects = navGroup('web-nav-projects');
    expect(
      projects.queryByText(`No ${config.notebookNamePlural}...`)
    ).toBeNull();
    expect(
      projects.getByRole('link', {name: 'View all'}).getAttribute('href')
    ).toBe('/projects');
  });

  it('shows 10 team names plus View all when the page has a nextStartKey', () => {
    enableCatalogueNav();
    queryState.teams = {
      teams: namedItems('team', 10),
      nextStartKey: '[1,"team-10"]',
    };
    renderSidebar();
    const teams = navGroup('web-nav-teams');
    const links = hrefs(teams);
    for (let i = 1; i <= 10; i++) {
      expect(links).toContain(`/teams/team-${i}`);
    }
    expect(
      teams.getByRole('link', {name: 'View all'}).getAttribute('href')
    ).toBe('/teams');
  });

  it('caps 11 notebooks at 10 names plus View all to /projects', () => {
    enableCatalogueNav();
    queryState.projects = {notebooks: namedItems('project', 11)};
    renderSidebar();
    const projects = navGroup('web-nav-projects');
    const links = hrefs(projects);
    for (let i = 1; i <= 10; i++) {
      expect(links).toContain(`/projects/project-${i}`);
    }
    expect(links).not.toContain('/projects/project-11');
    expect(projects.getByText('View all')).toBeDefined();
    expect(
      projects.getByRole('link', {name: 'View all'}).getAttribute('href')
    ).toBe('/projects');
  });

  it('renders every notebook name and no View all when there are 2', () => {
    enableCatalogueNav();
    queryState.projects = {notebooks: namedItems('project', 2)};
    renderSidebar();
    const projects = navGroup('web-nav-projects');
    expect(hrefs(projects)).toEqual(
      expect.arrayContaining(['/projects/project-1', '/projects/project-2'])
    );
    expect(
      projects.getByRole('link', {name: 'project 1'}).getAttribute('href')
    ).toBe('/projects/project-1');
    expect(
      projects.getByRole('link', {name: 'project 2'}).getAttribute('href')
    ).toBe('/projects/project-2');
    expect(projects.queryByText('View all')).toBeNull();
  });

  it('shows the empty notebooks placeholder and no View all', () => {
    enableCatalogueNav();
    queryState.projects = {notebooks: []};
    renderSidebar();
    const projects = navGroup('web-nav-projects');
    expect(
      projects.getByText(`No ${config.notebookNamePlural}...`)
    ).toBeDefined();
    expect(projects.queryByText('View all')).toBeNull();
    expect(screen.getByTestId('web-nav-projects').getAttribute('href')).toBe(
      '/projects'
    );
  });

  it('caps 11 templates at 10 names plus View all to /templates', () => {
    enableCatalogueNav();
    queryState.templates = namedItems('template', 11);
    renderSidebar();
    const templates = navGroup('web-nav-templates');
    const links = hrefs(templates);
    for (let i = 1; i <= 10; i++) {
      expect(links).toContain(`/templates/template-${i}`);
    }
    expect(links).not.toContain('/templates/template-11');
    expect(
      templates.getByRole('link', {name: 'View all'}).getAttribute('href')
    ).toBe('/templates');
  });

  it('renders every template name and no View all when there are 2', () => {
    enableCatalogueNav();
    queryState.templates = namedItems('template', 2);
    renderSidebar();
    const templates = navGroup('web-nav-templates');
    expect(
      templates.getByRole('link', {name: 'template 1'}).getAttribute('href')
    ).toBe('/templates/template-1');
    expect(
      templates.getByRole('link', {name: 'template 2'}).getAttribute('href')
    ).toBe('/templates/template-2');
    expect(templates.queryByText('View all')).toBeNull();
  });

  it('shows the empty templates placeholder and no View all', () => {
    enableCatalogueNav();
    queryState.templates = [];
    renderSidebar();
    const templates = navGroup('web-nav-templates');
    expect(templates.getByText('No templates...')).toBeDefined();
    expect(templates.queryByText('View all')).toBeNull();
  });

  it('caps 11 teams at 10 names plus View all to /teams', () => {
    enableCatalogueNav();
    queryState.teams = {teams: namedItems('team', 11)};
    renderSidebar();
    const teams = navGroup('web-nav-teams');
    const links = hrefs(teams);
    for (let i = 1; i <= 10; i++) {
      expect(links).toContain(`/teams/team-${i}`);
    }
    expect(links).not.toContain('/teams/team-11');
    expect(
      teams.getByRole('link', {name: 'View all'}).getAttribute('href')
    ).toBe('/teams');
  });

  it('renders every team name and no View all when there are 2', () => {
    enableCatalogueNav();
    queryState.teams = {teams: namedItems('team', 2)};
    renderSidebar();
    const teams = navGroup('web-nav-teams');
    expect(teams.getByRole('link', {name: 'team 1'}).getAttribute('href')).toBe(
      '/teams/team-1'
    );
    expect(teams.getByRole('link', {name: 'team 2'}).getAttribute('href')).toBe(
      '/teams/team-2'
    );
    expect(teams.queryByText('View all')).toBeNull();
  });

  it('shows the empty teams placeholder and no View all', () => {
    enableCatalogueNav();
    queryState.teams = {teams: []};
    renderSidebar();
    const teams = navGroup('web-nav-teams');
    expect(teams.getByText('No teams...')).toBeDefined();
    expect(teams.queryByText('View all')).toBeNull();
  });

  it('shows View all and not the empty placeholder when templates are empty with nextStartKey', () => {
    enableCatalogueNav();
    queryState.templates = {templates: [], nextStartKey: 'cursor'};
    renderSidebar();
    const templates = navGroup('web-nav-templates');
    expect(templates.queryByText('No templates...')).toBeNull();
    expect(
      templates.getByRole('link', {name: 'View all'}).getAttribute('href')
    ).toBe('/templates');
  });

  it('renders 3 template names and View all when nextStartKey is set', () => {
    enableCatalogueNav();
    queryState.templates = {
      templates: namedItems('template', 3),
      nextStartKey: 'cursor',
    };
    renderSidebar();
    const templates = navGroup('web-nav-templates');
    expect(
      templates.getByRole('link', {name: 'template 1'}).getAttribute('href')
    ).toBe('/templates/template-1');
    expect(
      templates.getByRole('link', {name: 'template 2'}).getAttribute('href')
    ).toBe('/templates/template-2');
    expect(
      templates.getByRole('link', {name: 'template 3'}).getAttribute('href')
    ).toBe('/templates/template-3');
    expect(
      templates.getByRole('link', {name: 'View all'}).getAttribute('href')
    ).toBe('/templates');
  });

  it('uses the paginated templates page payload for the first 10 names', () => {
    enableCatalogueNav();
    queryState.templates = {
      templates: namedItems('template', 10),
      nextStartKey: '[1,"tpl-next"]',
    };
    renderSidebar();
    const templates = navGroup('web-nav-templates');
    const links = hrefs(templates);
    for (let i = 1; i <= 10; i++) {
      expect(links).toContain(`/templates/template-${i}`);
    }
    expect(
      templates.getByRole('link', {name: 'View all'}).getAttribute('href')
    ).toBe('/templates');
  });

  it('does not cap Archive tab rows and leaves Users, Stats, and Map layers unchanged', () => {
    authorised.canSeeProjects = true;
    authorised.canSeeTemplates = true;
    authorised.canSeeUsers = true;
    authorised.canSeeStats = true;
    authorised.canSeeMapLayers = true;
    renderSidebar();

    expect(screen.getByTestId('web-nav-users').getAttribute('href')).toBe(
      '/users'
    );
    expect(screen.getByTestId('web-nav-stats').getAttribute('href')).toBe(
      '/stats'
    );
    expect(screen.getByTestId('web-nav-map-layers').getAttribute('href')).toBe(
      '/map-layers'
    );

    const archive = navGroup('web-nav-archive');
    const visibleTabs = getVisibleArchiveTabs({
      canSeeProjects: true,
      canSeeTemplates: true,
      canSeeTeams: true,
      canSeeUsers: true,
    });
    expect(visibleTabs.length).toBeGreaterThan(0);
    expect(visibleTabs.length).toBeLessThanOrEqual(
      SIDEBAR_CATALOGUE_RECENT_LIMIT
    );
    for (const tab of visibleTabs) {
      expect(archive.getByText(ARCHIVE_TAB_LABELS[tab])).toBeDefined();
    }
    expect(archive.queryByText('View all')).toBeNull();
  });
});

function navSection(title: string) {
  const label = screen
    .getAllByText(title)
    .find(el => el.getAttribute('data-sidebar') === 'group-label');
  const group = label?.closest('[data-sidebar="group"]');
  if (!group) {
    throw new Error(`No sidebar section labelled ${title}`);
  }
  return within(group as HTMLElement);
}

describe('AppSidebar Map layers nav', () => {
  it('places Map layers at the bottom of Content after Templates', () => {
    authorised.canSeeProjects = true;
    authorised.canSeeTemplates = true;
    authorised.canSeeMapLayers = true;
    authorised.canSeeUsers = true;
    renderSidebar();

    const content = navSection('Content');
    const management = navSection('Management');
    expect(content.getByTestId('web-nav-map-layers')).toBeDefined();
    expect(management.queryByTestId('web-nav-map-layers')).toBeNull();

    const templates = screen.getByTestId('web-nav-templates');
    const mapLayers = screen.getByTestId('web-nav-map-layers');
    expect(
      templates.compareDocumentPosition(mapLayers) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });
});
