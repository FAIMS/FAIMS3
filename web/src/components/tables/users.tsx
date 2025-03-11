import {ColumnDef} from '@tanstack/react-table';
import {KeyRound, Trash} from 'lucide-react';
import {DataTableColumnHeader} from '../data-table/column-header';
import {Button} from '../ui/button';
import {RoleCard} from '../ui/role-card';
import {AddRolePopover} from '../popovers/add-role-popover';
import {useAuth} from '@/context/auth-provider';
import {useQueryClient} from '@tanstack/react-query';

export const getColumns = ({
  onReset,
}: {
  onReset: (id: string) => void;
}): ColumnDef<any>[] => {
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
    },
    {
      accessorKey: 'other_roles',
      header: 'Roles',
      cell: ({
        row: {
          original: {other_roles, all_roles, _id: userId},
        },
      }: any) => (
        <div className="flex flex-wrap gap-1 items-center">
          {other_roles.map((role: string) => (
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
                        console.log('Error removing role', error);
                      }
                    }
              }
            >
              {role}
            </RoleCard>
          ))}
          {all_roles.filter((role: string) => !other_roles.includes(role))
            .length > 0 && (
            <AddRolePopover
              roles={all_roles.filter(
                (role: string) => !other_roles.includes(role)
              )}
              userId={userId}
            />
          )}
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
      cell: ({row}: any) => (
        <div className="flex justify-center items-center -my-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => console.log('remove', row.original._id)}
          >
            <Trash className="h-4 w-4" />
          </Button>
        </div>
      ),
      header: () => (
        <div className="flex justify-center items-center">Remove</div>
      ),
    },
  ];
};
