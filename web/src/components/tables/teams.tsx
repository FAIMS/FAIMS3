import {ColumnDef} from '@tanstack/react-table';
import {DataTableColumnHeader} from '../data-table/column-header';
import {GetListTeamsResponse} from '@faims3/data-model';

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
        const date = new Date(timestamp);
        // Format: Apr 2, 2025, 3:30 PM
        return (
          date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
          }) +
          ', ' +
          date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })
        );
      }
      return '';
    },
  },
];
