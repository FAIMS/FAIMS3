// SPDX-License-Identifier: Apache-2.0
import {ColumnDef} from '@tanstack/react-table';
import {DataTableColumnHeader} from '../data-table/column-header';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import {RestoreTeamDialog} from '../dialogs/restore-team-dialog';
import {DeleteArchivedTeamDialog} from '../dialogs/delete-archived-team-dialog';
import {Action, GetListTeamsResponse} from '@faims3/data-model';
import {useAuth} from '@/context/auth-provider';
import {userCanDo} from '@/hooks/auth-hooks';
import {Button} from '@/components/ui/button';
import {ArchiveRestore, Trash2} from 'lucide-react';
import {useState} from 'react';

export type ArchivedTeamRow = GetListTeamsResponse['teams'][number];

const ARCHIVE_ACTION_COL_META = {
  headerClassName: 'w-10 max-w-10 px-0.5 text-center align-middle',
  cellClassName: 'w-10 max-w-10 px-0.5 text-center align-middle',
};

function ArchivedTeamRestoreCell({row}: {row: ArchivedTeamRow}) {
  const {user} = useAuth();
  const [open, setOpen] = useState(false);

  const canRestore =
    !!user &&
    userCanDo({
      user,
      action: Action.CHANGE_TEAM_STATUS,
      resourceId: row._id,
    });

  const tooltip = canRestore
    ? 'Restore this team from archive'
    : "You don't have permission to restore this team";

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
        <RestoreTeamDialog
          teamId={row._id}
          teamName={row.name}
          open={open}
          onOpenChange={setOpen}
        />
      ) : null}
    </>
  );
}

function ArchivedTeamDeleteCell({row}: {row: ArchivedTeamRow}) {
  const {user} = useAuth();
  const [open, setOpen] = useState(false);

  const canDelete =
    !!user &&
    userCanDo({
      user,
      action: Action.DELETE_TEAM,
      resourceId: row._id,
    });

  const tooltip = canDelete
    ? 'Permanently delete this archived team'
    : "You don't have permission to delete this team";

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
                  aria-label="Permanently delete team"
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
                    aria-label="Permanently delete team"
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
        <DeleteArchivedTeamDialog
          teamId={row._id}
          teamName={row.name}
          open={open}
          onOpenChange={setOpen}
        />
      ) : null}
    </>
  );
}

export const archivedTeamColumns: ColumnDef<ArchivedTeamRow>[] = [
  {
    accessorKey: 'name',
    header: ({column}) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
  },
  {
    accessorKey: 'description',
    header: ({column}) => (
      <DataTableColumnHeader column={column} title="Description" />
    ),
  },
  {
    id: 'archiveStatus',
    header: ({column}) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    accessorFn: (row: ArchivedTeamRow) =>
      row.archived === true ? 'archived' : 'active',
    cell: ({row: {original}}: {row: {original: ArchivedTeamRow}}) => (
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
    id: 'restore',
    enableSorting: false,
    enableGlobalFilter: false,
    header: () => <span className="sr-only">Restore from archive</span>,
    meta: ARCHIVE_ACTION_COL_META,
    cell: ({row}) => <ArchivedTeamRestoreCell row={row.original} />,
  },
  {
    id: 'delete',
    enableSorting: false,
    enableGlobalFilter: false,
    header: () => <span className="sr-only">Permanently delete team</span>,
    meta: ARCHIVE_ACTION_COL_META,
    cell: ({row}) => <ArchivedTeamDeleteCell row={row.original} />,
  },
];
