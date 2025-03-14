import {createFileRoute, useNavigate} from '@tanstack/react-router';
import {DataTable} from '@/components/data-table/data-table';
import {columns} from '@/components/tables/projects';
import {useAuth} from '@/context/auth-provider';
import {useGetProjects} from '@/hooks/get-hooks';
import {CreateProjectDialog} from '@/components/dialogs/create-project-dialog';

export const Route = createFileRoute('/_protected/projects/')({
  component: RouteComponent,
});

/**
 * RouteComponent component renders the projects page.
 * It displays a table with the user's projects.
 *
 * @returns {JSX.Element} The rendered RouteComponent component.
 */
function RouteComponent() {
  const {user} = useAuth();

  const {isPending, data} = useGetProjects(user);

  const navigate = useNavigate();

  console.log(data);

  return (
    <DataTable
      columns={columns}
      data={data}
      loading={isPending}
      onRowClick={({project_id}) => navigate({to: `/projects/${project_id}`})}
      button={<CreateProjectDialog />}
    />
  );
}
