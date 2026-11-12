// SPDX-License-Identifier: Apache-2.0
import {useAuth} from '@/context/auth-provider';
import {useUsersColumns} from '@/components/tables/users';
import {DataTable} from '@/components/data-table/data-table';
import {usePagedUsers} from '@/hooks/queries';
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
  const {users, tableLoading, pageSize, serverPagination} = usePagedUsers({
    user: authUser,
    defaultPageSize: 15,
  });
  const [resetDialog, setResetDialog] = useState<boolean>(false);
  const [resetUserId, setResetUserId] = useState<string | undefined>(undefined);

  const onReset = (id: string) => {
    setResetUserId(id);
    setResetDialog(true);
  };

  const columns = useUsersColumns({onReset});

  return (
    <>
      <DataTable
        columns={columns}
        data={users?.map(user => ({
          ...user,
          email: user.emails[0]?.email ?? '',
        }))}
        loading={tableLoading}
        defaultRowsPerPage={pageSize}
        serverPagination={serverPagination}
      />
      <GeneratePasswordReset
        open={resetDialog}
        setOpen={setResetDialog}
        userId={resetUserId}
      />
    </>
  );
}
