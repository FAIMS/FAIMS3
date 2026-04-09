import type {GetListAllUsersItem} from '@faims3/data-model';
import {ColumnDef} from '@tanstack/react-table';
import {DataTableColumnHeader} from '../data-table/column-header';
import {ReEnableUserDialog} from '../dialogs/re-enable-user';

export const archivedDisabledUserColumns: ColumnDef<GetListAllUsersItem>[] = [
  {
    accessorKey: 'name',
    header: ({column}) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
  },
  {
    id: 'email',
    header: ({column}) => (
      <DataTableColumnHeader column={column} title="Email" />
    ),
    cell: ({
      row: {
        original: {emails},
      },
    }) => <p>{emails[0]?.email ?? 'No email address'}</p>,
  },
  {
    accessorKey: 'user_id',
    header: ({column}) => (
      <DataTableColumnHeader column={column} title="Username" />
    ),
  },
  {
    id: 'actions',
    header: () => <div className="text-right">Actions</div>,
    cell: ({row: {original}}) => (
      <div className="flex justify-end">
        <ReEnableUserDialog rowUser={original} />
      </div>
    ),
  },
];
