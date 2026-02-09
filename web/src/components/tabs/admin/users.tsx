import {useAuth} from '@/context/auth-provider';
import {getColumns, useUsersColumns} from '@/components/tables/users';
import {DataTable} from '@/components/data-table/data-table';
import {useGetUsers} from '@/hooks/queries';
import {useState} from 'react';
import {GeneratePasswordReset} from '@/components/dialogs/generate-password-reset';

/**
 * UsersTab component renders the users tab.
 * It displays a table with the user's information.
 *
 * @returns {JSX.Element} The rendered UsersTab component.
 */
export function UsersTab() {
  const {user: authUser} = useAuth();
  const {data, isPending} = useGetUsers({user: authUser});
  const [resetDialog, setResetDialog] = useState<boolean>(false);
  const [resetUserId, setResetUserId] = useState<string | undefined>(undefined);

  const onReset = (id: string) => {
    setResetUserId(id);
    setResetDialog(true);
  };

  const columns = useUsersColumns({onReset});

  if (!data) return <></>;

  return (
    <>
      <DataTable
        columns={columns}
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
