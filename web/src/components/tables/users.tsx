import {ColumnDef} from '@tanstack/react-table';
import {DataTableColumnHeader} from '../data-table/column-header';
import {Trash} from 'lucide-react';
import {Button} from '../ui/button';
import Role from '../ui/role-card';

export const columns: ColumnDef<any>[] = [
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
          .map((role: any) => (
            <Role key={role} role={role} />
          ))}
      </div>
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
