import {createFileRoute, useNavigate} from '@tanstack/react-router';
import {DataTable} from '@/components/ui/data-table/data-table';
import {columns} from '@/components/tables/templates';
import {useAuth} from '@/auth';
import {useGetTemplates} from '@/lib/queries';

export const Route = createFileRoute('/_auth/templates/')({
  component: RouteComponent,
});

function RouteComponent() {
  const {user} = useAuth();

  if (!user) return <></>;

  const {isPending, error, data} = useGetTemplates(user);

  const navigate = useNavigate();

  console.log(data);

  return (
    <DataTable
      columns={columns}
      data={data}
      loading={isPending}
      onRowClick={({_id}) => navigate({to: `/templates/${_id}`})}
    />
  );
}
