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
import {useGetProjects, useGetTeams, useGetTemplates} from '@/hooks/get-hooks';
import {Link, useLocation} from '@tanstack/react-router';
import {LayoutTemplate, LetterText, Users, House} from 'lucide-react';
import * as React from 'react';
import Logo from '../logo';
import {useIsAuthorisedTo} from '@/hooks/auth-hooks';
import {Action} from '@faims3/data-model';

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

  const {data: projects} = useGetProjects(user);
  const {data: teams} = useGetTeams(user);
  const {data: templates} = useGetTemplates(user);

  const topSectionNavItems: NavItem[] = [];
  const bottomSectionNavItems: NavItem[] = [];

  console.log(pathname, pathname === '/');

  if (canSeeProjects) {
    topSectionNavItems.push({
      title: `${NOTEBOOK_NAME_CAPITALIZED}s`,
      url: '/projects',
      icon: LetterText,
      isActive: pathname.startsWith('/projects') || pathname === '/',
      items:
        projects?.length > 0
          ? projects.map(({name, project_id}: any) => ({
              id: project_id,
              title: name,
              url: `/projects/${project_id}`,
            }))
          : [{id: 'no-projects', title: `No ${NOTEBOOK_NAME}s...`}],
    });
  }

  if (canSeeTemplates) {
    topSectionNavItems.push({
      title: 'Templates',
      url: '/templates',
      icon: LayoutTemplate,
      isActive: pathname.startsWith('/templates'),
      items:
        templates?.length > 0
          ? templates.map(({_id, metadata: {name}}: any) => ({
              id: _id,
              title: name,
              url: `/templates/${_id}`,
            }))
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
        <NavMain title="Content" items={topSectionNavItems} />
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
