import {createFileRoute, useNavigate} from '@tanstack/react-router';
import {useQuery} from '@tanstack/react-query';
import {DataTable} from '@/components/data-table/data-table';
import {columns} from '@/components/tables/surveys';
import {useAuth} from '@/auth';
import {get} from '@/lib/utils';

export const Route = createFileRoute('/_auth/surveys/')({
  component: RouteComponent,
});

function RouteComponent() {
  const {user} = useAuth();

  if (!user) {
    return <div>Please login to see your surveys</div>;
  }

  const {isPending, error, data} = useQuery({
    queryKey: ['surveys'],
    queryFn: () => get('/api/notebooks', user),
  });

  const navigate = useNavigate();

  if (error) return 'An error has occurred: ' + error.message;

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
