// SPDX-License-Identifier: Apache-2.0
import {ColumnDef} from '@tanstack/react-table';
import {DataTableColumnHeader} from '../data-table/column-header';
import {GetListTeamsResponse} from '@faims3/data-model';
import {displayDateTime} from '@/lib/time';

export const columns: ColumnDef<GetListTeamsResponse['teams'][number]>[] = [
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
      const timestamp = row.getValue('createdAt') as number;
      return timestamp ? displayDateTime({timestamp}) : '';
    },
  },
  {
    accessorKey: 'updatedAt',
    header: ({column}) => (
      <DataTableColumnHeader column={column} title="Updated At" />
    ),
    cell: ({row}) => {
      const timestamp = row.getValue('updatedAt') as number;
      return timestamp ? displayDateTime({timestamp}) : '';
    },
  },
];
