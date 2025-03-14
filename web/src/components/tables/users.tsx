import {ColumnDef} from '@tanstack/react-table';
import {KeyRound} from 'lucide-react';
import {DataTableColumnHeader} from '../data-table/column-header';
import {Button} from '../ui/button';
import {RemoveUserDialog} from '../dialogs/remove-user';
import {RoleCard} from '../ui/role-card';

export const getColumns = ({
  onReset,
}: {
  onReset: (id: string) => void;
}): ColumnDef<any>[] => {
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
      accessorKey: 'roles',
      header: 'Roles',
      cell: ({row}: any) => (
        <div className="flex flex-wrap gap-1">
          {row
            .getValue('roles')
            .filter((role: string) => !role.includes('||'))
            .map((role: string) => (
              <RoleCard key={role}>{role}</RoleCard>
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
          original: {_id, other_roles},
        },
      }: any) => (
        <div className="flex justify-center items-center -my-2">
          <RemoveUserDialog
            userId={_id}
            disabled={!_id || other_roles.includes('cluster-admin')}
          />
        </div>
      ),
      header: () => (
        <div className="flex justify-center items-center">Remove</div>
      ),
    },
  ];
};
