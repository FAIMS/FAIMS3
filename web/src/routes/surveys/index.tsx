import {createFileRoute, useNavigate} from '@tanstack/react-router';
import {DataTable} from '@/components/data-table/data-table';
import {columns} from '@/components/tables/surveys';
import {useAuth} from '@/auth';
import {useGetSurveys} from '@/lib/queries';

export const Route = createFileRoute('/surveys/')({
  component: RouteComponent,
});

/**
 * RouteComponent component renders the surveys page.
 * It displays a table with the user's surveys.
 *
 * @returns {JSX.Element} The rendered RouteComponent component.
 */
function RouteComponent() {
  const {user} = useAuth();

  const {isPending, data} = useGetSurveys(user);

  const navigate = useNavigate();

  return (
    <DataTable
      columns={columns}
      data={data}
      loading={isPending}
      onRowClick={({non_unique_project_id}) =>
        navigate({to: `/surveys/${non_unique_project_id}`})
      }
    />
  );
}
