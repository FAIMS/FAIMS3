import {useAuth} from '@/context/auth-provider';
import {NavMain} from '@/components/side-bar/nav-main';
import {NavUser} from '@/components/side-bar/nav-user';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar';
import {useGetProjects, useGetTemplates} from '@/hooks/get-hooks';
import {Link, useLocation} from '@tanstack/react-router';
import {LayoutTemplate, LetterText, Users} from 'lucide-react';
import * as React from 'react';
import Logo from '../logo';
import {NOTEBOOK_NAME, NOTEBOOK_NAME_CAPITALIZED} from '@/constants';

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

  const {data: projects} = useGetProjects(user);
  const {data: templates} = useGetTemplates(user);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <Link to="/">
          <Logo />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <NavMain
          title="Content"
          items={[
            {
              title: 'Templates',
              url: '/templates',
              icon: LayoutTemplate,
              isActive: pathname.startsWith('/templates'),
              items:
                templates?.length > 0
                  ? templates.map(({_id, template_name}: any) => ({
                      title: template_name,
                      url: `/templates/${_id}`,
                    }))
                  : [{title: 'No templates...'}],
            },
            {
              title: `${NOTEBOOK_NAME_CAPITALIZED}s`,
              url: `/${NOTEBOOK_NAME}s`,
              icon: LetterText,
              isActive: pathname.startsWith('/templates'),
              items:
                projects?.length > 0
                  ? projects.map(({name, non_unique_project_id}: any) => ({
                      title: name,
                      url: `/${NOTEBOOK_NAME}s/${non_unique_project_id}`,
                    }))
                  : [{title: `No ${NOTEBOOK_NAME}s...`}],
            },
          ]}
        />
        {user.user.cluster_admin && (
          <NavMain
            title="Management"
            items={[
              {
                title: 'Users',
                url: '/users',
                icon: Users,
              },
            ]}
          />
        )}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
