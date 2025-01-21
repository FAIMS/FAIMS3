import {ColumnDef} from '@tanstack/react-table';
import {DataTableColumnHeader} from '../ui/data-table/column-header';
import {Pencil, Trash} from 'lucide-react';
import {Button} from '../ui/button';

export type Payment = {
  id: string;
  amount: number;
  status: 'pending' | 'processing' | 'success' | 'failed';
  email: string;
};

export const columns: ColumnDef<Payment>[] = [
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
            <div
              key={role}
              className="bg-muted text-muted-foreground px-2 py-1 rounded-md"
            >
              {role}
            </div>
          ))}
      </div>
    ),
  },
  // {
  //   id: 'manage-roles',
  //   cell: () => (
  //     <div className="flex justify-center items-center">
  //       <Button variant="outline" size="icon">
  //         <Pencil className="h-4 w-4" />
  //       </Button>
  //     </div>
  //   ),
  //   header: 'Manage Roles',
  // },
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
