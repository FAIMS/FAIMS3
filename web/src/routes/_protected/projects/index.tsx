import {DataTable} from '@/components/data-table/data-table';
import {CreateProjectDialog} from '@/components/dialogs/create-project-dialog';
import {columns} from '@/components/tables/projects';
import {NOTEBOOK_NAME_PLURAL_CAPITALIZED} from '@/constants';
import {useAuth} from '@/context/auth-provider';
import {useGetProjects} from '@/hooks/queries';
import {useBreadcrumbUpdate} from '@/hooks/use-breadcrumbs';
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
export function ProjectsRouteComponent() {
  const {user} = useAuth();

  const {isLoading, data} = useGetProjects({user});
  const pathname = useRouter().state.location.pathname;

  // breadcrumbs addition
  const paths = useMemo(
    () => [
      // projects ->
      {
        path: '/projects',
        label: NOTEBOOK_NAME_PLURAL_CAPITALIZED,
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
        {NOTEBOOK_NAME_PLURAL_CAPITALIZED}
      </h1>
      <DataTable
        columns={columns}
        data={data || []}
        loading={isLoading}
        onRowClick={({project_id}) => navigate({to: `/projects/${project_id}`})}
        button={<CreateProjectDialog />}
      />
    </div>
  );
}
