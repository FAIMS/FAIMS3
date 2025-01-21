import {useAuth} from '@/auth';
import {columns} from '@/components/tables/users';
import {DataTable} from '@/components/ui/data-table/data-table';
import {get} from '@/lib/utils';
import {useQuery} from '@tanstack/react-query';
import {createFileRoute} from '@tanstack/react-router';

export const Route = createFileRoute('/_auth/users')({
  component: RouteComponent,
});

function RouteComponent() {
  const {user} = useAuth();

  const {data, isPending, error} = useQuery({
    queryKey: ['users'],
    queryFn: () => user && get(`/api/users`, user),
    staleTime: 0,
  });

  return (
    <DataTable
      columns={columns}
      data={data?.map((user: any) => ({...user, email: user.emails[0]}))}
      loading={isPending}
    />
  );
}
