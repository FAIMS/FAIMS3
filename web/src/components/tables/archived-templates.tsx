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
import {DeleteArchivedTemplateDialog} from '../dialogs/delete-archived-template-dialog';
import {Action, GetListTemplatesResponse} from '@faims3/data-model';
import {useAuth} from '@/context/auth-provider';
import {userCanDo} from '@/hooks/auth-hooks';
import {templateDeleteDialogLabels} from '@/archive/template-delete-warnings';
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
  const {user} = useAuth();
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const canRestore =
    !!user &&
    userCanDo({
      user,
      action: Action.CHANGE_TEMPLATE_STATUS,
      resourceId: row._id,
    });

  const canDelete =
    !!user &&
    userCanDo({
      user,
      action: Action.DELETE_TEMPLATE,
      resourceId: row._id,
    });

  const hasRowActions = canRestore || canDelete;

  return (
    <>
      {hasRowActions ? (
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
            {canRestore ? (
              <DropdownMenuItem
                onSelect={() => {
                  setRestoreOpen(true);
                }}
              >
                Restore
              </DropdownMenuItem>
            ) : null}
            {canDelete ? (
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => {
                  setDeleteOpen(true);
                }}
              >
                {templateDeleteDialogLabels.menuItem}
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      {canRestore ? (
        <RestoreTemplateDialog
          templateId={row._id}
          templateName={row.name}
          open={restoreOpen}
          onOpenChange={setRestoreOpen}
        />
      ) : null}
      <DeleteArchivedTemplateDialog
        templateId={row._id}
        templateName={row.name}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
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
    id: 'archiveStatus',
    header: ({column}) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    accessorFn: (row: ArchivedTemplateRow) =>
      row.archived === true ? 'archived' : 'active',
    cell: ({row: {original}}: {row: {original: ArchivedTemplateRow}}) => (
      <span className="capitalize">
        {original.archived === true ? 'archived' : 'active'}
      </span>
    ),
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
