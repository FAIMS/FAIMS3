import {ColumnDef} from '@tanstack/react-table';
import {DataTableColumnHeader} from '../data-table/column-header';
import {TeamCellComponent} from './cells/team-cell';
import {NOTEBOOK_NAME_CAPITALIZED} from '@/constants';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import {RestoreTemplateDialog} from '../dialogs/restore-template-dialog';
import {GetListTemplatesResponse} from '@faims3/data-model';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {Button} from '@/components/ui/button';
import {MoreVertical} from 'lucide-react';
import {useState} from 'react';

export type ArchivedTemplateRow = GetListTemplatesResponse['templates'][number];

function ArchivedTemplateRowActions({row}: {row: ArchivedTemplateRow}) {
  const [restoreOpen, setRestoreOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="h-9 w-9 shrink-0 rounded-md p-0 text-foreground hover:bg-muted/90 hover:text-foreground [&_svg]:!size-6 [&_svg]:shrink-0"
            aria-label="Row actions"
            onClick={e => e.stopPropagation()}
          >
            <MoreVertical aria-hidden strokeWidth={2.25} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[9rem]">
          <DropdownMenuItem
            onSelect={() => {
              setRestoreOpen(true);
            }}
          >
            Restore
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <RestoreTemplateDialog
        templateId={row._id}
        templateName={row.name}
        open={restoreOpen}
        onOpenChange={setRestoreOpen}
      />
    </>
  );
}

export const archivedTemplateColumns: ColumnDef<ArchivedTemplateRow>[] = [
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
    }: {
      row: {original: ArchivedTemplateRow};
    }) => <span className="capitalize">{project_status}</span>,
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
    cell: ({getValue}) => {
      const description = getValue<string>();
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
    },
  },
  {
    id: 'actions',
    enableSorting: false,
    enableGlobalFilter: false,
    header: () => <span className="sr-only">Actions</span>,
    meta: {
      headerClassName: 'w-12 max-w-12 px-1 text-right align-middle',
      cellClassName: 'w-12 max-w-12 px-1 text-right align-middle',
    },
    cell: ({row}) => (
      <div
        className="flex justify-end"
        onClick={e => e.stopPropagation()}
        onKeyDown={e => e.stopPropagation()}
      >
        <ArchivedTemplateRowActions row={row.original} />
      </div>
    ),
  },
];
