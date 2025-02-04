import {useAuth} from '@/auth';
import {columns} from '@/components/tables/users';
import {DataTable} from '@/components/data-table/data-table';
import {createFileRoute} from '@tanstack/react-router';
import {useGetUsers} from '@/lib/queries';

export const Route = createFileRoute('/users')({
  component: RouteComponent,
});

/**
 * RouteComponent component renders the users page.
 * It displays a table with the user's information.
 *
 * @returns {JSX.Element} The rendered RouteComponent component.
 */
function RouteComponent() {
  const {user} = useAuth();

  const {data, isPending} = useGetUsers(user);

  return (
    <DataTable
      columns={columns}
      data={data?.map((user: any) => ({...user, email: user.emails[0]}))}
      loading={isPending}
    />
  );
}
