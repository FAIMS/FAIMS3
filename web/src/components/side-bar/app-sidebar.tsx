import {NavItem, NavMain} from '@/components/side-bar/nav-main';
import {NavUser} from '@/components/side-bar/nav-user';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar';
import {NOTEBOOK_NAME, NOTEBOOK_NAME_CAPITALIZED} from '@/constants';
import {useAuth} from '@/context/auth-provider';
import {useIsAuthorisedTo} from '@/hooks/auth-hooks';
import {useGetProjects, useGetTeams, useGetTemplates} from '@/hooks/queries';
import {Action, GetListTemplatesResponse} from '@faims3/data-model';
import {Link, useLocation} from '@tanstack/react-router';
import {House, LayoutTemplate, LetterText, Users} from 'lucide-react';
import * as React from 'react';
import Logo from '../logo';

/**
 * AppSidebar component renders the main application sidebar with navigation items
 * based on the authenticated user's data, including projects and templates.
 *
 * @param {React.ComponentProps<typeof Sidebar>} props - The properties to pass to the Sidebar component.
 * @returns {JSX.Element} The rendered sidebar component, or an empty fragment if no user is authenticated.
 */
export function AppSidebar({...props}: React.ComponentProps<typeof Sidebar>) {
  const {user} = useAuth();

  const {pathname} = useLocation();

  if (!user) return <></>;

  // Can see different bits
  const canSeeProjects = useIsAuthorisedTo({action: Action.LIST_PROJECTS});
  const canSeeTemplates = useIsAuthorisedTo({action: Action.LIST_TEMPLATES});
  const canSeeUsers = useIsAuthorisedTo({action: Action.VIEW_USER_LIST});

  // currently anyone can list teams - but it is filtered per resource
  const canSeeTeams = true;

  const topSectionNavItems: NavItem[] = [];
  const bottomSectionNavItems: NavItem[] = [];

  if (canSeeProjects) {
    const {data: projects} = useGetProjects(user);
    topSectionNavItems.push({
      title: `${NOTEBOOK_NAME_CAPITALIZED}s`,
      url: '/projects',
      icon: LetterText,
      isActive: pathname.startsWith('/projects') || pathname === '/',
      items:
        projects && projects?.length > 0
          ? projects.map(({name, project_id}: any) => ({
              id: project_id,
              title: name,
              url: `/projects/${project_id}`,
            }))
          : [{id: 'no-projects', title: `No ${NOTEBOOK_NAME}s...`}],
    });
  }

  if (canSeeTemplates) {
    const {data: templates} = useGetTemplates(user);
    topSectionNavItems.push({
      title: 'Templates',
      url: '/templates',
      icon: LayoutTemplate,
      isActive: pathname.startsWith('/templates'),
      items:
        templates && templates?.length > 0
          ? templates.map(
              ({_id, name}: GetListTemplatesResponse['templates'][number]) => ({
                id: _id,
                title: name,
                url: `/templates/${_id}`,
              })
            )
          : [{id: 'no-templates', title: 'No templates...'}],
    });
  }

  if (canSeeUsers) {
    bottomSectionNavItems.push({
      title: 'Users',
      url: '/users',
      icon: Users,
    });
  }

  if (canSeeTeams) {
    const {data: teams} = useGetTeams(user);
    bottomSectionNavItems.push({
      title: 'Teams',
      url: '/teams',
      icon: House,
      isActive: pathname.startsWith('/teams'),
      items:
        teams && teams.teams.length > 0
          ? teams.teams.map(({_id, name}) => ({
              id: _id,
              title: name,
              url: `/teams/${_id}`,
            }))
          : [{id: 'no-teams', title: 'No teams...'}],
    });
  }

  return (
    <Sidebar collapsible="icon" {...props}>
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
