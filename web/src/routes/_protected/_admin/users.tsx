import {useAuth} from '@/context/auth-provider';
import {getColumns} from '@/components/tables/users';
import {DataTable} from '@/components/data-table/data-table';
import {createFileRoute} from '@tanstack/react-router';
import {useGetUsers} from '@/hooks/queries';
import {useMemo, useState} from 'react';
import {GeneratePasswordReset} from '@/components/dialogs/generate-password-reset';
import {useBreadcrumbUpdate} from '@/hooks/use-breadcrumbs';

export const Route = createFileRoute('/_protected/_admin/users')({
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
  const {data, isPending} = useGetUsers({user: authUser});

  // breadcrumbs addition
  const paths = useMemo(
    () => [
      // projects ->
      {
        path: '/users',
        label: 'Users',
      },
    ],
    []
  );

  useBreadcrumbUpdate({
    isLoading: false,
    paths,
  });

  const [resetDialog, setResetDialog] = useState<boolean>(false);
  const [resetUserId, setResetUserId] = useState<string | undefined>(undefined);

  const onReset = (id: string) => {
    setResetUserId(id);
    setResetDialog(true);
  };

  if (!data) return <></>;

  return (
    <>
      <DataTable
        columns={getColumns({onReset})}
        data={
          isPending
            ? []
            : data.map((user: any) => ({
                ...user,
                email: user.emails[0],
              }))
        }
        loading={isPending}
        defaultRowsPerPage={15}
      />
      <GeneratePasswordReset
        open={resetDialog}
        setOpen={setResetDialog}
        userId={resetUserId}
      />
    </>
  );
}
