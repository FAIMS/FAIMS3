import {ColumnDef} from '@tanstack/react-table';
import {DataTableColumnHeader} from '../data-table/column-header';
import RoleCard from '../ui/role-card';

export type Column = any;

export const columns: ColumnDef<Column>[] = [
  {
    accessorKey: 'template_name',
    header: ({column}) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
  },
  {
    accessorKey: 'metadata.project_status',
    header: ({column}) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({
      row: {
        original: {
          metadata: {project_status},
        },
      },
    }: any) => <RoleCard>{project_status}</RoleCard>,
  },
  {
    accessorKey: 'metadata.project_lead',
    header: ({column}) => (
      <DataTableColumnHeader column={column} title="Project Lead" />
    ),
  },
  {
    accessorKey: 'metadata.pre_description',
    header: ({column}) => (
      <DataTableColumnHeader column={column} title="Description" />
    ),
  },
];
