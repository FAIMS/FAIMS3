import {ColumnDef} from '@tanstack/react-table';
import {DataTableColumnHeader} from '../data-table/column-header';
import RoleCard from '../ui/role-card';
import {CopyButton} from '../ui/copy-button';

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
    accessorKey: 'invite_code',
    header: ({column}) => (
      <DataTableColumnHeader column={column} title="Code" />
    ),
    cell: ({
      row: {
        original: {_id},
      },
    }: any) => (
      <div>
        <CopyButton value={_id}>{_id}</CopyButton>
      </div>
    ),
  },
  {
    accessorKey: 'url',
    header: ({column}) => (
      <DataTableColumnHeader column={column} title="Link" />
    ),
    cell: ({
      row: {
        original: {_id},
      },
    }: any) => {
      const url = `${import.meta.env.VITE_API_URL}/register/${_id}`;
      return <CopyButton value={url}>{url}</CopyButton>;
    },
  },
];
