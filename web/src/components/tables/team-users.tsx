import {useAuth} from '@/context/auth-provider';
import {modifyMemberForTeam} from '@/hooks/teams-hooks';
import {GetTeamMembersResponse} from '@faims3/data-model';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import {useQueryClient} from '@tanstack/react-query';
import {ColumnDef} from '@tanstack/react-table';
import {Trash} from 'lucide-react';
import {toast} from 'sonner';
import {DataTableColumnHeader} from '../data-table/column-header';
import {AddTeamRolePopover} from '../popovers/add-team-role-popover';
import {Button} from '../ui/button';
import {RoleCard} from '../ui/role-card';

export const getColumns = ({
  teamId,
}: {
  teamId: string;
}): ColumnDef<GetTeamMembersResponse['members'][number]>[] => {
  const {user} = useAuth();
  if (!user) {
    return [];
  }
  const queryClient = useQueryClient();

  return [
    {
      accessorKey: 'name',
      header: ({column}) => (
        <DataTableColumnHeader column={column} title="Name" />
      ),
    },
    {
      accessorKey: 'username',
      header: ({column}) => (
        <DataTableColumnHeader column={column} title="Email" />
      ),
    },
    {
      accessorKey: 'roles',
      header: 'Roles',
      cell: ({
        row: {
          original: {roles, username},
        },
      }) => (
        <div className="flex flex-wrap gap-1 items-center">
          {roles
            .filter(r => r.hasRole)
            .map(role => (
              <RoleCard
                key={role.role}
                onRemove={
                  username === user.user.id
                    ? undefined
                    : async () => {
                        try {
                          const response = await modifyMemberForTeam({
                            action: 'REMOVE_ROLE',
                            email: username,
                            role: role.role,
                            teamId,
                            user,
                          });

                          if (!response.ok) {
                            console.log('Error removing role', response);
                          }

                          queryClient.invalidateQueries({
                            queryKey: ['teamusers', teamId],
                          });
                        } catch (error) {
                          console.log('Error removing role', error);
                        }
                      }
                }
              >
                {role.role}
              </RoleCard>
            ))}
          {username !== user.user.id && (
            <AddTeamRolePopover
              roles={roles.filter(role => !role.hasRole).map(r => r.role)}
              userId={username}
              teamId={teamId}
            />
          )}
        </div>
      ),
    },
    {
      accessorKey: 'roles',
      header: 'Remove',
      cell: ({
        row: {
          original: {username},
        },
      }) => (
        <div className="flex flex-wrap gap-1 items-center">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild className="w-fit">
                <Button
                  disabled={username === user.user.id}
                  onClick={async () => {
                    try {
                      const response = await modifyMemberForTeam({
                        action: 'REMOVE_USER',
                        email: username,
                        teamId,
                        user,
                      });

                      if (!response.ok) throw new Error(response.statusText);

                      queryClient.invalidateQueries({
                        queryKey: ['teamusers', teamId],
                      });
                    } catch (error) {
                      toast.error('Failed to remove user', {
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
                Removes this user from the team.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      ),
    },
  ];
};
