// SPDX-License-Identifier: Apache-2.0
import {
  ARCHIVE_TAB_LABELS,
  getVisibleArchiveTabs,
} from '@/archive/archive-tabs';
import {NavItem, NavMain} from '@/components/side-bar/nav-main';
import {NavUser} from '@/components/side-bar/nav-user';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar';
import {config} from '@/constants';
import {useIsAuthorisedTo, useRequiredUser} from '@/hooks/auth-hooks';
import {useGetProjects, useGetTeams, useGetTemplates} from '@/hooks/queries';
import {Action} from '@faims3/data-model';
import {Link, useLocation} from '@tanstack/react-router';
import {
  ArchiveRestore,
  BarChart3,
  House,
  Layers,
  LayoutTemplate,
  LetterText,
  Users,
} from 'lucide-react';
import * as React from 'react';
import Logo from '../logo';

/** Max nested catalogue names in the Control Centre left nav (not the picker max). */
export const SIDEBAR_CATALOGUE_RECENT_LIMIT = 10;

const VIEW_ALL_TITLE = 'View all';

type NamedCatalogueItem = {
  _id: string;
  name: string;
};

/**
 * Reads one catalogue page from a list query: the `{<itemsKey>, nextStartKey}`
 * object every paginated list GET returns. A bare array is accepted too and
 * treated as a complete list.
 */
export function cataloguePageFromQueryData(
  data: unknown,
  itemsKey: 'notebooks' | 'templates' | 'teams'
): {
  items: NamedCatalogueItem[];
  nextStartKey?: string;
} {
  if (!data) {
    return {items: []};
  }
  if (Array.isArray(data)) {
    return {items: data};
  }
  if (typeof data === 'object' && itemsKey in data) {
    const page = data as {nextStartKey?: string} & Record<string, unknown>;
    const items = page[itemsKey];
    return {
      items: Array.isArray(items) ? (items as NamedCatalogueItem[]) : [],
      nextStartKey: page.nextStartKey,
    };
  }
  return {items: []};
}

/**
 * Builds nested catalogue rows: up to {@link SIDEBAR_CATALOGUE_RECENT_LIMIT}
 * recent names, a "View all" row when more exist (length or `nextStartKey`),
 * and the empty placeholder only when the catalogue is truly empty.
 */
export function catalogueSubItems({
  items,
  nextStartKey,
  urlPrefix,
  emptyId,
  emptyTitle,
}: {
  items: NamedCatalogueItem[];
  nextStartKey?: string;
  urlPrefix: string;
  emptyId: string;
  emptyTitle: string;
}): NonNullable<NavItem['items']> {
  const visible = items.slice(0, SIDEBAR_CATALOGUE_RECENT_LIMIT);
  const hasMore =
    items.length > SIDEBAR_CATALOGUE_RECENT_LIMIT || Boolean(nextStartKey);
  if (visible.length === 0 && !hasMore) {
    return [{id: emptyId, title: emptyTitle}];
  }
  const rows: NonNullable<NavItem['items']> = visible.map(({_id, name}) => ({
    id: _id,
    title: name,
    url: `${urlPrefix}/${_id}`,
  }));
  if (hasMore) {
    rows.push({
      id: `view-all-${urlPrefix.replace(/^\//, '')}`,
      title: VIEW_ALL_TITLE,
      url: urlPrefix,
    });
  }
  return rows;
}

/**
 * AppSidebar component renders the main application sidebar with navigation items
 * based on the authenticated user's data, including projects and templates.
 *
 * @param {React.ComponentProps<typeof Sidebar>} props - The properties to pass to the Sidebar component.
 * @returns {JSX.Element} The rendered sidebar component.
 */
export function AppSidebar({...props}: React.ComponentProps<typeof Sidebar>) {
  const user = useRequiredUser();

  const {pathname} = useLocation();

  // Can see different bits
  const canSeeProjects = useIsAuthorisedTo({action: Action.LIST_PROJECTS});
  const canSeeTemplates = useIsAuthorisedTo({action: Action.LIST_TEMPLATES});
  const canSeeUsers = useIsAuthorisedTo({action: Action.VIEW_USER_LIST});
  // VIEW_SYSTEM_STATS is ops/general admin only; hides Stats for everyone else.
  const canSeeStats = useIsAuthorisedTo({action: Action.VIEW_SYSTEM_STATS});
  const canSeeMapLayers = useIsAuthorisedTo({action: Action.LIST_MAP_ASSETS});

  // currently anyone can list teams - but it is filtered per resource
  const canSeeTeams = true;

  // Each catalogue asks for its newest few names only. `nextStartKey` on the
  // page says more exist, which is what turns on "View all".
  const {data: projects} = useGetProjects({
    user,
    enabled: canSeeProjects,
    limit: SIDEBAR_CATALOGUE_RECENT_LIMIT,
  });
  const {data: templates} = useGetTemplates({
    user,
    enabled: canSeeTemplates,
    limit: SIDEBAR_CATALOGUE_RECENT_LIMIT,
  });
  const {data: teams} = useGetTeams({
    user,
    enabled: canSeeTeams,
    limit: SIDEBAR_CATALOGUE_RECENT_LIMIT,
  });

  const topSectionNavItems: NavItem[] = [];
  const bottomSectionNavItems: NavItem[] = [];

  if (canSeeProjects) {
    const projectPage = cataloguePageFromQueryData(projects, 'notebooks');
    topSectionNavItems.push({
      title: config.notebookNamePluralCapitalized,
      url: '/projects',
      icon: LetterText,
      testId: 'web-nav-projects',
      isActive: pathname.startsWith('/projects') || pathname === '/',
      items: catalogueSubItems({
        items: projectPage.items,
        nextStartKey: projectPage.nextStartKey,
        urlPrefix: '/projects',
        emptyId: 'no-projects',
        emptyTitle: `No ${config.notebookNamePlural}...`,
      }),
    });
  }

  if (canSeeTemplates) {
    const templatePage = cataloguePageFromQueryData(templates, 'templates');
    topSectionNavItems.push({
      title: 'Templates',
      url: '/templates',
      icon: LayoutTemplate,
      testId: 'web-nav-templates',
      isActive: pathname.startsWith('/templates'),
      items: catalogueSubItems({
        items: templatePage.items,
        nextStartKey: templatePage.nextStartKey,
        urlPrefix: '/templates',
        emptyId: 'no-templates',
        emptyTitle: 'No templates...',
      }),
    });
  }

  if (canSeeUsers) {
    bottomSectionNavItems.push({
      title: 'Users',
      url: '/users',
      icon: Users,
      testId: 'web-nav-users',
    });
  }

  // Instance-usage snapshot; gated to VIEW_SYSTEM_STATS (ops / general admin).
  if (canSeeStats) {
    bottomSectionNavItems.push({
      title: 'Stats',
      url: '/stats',
      icon: BarChart3,
      testId: 'web-nav-stats',
    });
  }

  if (canSeeMapLayers) {
    bottomSectionNavItems.push({
      title: 'Map layers',
      url: '/map-layers',
      icon: Layers,
      testId: 'web-nav-map-layers',
      isActive: pathname.startsWith('/map-layers'),
    });
  }

  if (canSeeTeams) {
    const teamPage = cataloguePageFromQueryData(teams, 'teams');
    bottomSectionNavItems.push({
      title: 'Teams',
      url: '/teams',
      icon: House,
      testId: 'web-nav-teams',
      isActive: pathname.startsWith('/teams'),
      items: catalogueSubItems({
        items: teamPage.items,
        nextStartKey: teamPage.nextStartKey,
        urlPrefix: '/teams',
        emptyId: 'no-teams',
        emptyTitle: 'No teams...',
      }),
    });
  }

  const visibleArchiveTabs = getVisibleArchiveTabs({
    canSeeProjects,
    canSeeTemplates,
    canSeeTeams,
    canSeeUsers,
  });

  if (visibleArchiveTabs.length > 0) {
    const defaultArchiveTab = visibleArchiveTabs[0];
    const archiveSubItems: NonNullable<NavItem['items']> =
      visibleArchiveTabs.map(tabKey => ({
        id: `archive-${tabKey}`,
        title: ARCHIVE_TAB_LABELS[tabKey],
        url: '/archive',
        search: {tab: tabKey},
      }));

    bottomSectionNavItems.push({
      title: 'Archive',
      url: '/archive',
      icon: ArchiveRestore,
      testId: 'web-nav-archive',
      isActive: pathname.startsWith('/archive'),
      linkSearch: {tab: defaultArchiveTab},
      items: archiveSubItems,
    });
  }

  return (
    <Sidebar collapsible="icon" data-testid="web-sidebar" {...props}>
      <SidebarHeader>
        <Link to="/">
          <Logo />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {topSectionNavItems.length > 0 && (
          <NavMain title="Content" items={topSectionNavItems} />
        )}
        {bottomSectionNavItems.length > 0 && (
          <NavMain title="Management" items={bottomSectionNavItems} />
        )}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
