import * as React from 'react';
import {NavMain} from '@/components/side-bar/nav-main';
import {NavUser} from '@/components/side-bar/nav-user';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar';
import {useAuth} from '@/auth';
import Logo from '../logo';
import {Link} from '@tanstack/react-router';
import {getSurveys, getTemplates} from '@/lib/queries';
import {LayoutTemplate, LetterText, User, Users} from 'lucide-react';

export function AppSidebar({...props}: React.ComponentProps<typeof Sidebar>) {
  const {user} = useAuth();

  if (!user) return <></>;

  const {data: surveys} = getSurveys(user);
  const {data: templates} = getTemplates(user);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <Link href="/">
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
              items: templates?.map(({_id, template_name}: any) => ({
                title: template_name,
                url: `/templates/${_id}`,
              })),
            },
            {
              title: 'Surveys',
              url: '/surveys',
              icon: LetterText,
              items: surveys?.map(({name, non_unique_project_id}: any) => ({
                title: name,
                url: `/surveys/${non_unique_project_id}`,
              })),
            },
          ]}
        />
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
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
