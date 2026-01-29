import {useAuth} from '@/context/auth-provider';
import {
  GetListAllUsersResponse,
  Role,
  roleDetails,
  RoleScope,
} from '@faims3/data-model';
import {useQueryClient} from '@tanstack/react-query';
import {ColumnDef} from '@tanstack/react-table';
import {KeyRound} from 'lucide-react';
import {toast} from 'sonner';
import {DataTableColumnHeader} from '../data-table/column-header';
import {RemoveUserDialog} from '../dialogs/remove-user';
import {AddRolePopover} from '../popovers/add-role-popover';
import {Button} from '../ui/button';
import {RoleCard} from '../ui/role-card';

export const getColumns = ({
  onReset,
}: {
  onReset: (id: string) => void;
}): ColumnDef<GetListAllUsersResponse[number]>[] => {
  const {user} = useAuth();
  const queryClient = useQueryClient();

  return [
    {
      accessorKey: 'name',
      header: ({column}) => (
        <DataTableColumnHeader column={column} title="Name" />
      ),
    },
    {
      accessorKey: 'email',
      header: ({column}) => (
        <DataTableColumnHeader column={column} title="Email" />
      ),
      cell: ({
        row: {
          original: {emails},
        },
      }) => <p>{emails[0]?.email ?? 'No email address'}</p>,
    },
    {
      accessorKey: 'globalRoles',
      header: 'Roles',
      cell: ({
        row: {
          original: {globalRoles, _id: userId},
        },
      }) => (
        <div className="flex flex-wrap gap-1 items-center">
          {userId !== user?.user.id && (
            <AddRolePopover
              roles={Object.entries(roleDetails)
                .filter(([, {scope}]) => scope === RoleScope.GLOBAL)
                .map(([id, roleDetail]) => ({id, ...roleDetail}))}
              userId={userId}
            />
          )}
          {globalRoles.map((role: string) => (
            <RoleCard
              key={role}
              onRemove={
                userId === user?.user.id
                  ? undefined
                  : async () => {
                      try {
                        const response = await fetch(
                          `${import.meta.env.VITE_API_URL}/api/users/${userId}/admin`,
                          {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              Authorization: `Bearer ${user?.token}`,
                            },
                            body: JSON.stringify({
                              addrole: false,
                              role,
                            }),
                          }
                        );

                        if (!response.ok) {
                          console.log('Error removing role', response);
                        }

                        queryClient.invalidateQueries({queryKey: ['users']});
                      } catch (error) {
                        toast.error('Error removing role');
                      }
                    }
              }
            >
              {roleDetails[role as Role].name}
            </RoleCard>
          ))}
        </div>
      ),
    },
    {
      id: 'reset',
      cell: ({row}: any) => (
        <div className="flex justify-center items-center -my-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              onReset(row.original._id);
            }}
          >
            <KeyRound className="h-4 w-4" />
          </Button>
        </div>
      ),
      header: () => (
        <div className="flex justify-center items-center">Reset Password</div>
      ),
    },
    {
      id: 'remove',
      cell: ({
        row: {
          original: {_id, _id: userId},
        },
      }: any) => (
        <div className="flex justify-center items-center -my-2">
          <RemoveUserDialog
            userId={_id}
            disabled={!_id || userId === user?.user.id}
          />
        </div>
      ),
      header: () => (
        <div className="flex justify-center items-center">Remove</div>
      ),
    },
  ];
};
