import {ColumnDef} from '@tanstack/react-table';
import {DataTableColumnHeader} from '../data-table/column-header';
import RoleCard from '../ui/role-card';

export const columns: ColumnDef<any>[] = [
  {
    accessorKey: 'role',
    header: ({column}) => (
      <DataTableColumnHeader column={column} title="Role" />
    ),
    cell: ({
      row: {
        original: {role},
      },
    }: any) => <RoleCard>{role}</RoleCard>,
  },
  {
    accessorKey: '_id',
    header: ({column}) => (
      <DataTableColumnHeader column={column} title="Access Code" />
    ),
  },
];
