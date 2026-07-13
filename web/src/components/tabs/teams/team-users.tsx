import {DataTable} from '@/components/data-table/data-table';
import {AddTeamUserDialog} from '@/components/dialogs/teams/add-team-user-dialog';
import {useGetColumns} from '@/components/tables/team-users';
import {useIsAuthorisedTo, useRequiredUser} from '@/hooks/auth-hooks';
import {useGetUsersForTeam} from '@/hooks/queries';
import {Action} from '@faims3/data-model';
import {LoaderCircle, Plus} from 'lucide-react';

const TeamUsers = ({teamId}: {teamId: string}) => {
  const user = useRequiredUser();

  const {isLoading, data} = useGetUsersForTeam({user, teamId});

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

  const columns = useGetColumns({teamId});

  const canAddSomeUser =
    canAddAdminToTeam || canAddManagerToTeam || canAddMemberToTeam;

  return (
    <div>
      {isLoading ? (
        <LoaderCircle />
      ) : (
        <DataTable
          columns={columns}
          data={data?.members || []}
          loading={isLoading}
          button={
            canAddSomeUser && (
              <AddTeamUserDialog
                teamId={teamId}
                buttonContent={
                  <>
                    <Plus />
                    {'Add user'}
                  </>
                }
              />
            )
          }
        />
      )}
    </div>
  );
};

export default TeamUsers;
