import type {GetListAllUsersItem} from '@faims3/data-model';
import {ColumnDef} from '@tanstack/react-table';
import {DataTableColumnHeader} from '../data-table/column-header';
import {ReEnableUserDialog} from '../dialogs/re-enable-user';

const RE_ENABLE_COL_META = {
  headerClassName: 'w-10 max-w-10 px-0.5 text-center align-middle',
  cellClassName: 'w-10 max-w-10 px-0.5 text-center align-middle',
};

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
    id: 'reEnable',
    enableSorting: false,
    enableGlobalFilter: false,
    header: () => <span className="sr-only">Re-enable user</span>,
    meta: RE_ENABLE_COL_META,
    cell: ({row: {original}}) => <ReEnableUserDialog rowUser={original} />,
  },
];
