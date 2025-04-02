import {ColumnDef} from '@tanstack/react-table';
import {DataTableColumnHeader} from '../data-table/column-header';
import {GetListTeamsResponse} from '@faims3/data-model';
import {displayUnixTimestampMs} from '@/lib/utils';

export const columns: ColumnDef<GetListTeamsResponse['teams']>[] = [
  {
    accessorKey: 'name',
    header: ({column}) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
  },
  {
    accessorKey: 'description',
    header: ({column}) => (
      <DataTableColumnHeader column={column} title="Description" />
    ),
  },
  {
    accessorKey: 'createdBy',
    header: ({column}) => (
      <DataTableColumnHeader column={column} title="Owner" />
    ),
  },
  {
    accessorKey: 'createdAt',
    header: ({column}) => (
      <DataTableColumnHeader column={column} title="Created At" />
    ),
    cell: ({row}) => {
      // Get the Unix timestamp from the row data
      const timestamp = row.getValue('createdAt') as number;

      // Convert timestamp to a readable date format
      if (timestamp) {
        return displayUnixTimestampMs({timestamp});
      }
      return '';
    },
  },
];
