import {ColumnDef} from '@tanstack/react-table';
import {DataTableColumnHeader} from '../data-table/column-header';
import {Trash} from 'lucide-react';
import {Button} from '../ui/button';
import {NOTEBOOK_NAME_CAPITALIZED} from '@/constants';

export const columns: ColumnDef<any>[] = [
  {
    accessorKey: 'name',
    header: ({column}) => (
      <DataTableColumnHeader column={column} title="Name" />
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
      <DataTableColumnHeader
        column={column}
        title={`${NOTEBOOK_NAME_CAPITALIZED} Role`}
      />
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
