import {ColumnDef} from '@tanstack/react-table';
import {DataTableColumnHeader} from '../data-table/column-header';
import {RoleCard} from '../ui/role-card';
import {CopyButton} from '../ui/copy-button';
import {QRCodeDialog} from '../dialogs/qr-code-dialog';
import {
  Action,
  GetGlobalInvitesResponse,
  roleDetails,
} from '@faims3/data-model';
import {displayUnixTimestampMs} from '@/lib/utils';
import {useAuth} from '@/context/auth-provider';
import {useQueryClient} from '@tanstack/react-query';
import {useIsAuthorisedTo} from '@/hooks/auth-hooks';
import {Trash} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import {Button} from '../ui/button';
import {toast} from 'sonner';

export const useGetGlobalInviteColumns = ({
  deleteInviteHandler,
}: {
  deleteInviteHandler: (inviteId: string) => Promise<Response>;
}): ColumnDef<
  GetGlobalInvitesResponse[number] & {url: string; qrCode: string}
>[] => {
  const {user} = useAuth();
  if (!user) {
    return [];
  }
  const queryClient = useQueryClient();

  const canRemoveSomeInvite = useIsAuthorisedTo({
    action: Action.DELETE_GLOBAL_INVITE,
  });

  const baseColumns: ColumnDef<
    GetGlobalInvitesResponse[number] & {url: string; qrCode: string}
  >[] = [
    {
      accessorKey: 'name',
      header: ({column}) => (
        <DataTableColumnHeader column={column} title="Name" />
      ),
    },
    {
      accessorKey: 'role',
      header: ({column}) => (
        <DataTableColumnHeader column={column} title="Role" />
      ),
      cell: ({
        row: {
          original: {role},
        },
      }) => <RoleCard>{roleDetails[role].name}</RoleCard>,
    },
    {
      accessorKey: 'expiry',
      header: ({column}) => (
        <DataTableColumnHeader column={column} title="Expiry" />
      ),
      cell: ({
        row: {
          original: {expiry},
        },
      }) => displayUnixTimestampMs({timestamp: expiry}),
    },
    {
      accessorKey: 'uses',
      header: ({column}) => (
        <DataTableColumnHeader column={column} title="Uses remaining" />
      ),
      cell: ({
        row: {
          original: {usesOriginal, usesConsumed},
        },
      }) => {
        if (usesOriginal) {
          return usesOriginal - usesConsumed;
        } else {
          return '∞';
        }
      },
    },
    {
      accessorKey: 'code',
      header: ({column}) => (
        <DataTableColumnHeader column={column} title="Code" />
      ),
      cell: ({
        row: {
          original: {_id},
        },
      }) => (
        <div>
          <CopyButton value={_id}>
            <code>{_id}</code>
          </CopyButton>
        </div>
      ),
    },
    {
      accessorKey: 'url',
      header: 'Link',
      cell: ({
        row: {
          original: {_id, url},
        },
      }) => {
        return (
          <CopyButton value={url}>
            <code>link:{_id}</code>
          </CopyButton>
        );
      },
    },
    {
      accessorKey: 'qrCode',
      header: () => <div className="flex justify-center">QR Code</div>,
      cell: ({
        row: {
          original: {qrCode},
        },
      }) => (
        <div className="flex justify-center">
          <QRCodeDialog src={qrCode} />
        </div>
      ),
    },
  ];

  // Conditionally add the remove column if user has permission to remove any type of invite
  if (canRemoveSomeInvite) {
    baseColumns.push({
      id: 'remove-invite',
      header: 'Remove',
      cell: ({
        row: {
          original: {_id},
        },
      }) => {
        return (
          <div className="flex justify-center">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild className="w-fit">
                  <Button
                    disabled={!canRemoveSomeInvite}
                    onClick={async () => {
                      try {
                        const response = await deleteInviteHandler(_id);

                        if (!response.ok) throw new Error(response.statusText);

                        queryClient.invalidateQueries({
                          queryKey: ['globalinvites'],
                        });

                        toast.success('Invite removed successfully');
                      } catch (error) {
                        toast.error('Failed to remove invite', {
                          description:
                            error instanceof Error
                              ? error.message
                              : 'Unknown error occurred',
                        });
                      }
                    }}
                    variant={'destructive'}
                  >
                    <Trash />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="w-40 text-balance">
                  {!canRemoveSomeInvite
                    ? 'You are not authorised to remove this invite'
                    : 'Removes this invite from the team.'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        );
      },
    });
  }

  return baseColumns;
};
