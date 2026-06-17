import {GetNotebookListResponse} from '@faims3/data-model';
import {ColumnDef} from '@tanstack/react-table';
import {DataTableColumnHeader} from '../data-table/column-header';
import {TeamCellComponent} from './cells/team-cell';
import {TemplateCellComponent} from './cells/template-cell';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';

function truncatedDescriptionCell(description: string | undefined) {
  if (!description) return null;
  const maxLength = 100;
  const isTruncated = description.length > maxLength;
  const displayText = isTruncated
    ? description.slice(0, maxLength) + '…'
    : description;

  if (!isTruncated) return <span>{displayText}</span>;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help">{displayText}</span>
        </TooltipTrigger>
        <TooltipContent className="max-w-sm">
          <p>{description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

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
    accessorKey: 'templateId',
    header: ({column}) => (
      <DataTableColumnHeader column={column} title="Template" />
    ),
    cell: ({
      row: {
        original: {templateId},
      },
    }) => {
      return templateId ? (
        <TemplateCellComponent templateId={templateId} />
      ) : null;
    },
  },
  {
    accessorKey: 'createdBy',
    header: ({column}) => (
      <DataTableColumnHeader column={column} title="Created by" />
    ),
  },
  {
    accessorKey: 'description',
    header: ({column}) => (
      <DataTableColumnHeader column={column} title="Description" />
    ),
    cell: ({getValue}) =>
      truncatedDescriptionCell(getValue<string | undefined>()),
  },
];
