import {ColumnDef} from '@tanstack/react-table';
import {DataTableColumnHeader} from '../data-table/column-header';
import {AddRolePopover} from '../popovers/add-role-popover';

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
];
