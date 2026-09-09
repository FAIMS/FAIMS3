import {ColumnDef} from '@tanstack/react-table';
import {DataTableColumnHeader} from '../data-table/column-header';
import {RoleCard} from '../ui/role-card';
import {CopyInviteLink} from '../ui/copy-invite-link';
import {ShowInviteCode} from '../ui/show-invite-code';
import {QRCodeDialog} from '../dialogs/qr-code-dialog';
import {
  Action,
  GetTeamInvitesResponse,
  roleDetails,
  Role,
  teamInviteToAction,
} from '@faims3/data-model';
import {displayDateTime} from '@/lib/time';
import {useQueryClient} from '@tanstack/react-query';
import {
  useIsAuthorisedTo,
  userCanDo,
  useRequiredUser,
} from '@/hooks/auth-hooks';
import {Trash} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import {Button} from '../ui/button';
import {toast} from 'sonner';

export const useGetTeamInviteColumns = ({
  teamId,
  deleteInviteHandler,
}: {
  teamId: string;
  deleteInviteHandler: (inviteId: string) => Promise<Response>;
}): ColumnDef<
  GetTeamInvitesResponse[number] & {url: string; qrCode: string}
>[] => {
  const user = useRequiredUser();
  const queryClient = useQueryClient();

  const canDeleteAdminInvite = useIsAuthorisedTo({
    action: Action.DELETE_ADMIN_TEAM_INVITE,
    resourceId: teamId,
  });
  const canDeleteManagerInvite = useIsAuthorisedTo({
    action: Action.DELETE_MANAGER_TEAM_INVITE,
    resourceId: teamId,
  });
  const canDeleteMemberInvite = useIsAuthorisedTo({
    action: Action.DELETE_MEMBER_TEAM_INVITE,
    resourceId: teamId,
  });

  const canRemoveSomeInvite =
    canDeleteAdminInvite || canDeleteManagerInvite || canDeleteMemberInvite;

  const canRemoveInvite = (role: Role) =>
    userCanDo({
      user,
      action: teamInviteToAction({action: 'delete', role}),
      resourceId: teamId,
    });

  const baseColumns: ColumnDef<
    GetTeamInvitesResponse[number] & {url: string; qrCode: string}
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
      }) => displayDateTime({timestamp: expiry}),
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
      accessorKey: 'qrCode',
      header: () => <div className="flex justify-center">QR Code</div>,
      cell: ({
        row: {
          original: {qrCode},
        },
      }) => (
        <div className="flex justify-center">
          <QRCodeDialog src={qrCode} resourceLabel="team" />
        </div>
      ),
    },
    {
      accessorKey: 'url',
      header: () => <div className="flex justify-center">Link</div>,
      cell: ({
        row: {
          original: {url},
        },
      }) => (
        <div className="flex justify-center">
          <CopyInviteLink url={url} />
        </div>
      ),
    },
    {
      accessorKey: 'code',
      header: () => <div className="flex justify-center">Code</div>,
      cell: ({
        row: {
          original: {_id},
        },
      }) => (
        <div className="flex justify-center">
          <ShowInviteCode code={_id} />
        </div>
      ),
    },
  ];

  // Conditionally add the remove column if user has permission to remove any type of invite
  if (canRemoveSomeInvite) {
    baseColumns.push({
      id: 'remove-invite',
      header: () => <div className="flex justify-center">Remove</div>,
      cell: ({
        row: {
          original: {_id, role},
        },
      }) => {
        const canRemove = canRemoveInvite(role);
        return (
          <div className="flex justify-center">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild className="w-fit">
                  <Button
                    disabled={!canRemove}
                    onClick={async () => {
                      try {
                        const response = await deleteInviteHandler(_id);

                        if (!response.ok) throw new Error(response.statusText);

                        queryClient.invalidateQueries({
                          queryKey: ['teaminvites', teamId],
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
                  {!canRemove
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
