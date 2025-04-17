import {createFileRoute, useRouter} from '@tanstack/react-router';
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs';
import ProjectDetails from '@/components/tabs/project/details';
import ProjectInvites from '@/components/tabs/project/invites';
import ProjectUsers from '@/components/tabs/project/users';
import ProjectExport from '@/components/tabs/project/export';
import ProjectActions from '@/components/tabs/project/actions';
import {useGetProject} from '@/hooks/queries';
import {useAuth} from '@/context/auth-provider';
import {useBreadcrumbUpdate} from '@/hooks/use-breadcrumbs';
import {useMemo} from 'react';
import {NOTEBOOK_NAME_CAPITALIZED} from '@/constants';

const tabs = [
  {name: 'Details', Component: ProjectDetails},
  {name: 'Invites', Component: ProjectInvites},
  {name: 'Users', Component: ProjectUsers},
  {name: 'Export', Component: ProjectExport},
  {name: 'Actions', Component: ProjectActions},
];

/**
 * Route component renders the project details page.
 * It displays the project details, invites, users, export, and actions.
 *
 * @returns {JSX.Element} The rendered Route component.
 */
export const Route = createFileRoute('/_protected/projects/$projectId')({
  component: RouteComponent,
});

function RouteComponent() {
  const {projectId} = Route.useParams();
  const {user} = useAuth();
  const {isLoading, data: project} = useGetProject({user, projectId});
  const pathname = useRouter().state.location.pathname;

  // breadcrumbs addition
  const paths = useMemo(
    () => [
      // projects ->
      {
        path: '/projects',
        label: NOTEBOOK_NAME_CAPITALIZED + 's',
      },
      // project name
      {
        path: pathname,
        label: isLoading
          ? 'Loading...'
          : ((project?.metadata.name as string) ?? projectId),
      },
    ],
    [pathname, project, isLoading]
  );

  useBreadcrumbUpdate({
    isLoading,
    paths,
  });

  return (
    <Tabs defaultValue={tabs[0].name}>
      <TabsList>
        {tabs.map(({name}) => (
          <TabsTrigger key={name} value={name}>
            {name}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map(({name, Component}) => (
        <TabsContent key={name} value={name}>
          <Component projectId={projectId} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
