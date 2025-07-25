import {useAuth} from '@/context/auth-provider';
import {useIsAuthorisedTo} from '@/hooks/auth-hooks';
import {displayUnixTimestampMs} from '@/lib/utils';
import {Action, GetLongLivedTokensResponse} from '@faims3/data-model';
import {ColumnDef} from '@tanstack/react-table';
import {Edit, Trash} from 'lucide-react';
import {toast} from 'sonner';
import {DataTableColumnHeader} from '../data-table/column-header';
import {Badge} from '../ui/badge';
import {Button} from '../ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';

export const useGetLongLivedTokensColumns = ({
  revokeTokenHandler,
  editTokenHandler,
}: {
  revokeTokenHandler?: (tokenId: string) => Promise<void>;
  editTokenHandler?: (tokenId: string) => void;
}): ColumnDef<GetLongLivedTokensResponse['tokens'][number]>[] => {
  const {user} = useAuth();

  if (!user) {
    return [];
  }

  // Check permissions
  const canEditMyTokens = useIsAuthorisedTo({
    action: Action.EDIT_MY_LONG_LIVED_TOKEN,
  });
  const canRevokeMyTokens = useIsAuthorisedTo({
    action: Action.REVOKE_MY_LONG_LIVED_TOKEN,
  });
  const canEditAnyTokens = useIsAuthorisedTo({
    action: Action.EDIT_ANY_LONG_LIVED_TOKEN,
  });
  const canRevokeAnyTokens = useIsAuthorisedTo({
    action: Action.REVOKE_ANY_LONG_LIVED_TOKEN,
  });

  const canEditToken = (tokenUserId: string) =>
    tokenUserId === user.user.id ? canEditMyTokens : canEditAnyTokens;

  const canRevokeToken = (tokenUserId: string) =>
    tokenUserId === user.user.id ? canRevokeMyTokens : canRevokeAnyTokens;

  const baseColumns: ColumnDef<GetLongLivedTokensResponse['tokens'][number]>[] =
    [
      {
        accessorKey: 'title',
        header: ({column}) => (
          <DataTableColumnHeader column={column} title="Title" />
        ),
        cell: ({
          row: {
            original: {title},
          },
        }) => <div className="font-medium">{title}</div>,
      },
      {
        accessorKey: 'description',
        header: ({column}) => (
          <DataTableColumnHeader column={column} title="Description" />
        ),
        cell: ({
          row: {
            original: {description},
          },
        }) => (
          <div
            className="max-w-xs truncate text-muted-foreground"
            title={description}
          >
            {description}
          </div>
        ),
      },
      {
        accessorKey: 'userId',
        header: ({column}) => (
          <DataTableColumnHeader column={column} title="Owner" />
        ),
        cell: ({
          row: {
            original: {userId},
          },
        }) => <code className="text-xs">{userId}</code>,
      },
      {
        accessorKey: 'enabled',
        header: ({column}) => (
          <DataTableColumnHeader column={column} title="Status" />
        ),
        cell: ({
          row: {
            original: {enabled, expiresAt},
          },
        }) => {
          const isExpired = expiresAt && expiresAt < Date.now();

          if (!enabled) {
            return <Badge variant="destructive">Revoked</Badge>;
          } else if (isExpired) {
            return <Badge variant="secondary">Expired</Badge>;
          } else {
            return <Badge variant="outline">Active</Badge>;
          }
        },
      },
      {
        accessorKey: 'createdAt',
        header: ({column}) => (
          <DataTableColumnHeader column={column} title="Created" />
        ),
        cell: ({
          row: {
            original: {createdAt},
          },
        }) => displayUnixTimestampMs({timestamp: createdAt}),
      },
      {
        accessorKey: 'lastUsedAt',
        header: ({column}) => (
          <DataTableColumnHeader column={column} title="Last Used" />
        ),
        cell: ({
          row: {
            original: {lastUsedAt},
          },
        }) =>
          lastUsedAt
            ? displayUnixTimestampMs({timestamp: lastUsedAt})
            : 'Never',
      },
      {
        accessorKey: 'expiresAt',
        header: ({column}) => (
          <DataTableColumnHeader column={column} title="Expires" />
        ),
        cell: ({
          row: {
            original: {expiresAt},
          },
        }) => {
          if (!expiresAt) return '∞';

          const isExpired = expiresAt < Date.now();
          const display = displayUnixTimestampMs({timestamp: expiresAt});

          return (
            <span className={isExpired ? 'text-destructive' : ''}>
              {display}
            </span>
          );
        },
      },
    ];

  // Add actions column if any handlers are provided
  if (editTokenHandler || revokeTokenHandler) {
    baseColumns.push({
      id: 'actions',
      header: 'Actions',
      cell: ({
        row: {
          original: {id, userId, enabled},
        },
      }) => {
        const canEdit = canEditToken(userId) && enabled;
        const canRevoke = canRevokeToken(userId) && enabled; // Can't revoke already revoked tokens

        return (
          <div className="flex gap-1">
            {editTokenHandler && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      disabled={!canEdit}
                      onClick={() => editTokenHandler(id)}
                      variant="outline"
                      size="sm"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {!canEdit
                      ? userId === user.user.id
                        ? 'You are not authorized to edit your own tokens'
                        : "You are not authorized to edit other users' tokens"
                      : 'Edit token details'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {revokeTokenHandler && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      disabled={!canRevoke}
                      onClick={async () => {
                        try {
                          await revokeTokenHandler(id);
                          toast.success('Token revoked successfully');
                        } catch (error) {
                          toast.error('Failed to revoke token', {
                            description:
                              error instanceof Error
                                ? error.message
                                : 'Unknown error occurred',
                          });
                        }
                      }}
                      variant="destructive"
                      size="sm"
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {!enabled
                      ? 'Token is already revoked'
                      : !canRevokeToken(userId)
                        ? userId === user.user.id
                          ? 'You are not authorized to revoke your own tokens'
                          : "You are not authorized to revoke other users' tokens"
                        : 'Revoke this token (cannot be undone)'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        );
      },
    });
  }

  return baseColumns;
};
