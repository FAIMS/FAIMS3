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
import {RestoreArchivedProjectDialog} from '../dialogs/restore-archived-project-dialog';
import {DeleteArchivedProjectDialog} from '../dialogs/delete-archived-project-dialog';
import {
  Action,
  GetNotebookListResponse,
  ProjectStatus,
} from '@faims3/data-model';
import {useAuth} from '@/context/auth-provider';
import {userCanDo} from '@/hooks/auth-hooks';
import {Button} from '@/components/ui/button';
import {ArchiveRestore, Trash2} from 'lucide-react';
import {useState} from 'react';
export type ArchivedProjectRow = GetNotebookListResponse[number];

const ARCHIVE_ACTION_COL_META = {
  headerClassName: 'w-10 max-w-10 px-0.5 text-center align-middle',
  cellClassName: 'w-10 max-w-10 px-0.5 text-center align-middle',
};

function ArchivedProjectRestoreCell({row}: {row: ArchivedProjectRow}) {
  const {user} = useAuth();
  const [open, setOpen] = useState(false);

  const canRestore =
    !!user &&
    userCanDo({
      user,
      action: Action.CHANGE_PROJECT_ARCHIVE_STATUS,
      resourceId: row.project_id,
    });

  const tooltip = canRestore
    ? `Restore this ${NOTEBOOK_NAME_CAPITALIZED} from archive`
    : `You don't have permission to restore this ${NOTEBOOK_NAME_CAPITALIZED}`;

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
        <RestoreArchivedProjectDialog
          projectId={row.project_id}
          open={open}
          onOpenChange={setOpen}
        />
      ) : null}
    </>
  );
}

function ArchivedProjectDeleteCell({row}: {row: ArchivedProjectRow}) {
  const {user} = useAuth();
  const [open, setOpen] = useState(false);

  const canDelete =
    !!user &&
    userCanDo({
      user,
      action: Action.DELETE_PROJECT,
      resourceId: row.project_id,
    });

  const tooltip = canDelete
    ? `Permanently delete this archived ${NOTEBOOK_NAME_CAPITALIZED}`
    : `You don't have permission to delete this ${NOTEBOOK_NAME_CAPITALIZED}`;

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
                  aria-label="Permanently delete"
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
                    aria-label="Permanently delete"
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
        <DeleteArchivedProjectDialog
          projectId={row.project_id}
          projectDisplayName={row.name}
          open={open}
          onOpenChange={setOpen}
        />
      ) : null}
    </>
  );
}

export const archivedProjectColumns: ColumnDef<ArchivedProjectRow>[] = [
  {
    accessorKey: 'name',
    header: ({column}) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    cell: ({row}) => (
      <span className="font-medium text-card-foreground">
        {row.original.name}
      </span>
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
    id: 'status',
    header: ({column}) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    accessorFn: (row: ArchivedProjectRow) => row.status,
    cell: ({row: {original}}: {row: {original: ArchivedProjectRow}}) => (
      <span className="capitalize">
        {original.status === ProjectStatus.ARCHIVED
          ? 'archived'
          : original.status}
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
    id: 'restore',
    enableSorting: false,
    enableGlobalFilter: false,
    header: () => (
      <span className="sr-only">Restore from archive</span>
    ),
    meta: ARCHIVE_ACTION_COL_META,
    cell: ({row}) => <ArchivedProjectRestoreCell row={row.original} />,
  },
  {
    id: 'delete',
    enableSorting: false,
    enableGlobalFilter: false,
    header: () => <span className="sr-only">Permanently delete</span>,
    meta: ARCHIVE_ACTION_COL_META,
    cell: ({row}) => <ArchivedProjectDeleteCell row={row.original} />,
  },
];
