import {GetNotebookListResponse} from '@faims3/data-model';
import {ColumnDef} from '@tanstack/react-table';
import {DataTableColumnHeader} from '../data-table/column-header';
import {TeamCellComponent} from './cells/team-cell';

export const columns: ColumnDef<GetNotebookListResponse[number]>[] = [
  {
    accessorKey: 'name',
    header: ({column}) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
  },
  {
    id: 'team',
    accessorKey: 'ownedByTeamId',
    header: ({column}) => (
      <DataTableColumnHeader column={column} title="Team" />
    ),
    cell: ({
      row: {
        original: {ownedByTeamId},
      },
    }) => {
      return ownedByTeamId ? (
        <TeamCellComponent teamId={ownedByTeamId} />
      ) : null;
    },
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
