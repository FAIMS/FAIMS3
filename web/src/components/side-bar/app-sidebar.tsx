import {useAuth} from '@/auth';
import {NavMain} from '@/components/side-bar/nav-main';
import {NavUser} from '@/components/side-bar/nav-user';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar';
import {useGetSurveys, useGetTemplates} from '@/lib/queries';
import {Link} from '@tanstack/react-router';
import {LayoutTemplate, LetterText, Users} from 'lucide-react';
import * as React from 'react';
import Logo from '../logo';

export function AppSidebar({...props}: React.ComponentProps<typeof Sidebar>) {
  const {user} = useAuth();

  if (!user) return <></>;

  const {data: surveys} = useGetSurveys(user);
  const {data: templates} = useGetTemplates(user);

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
              items:
                templates?.length > 0
                  ? templates.map(({_id, template_name}: any) => ({
                      title: template_name,
                      url: `/templates/${_id}`,
                    }))
                  : [{title: 'No templates...'}],
            },
            {
              title: 'Surveys',
              url: '/surveys',
              icon: LetterText,
              items:
                surveys?.length > 0
                  ? surveys.map(({name, non_unique_project_id}: any) => ({
                      title: name,
                      url: `/surveys/${non_unique_project_id}`,
                    }))
                  : [{title: 'No surveys...'}],
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
