import {DataTable} from '@/components/data-table/data-table';
import {CreateProjectDialog} from '@/components/dialogs/create-project-dialog';
import {columns} from '@/components/tables/projects';
import {config} from '@/constants';
import {useIsAuthorisedTo, useRequiredUser} from '@/hooks/auth-hooks';
import {useGetProjects} from '@/hooks/queries';
import {useBreadcrumbUpdate} from '@/hooks/use-breadcrumbs';
import {Action, getUserResourcesForAction} from '@faims3/data-model';
import {createFileRoute, useNavigate, useRouter} from '@tanstack/react-router';
import {useMemo} from 'react';

export const Route = createFileRoute('/_protected/projects/')({
  component: ProjectsRouteComponent,
});

/**
 * RouteComponent component renders the projects page.
 * It displays a table with the user's projects.
 *
 * @returns {JSX.Element} The rendered RouteComponent component.
 */
function ProjectsRouteComponent() {
  const user = useRequiredUser();

  const {isLoading, data} = useGetProjects({user});
  const pathname = useRouter().state.location.pathname;
  const canCreateGlobally = useIsAuthorisedTo({action: Action.CREATE_PROJECT});
  const canCreateInSomeTeam =
    getUserResourcesForAction({
      decodedToken: user.decodedToken,
      action: Action.CREATE_PROJECT_IN_TEAM,
    }).length > 0;

  // breadcrumbs addition
  const paths = useMemo(
    () => [
      // projects ->
      {
        path: '/projects',
        label: config.notebookNamePluralCapitalized,
      },
    ],
    [pathname, isLoading]
  );

  useBreadcrumbUpdate({
    isLoading,
    paths,
  });

  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        {config.notebookNamePluralCapitalized}
      </h1>
      <DataTable
        columns={columns}
        data={data || []}
        loading={isLoading}
        initialSorting={[{id: 'createdAt', desc: true}]}
        onRowClick={({_id}) => navigate({to: `/projects/${_id}`})}
        button={
          (canCreateGlobally || canCreateInSomeTeam) && <CreateProjectDialog />
        }
      />
    </div>
  );
}
