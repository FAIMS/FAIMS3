import {ColumnDef} from '@tanstack/react-table';
import {DataTableColumnHeader} from '../data-table/column-header';
import {Trash} from 'lucide-react';
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
    accessorKey: 'team-role',
    header: ({column}) => (
      <DataTableColumnHeader column={column} title="Team Role" />
    ),
  },
  {
    accessorKey: 'survey-role',
    header: ({column}) => (
      <DataTableColumnHeader column={column} title="Survey Role" />
    ),
  },
  {
    id: 'remove',
    cell: () => (
      <div className="flex justify-center items-center -my-2">
        <Button variant="outline" size="icon">
          <Trash className="h-4 w-4" />
        </Button>
      </div>
    ),
    header: () => (
      <div className="flex justify-center items-center">Remove</div>
    ),
  },
];
