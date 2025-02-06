import {ColumnDef} from '@tanstack/react-table';
import {DataTableColumnHeader} from '../data-table/column-header';
import RoleCard from '../ui/role-card';
import {Checkbox} from '../ui/checkbox';

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
  {
    id: 'active',
    cell: () => <Checkbox value={1} />,
    header: () => <div>Active</div>,
  },
];
