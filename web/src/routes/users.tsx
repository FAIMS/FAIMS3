import {useAuth} from '@/context/auth-provider';
import {columns} from '@/components/tables/users';
import {DataTable} from '@/components/data-table/data-table';
import {createFileRoute} from '@tanstack/react-router';
import {useGetUsers} from '@/hooks/get-hooks';

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
  const {user: authUser} = useAuth();
  const {data, isPending} = useGetUsers(authUser);

  return (
    <DataTable
      columns={columns}
      data={data?.map((user: any) => ({...user, email: user.emails[0]})) || []}
      loading={isPending}
    />
  );
}
