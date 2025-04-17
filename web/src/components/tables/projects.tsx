import {NOTEBOOK_NAME_CAPITALIZED} from '@/constants';
import {GetNotebookListResponse} from '@faims3/data-model';
import {ColumnDef} from '@tanstack/react-table';
import {DataTableColumnHeader} from '../data-table/column-header';
import {TeamCellComponent} from './cells/team-cell';
import {TemplateCellComponent} from './cells/template-cell';

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
    id: 'template',
    accessorKey: 'template_id',
    header: ({column}) => (
      <DataTableColumnHeader column={column} title="Template" />
    ),
    cell: ({
      row: {
        original: {template_id},
      },
    }) => {
      return template_id ? (
        <TemplateCellComponent templateId={template_id} />
      ) : null;
    },
  },
  {
    accessorKey: 'metadata.project_lead',
    header: ({column}) => (
      <DataTableColumnHeader
        column={column}
        title={`${NOTEBOOK_NAME_CAPITALIZED} Lead`}
      />
    ),
  },
  {
    accessorKey: 'metadata.pre_description',
    header: ({column}) => (
      <DataTableColumnHeader column={column} title="Description" />
    ),
  },
];
