import {ColumnDef} from '@tanstack/react-table';
import {DataTableColumnHeader} from '../data-table/column-header';
import {RoleCard} from '../ui/role-card';
import {CopyButton} from '../ui/copy-button';
import {QRCodeDialog} from '../dialogs/qr-code-dialog';
import {
  Action,
  GetProjectInvitesResponse,
  roleDetails,
  Role,
  projectInviteToAction,
} from '@faims3/data-model';
import {displayUnixTimestampMs} from '@/lib/utils';
import {useAuth} from '@/context/auth-provider';
import {useQueryClient} from '@tanstack/react-query';
import {useIsAuthorisedTo, userCanDo} from '@/hooks/auth-hooks';
import {Trash} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import {Button} from '../ui/button';
import {toast} from 'sonner';

export const useGetInviteColumns = ({
  projectId,
  deleteInviteHandler,
}: {
  projectId: string;
  deleteInviteHandler: (inviteId: string) => Promise<Response>;
}): ColumnDef<
  GetProjectInvitesResponse[number] & {url: string; qrCode: string}
>[] => {
  const {user} = useAuth();
  if (!user) {
    return [];
  }
  const queryClient = useQueryClient();

  const canDeleteAdminInvite = useIsAuthorisedTo({
    action: Action.DELETE_ADMIN_PROJECT_INVITE,
    resourceId: projectId,
  });
  const canDeleteManagerInvite = useIsAuthorisedTo({
    action: Action.DELETE_MANAGER_PROJECT_INVITE,
    resourceId: projectId,
  });
  const canDeleteContributorInvite = useIsAuthorisedTo({
    action: Action.DELETE_CONTRIBUTOR_PROJECT_INVITE,
    resourceId: projectId,
  });
  const canDeleteGuestInvite = useIsAuthorisedTo({
    action: Action.DELETE_GUEST_PROJECT_INVITE,
    resourceId: projectId,
  });

  const canRemoveSomeInvite =
    canDeleteAdminInvite ||
    canDeleteManagerInvite ||
    canDeleteGuestInvite ||
    canDeleteContributorInvite;

  const canRemoveInvite = (role: Role) =>
    userCanDo({
      user,
      action: projectInviteToAction({action: 'delete', role}),
      resourceId: projectId,
    });

  const baseColumns: ColumnDef<
    GetProjectInvitesResponse[number] & {url: string; qrCode: string}
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
                          queryKey: ['projectinvites', projectId],
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
                    : 'Removes this invite from the project.'}
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
