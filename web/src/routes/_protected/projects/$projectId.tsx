import {createFileRoute, Navigate, useRouter} from '@tanstack/react-router';
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs';
import ProjectDetails from '@/components/tabs/project/details';
import ProjectInvites from '@/components/tabs/project/invites';
import ProjectUsers from '@/components/tabs/project/users';
import ProjectExport from '@/components/tabs/project/export';
import ProjectActions from '@/components/tabs/project/actions';
import ProjectOfflineMap from '@/components/tabs/project/offline-map';
import {useGetProject} from '@/hooks/queries';
import {useAuth} from '@/context/auth-provider';
import {useBreadcrumbUpdate} from '@/hooks/use-breadcrumbs';
import {useMemo} from 'react';
import {config} from '@/constants';
import {ProjectStatus} from '@faims3/data-model';

const tabs = [
  {
    name: 'Details',
    Component: ProjectDetails,
    testId: 'web-project-tab-details',
  },
  {
    name: 'Invites',
    Component: ProjectInvites,
    testId: 'web-project-tab-invites',
  },
  {name: 'Users', Component: ProjectUsers, testId: 'web-project-tab-users'},
  {name: 'Export', Component: ProjectExport, testId: 'web-project-tab-export'},
  {
    name: 'Offline Map',
    Component: ProjectOfflineMap,
    testId: 'web-project-tab-offline-map',
  },
  {
    name: 'Actions',
    Component: ProjectActions,
    testId: 'web-project-tab-actions',
  },
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
        label: config.notebookNamePluralCapitalized,
      },
      // project name
      {
        path: pathname,
        label: isLoading ? 'Loading...' : (project?.name ?? projectId),
      },
    ],
    [pathname, project, isLoading]
  );

  useBreadcrumbUpdate({
    isLoading,
    paths,
  });

  if (!isLoading && project?.status === ProjectStatus.ARCHIVED) {
    return (
      <Navigate
        to="/archive"
        search={{tab: config.notebookNamePlural}}
        replace
      />
    );
  }

  return (
    <Tabs defaultValue={tabs[0].name}>
      <TabsList>
        {tabs.map(({name, testId}) => (
          <TabsTrigger key={name} value={name} data-testid={testId}>
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
