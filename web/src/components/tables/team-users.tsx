import {useAuth} from '@/context/auth-provider';
import {modifyMemberForTeam} from '@/hooks/teams-hooks';
import {
  Action,
  GetTeamMembersResponse,
  Role,
  roleDetails,
} from '@faims3/data-model';
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
import {useIsAuthorisedTo} from '@/hooks/auth-hooks';

export const useGetColumns = ({
  teamId,
}: {
  teamId: string;
}): ColumnDef<GetTeamMembersResponse['members'][number]>[] => {
  const {user} = useAuth();
  if (!user) {
    return [];
  }
  const queryClient = useQueryClient();

  const canRemoveAdmin = useIsAuthorisedTo({
    action: Action.REMOVE_ADMIN_FROM_TEAM,
    resourceId: teamId,
  });
  const canRemoveManager = useIsAuthorisedTo({
    action: Action.REMOVE_MANAGER_FROM_TEAM,
    resourceId: teamId,
  });
  const canRemoveMember = useIsAuthorisedTo({
    action: Action.REMOVE_MEMBER_FROM_TEAM,
    resourceId: teamId,
  });

  const canAddMemberToTeam = useIsAuthorisedTo({
    action: Action.ADD_MEMBER_TO_TEAM,
    resourceId: teamId,
  });
  const canAddManagerToTeam = useIsAuthorisedTo({
    action: Action.ADD_MANAGER_TO_TEAM,
    resourceId: teamId,
  });
  const canAddAdminToTeam = useIsAuthorisedTo({
    action: Action.ADD_ADMIN_TO_TEAM,
    resourceId: teamId,
  });

  const rolesAvailable: Role[] = [];
  if (canAddMemberToTeam) {
    rolesAvailable.push(Role.TEAM_MEMBER);
    rolesAvailable.push(Role.TEAM_MEMBER_CREATOR);
  }
  if (canAddManagerToTeam) {
    rolesAvailable.push(Role.TEAM_MANAGER);
  }
  if (canAddAdminToTeam) {
    rolesAvailable.push(Role.TEAM_ADMIN);
  }

  const canRemoveSomeUser =
    canRemoveAdmin || canRemoveManager || canRemoveMember;

  const canRemoveUser = (
    roles: GetTeamMembersResponse['members'][number]['roles']
  ): boolean => {
    const hasRoles = roles.filter(({hasRole}) => hasRole).map(r => r.role);
    if (hasRoles.includes(Role.TEAM_ADMIN)) {
      return canRemoveAdmin;
    }
    if (hasRoles.includes(Role.TEAM_MANAGER)) {
      return canRemoveManager;
    }
    if (hasRoles.includes(Role.TEAM_MEMBER)) {
      return canRemoveMember;
    }
    if (hasRoles.includes(Role.TEAM_MEMBER_CREATOR)) {
      return canRemoveMember;
    }

    // Weird case here
    console.warn(
      'In the remove column of the user table, we encountered a user in the table who has no known team role. This means this function has likely not been updated to accommodate new roles. Behaviour may be unpredictable.'
    );
    return true;
  };

  const roleDisplayName = (role: Role) => {
    return roleDetails[role].name;
  };

  const baseColumns: ColumnDef<GetTeamMembersResponse['members'][number]>[] = [
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
      id: 'manage-roles',
      header: 'Roles',
      cell: ({
        row: {
          original: {roles, username},
        },
      }) => {
        console.log('roles for ', username, roles);
        return (
          <div
            className="flex flex-wrap gap-1 items-center"
            key={username + 'roles'}
          >
            {roles
              .filter(r => r.hasRole)
              .map(role => {
                // check if we can remove this role from this user
                const canRemove = canRemoveUser([role]);
                return (
                  <RoleCard
                    key={username + role.role}
                    onRemove={
                      username === user.user.id || !canRemove
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
                    {roleDisplayName(role.role)}
                  </RoleCard>
                );
              })}
            {username !== user.user.id && (
              <AddTeamRolePopover
                roles={roles
                  .filter(role => !role.hasRole)
                  .map(r => r.role)
                  .filter(r => rolesAvailable.includes(r))}
                userId={username}
                teamId={teamId}
                key={username + 'add'}
              />
            )}
          </div>
        );
      },
    },
  ];
  if (canRemoveSomeUser) {
    baseColumns.push({
      accessorKey: 'roles',
      header: 'Remove',
      id: 'remove-roles',
      cell: ({
        row: {
          original: {username, roles},
        },
      }) => {
        const canRemove = canRemoveUser(roles);
        return (
          <div
            className="flex flex-wrap gap-1 items-center"
            key={username + 'remove'}
          >
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild className="w-fit">
                  <Button
                    disabled={username === user.user.id || !canRemove}
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
                  {username === user.user.id
                    ? 'You cannot remove yourself from this team.'
                    : !canRemove
                      ? 'You are not authorised to remove this user from the team'
                      : 'Removes this user from the team.'}
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
