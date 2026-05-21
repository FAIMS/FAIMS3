import {ColumnDef} from '@tanstack/react-table';
import {DataTableColumnHeader} from '../data-table/column-header';
import {TeamCellComponent} from './cells/team-cell';
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
import {Button} from '@/components/ui/button';
import {ArchiveRestore, Trash2} from 'lucide-react';
import {useState} from 'react';

export type ArchivedTemplateRow = GetListTemplatesResponse['templates'][number];

const ARCHIVE_ACTION_COL_META = {
  headerClassName: 'w-10 max-w-10 px-0.5 text-center align-middle',
  cellClassName: 'w-10 max-w-10 px-0.5 text-center align-middle',
};

function ArchivedTemplateRestoreCell({row}: {row: ArchivedTemplateRow}) {
  const {user} = useAuth();
  const [open, setOpen] = useState(false);

  const canRestore =
    !!user &&
    userCanDo({
      user,
      action: Action.CHANGE_TEMPLATE_STATUS,
      resourceId: row._id,
    });

  const tooltip = canRestore
    ? 'Restore this template from archive'
    : "You don't have permission to restore this template";

  return (
    <>
      <TooltipProvider>
        <div
          className="flex justify-center"
          onClick={e => e.stopPropagation()}
          onKeyDown={e => e.stopPropagation()}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              {canRestore ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 text-foreground [&_svg]:size-[1.125rem]"
                  aria-label="Restore from archive"
                  onClick={() => setOpen(true)}
                >
                  <ArchiveRestore aria-hidden />
                </Button>
              ) : (
                <span className="inline-flex">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0 text-foreground [&_svg]:size-[1.125rem]"
                    aria-label="Restore from archive"
                    disabled
                  >
                    <ArchiveRestore aria-hidden />
                  </Button>
                </span>
              )}
            </TooltipTrigger>
            <TooltipContent side="top">{tooltip}</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
      {canRestore ? (
        <RestoreTemplateDialog
          templateId={row._id}
          templateName={row.name}
          open={open}
          onOpenChange={setOpen}
        />
      ) : null}
    </>
  );
}

function ArchivedTemplateDeleteCell({row}: {row: ArchivedTemplateRow}) {
  const {user} = useAuth();
  const [open, setOpen] = useState(false);

  const canDelete =
    !!user &&
    userCanDo({
      user,
      action: Action.DELETE_TEMPLATE,
      resourceId: row._id,
    });

  const tooltip = canDelete
    ? templateDeleteDialogLabels.title
    : "You don't have permission to delete this template";

  return (
    <>
      <TooltipProvider>
        <div
          className="flex justify-center"
          onClick={e => e.stopPropagation()}
          onKeyDown={e => e.stopPropagation()}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              {canDelete ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive [&_svg]:size-[1.125rem]"
                  aria-label={templateDeleteDialogLabels.menuItem}
                  onClick={() => setOpen(true)}
                >
                  <Trash2 aria-hidden />
                </Button>
              ) : (
                <span className="inline-flex">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive [&_svg]:size-[1.125rem]"
                    aria-label={templateDeleteDialogLabels.menuItem}
                    disabled
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </span>
              )}
            </TooltipTrigger>
            <TooltipContent side="top">{tooltip}</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
      {canDelete ? (
        <DeleteArchivedTemplateDialog
          templateId={row._id}
          templateName={row.name}
          open={open}
          onOpenChange={setOpen}
        />
      ) : null}
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
        original: {ownedByTeamId, ownedByTeamDisplayName},
      },
    }) => {
      return ownedByTeamId ? (
        <TeamCellComponent
          teamId={ownedByTeamId}
          teamDisplayName={ownedByTeamDisplayName}
        />
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
    id: 'restore',
    enableSorting: false,
    enableGlobalFilter: false,
    header: () => <span className="sr-only">Restore from archive</span>,
    meta: ARCHIVE_ACTION_COL_META,
    cell: ({row}) => <ArchivedTemplateRestoreCell row={row.original} />,
  },
  {
    id: 'delete',
    enableSorting: false,
    enableGlobalFilter: false,
    header: () => (
      <span className="sr-only">{templateDeleteDialogLabels.menuItem}</span>
    ),
    meta: ARCHIVE_ACTION_COL_META,
    cell: ({row}) => <ArchivedTemplateDeleteCell row={row.original} />,
  },
];
