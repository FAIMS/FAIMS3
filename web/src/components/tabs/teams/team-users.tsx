// SPDX-License-Identifier: Apache-2.0
import {DataTable} from '@/components/data-table/data-table';
import {AddTeamUserDialog} from '@/components/dialogs/teams/add-team-user-dialog';
import {useGetColumns} from '@/components/tables/team-users';
import {useIsAuthorisedTo, useRequiredUser} from '@/hooks/auth-hooks';
import {useGetTeam, usePagedTeamMembers} from '@/hooks/queries';
import {Action} from '@faims3/data-model';
import {Plus} from 'lucide-react';

const TeamUsers = ({teamId}: {teamId: string}) => {
  const user = useRequiredUser();

  const {tableLoading, members, pageSize, serverPagination} =
    usePagedTeamMembers({user, teamId});
  const {data: team} = useGetTeam({user, teamId});
  const archived = team?.archived === true;

  // permission checks

  // can we add a user to the team?
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
  const canAddSomeUser =
    canAddAdminToTeam || canAddManagerToTeam || canAddMemberToTeam;

  const columns = useGetColumns({teamId});

  return (
    <DataTable
      columns={columns}
      data={members}
      loading={tableLoading}
      defaultRowsPerPage={pageSize}
      serverPagination={serverPagination}
      button={
        canAddSomeUser &&
        !archived && (
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
  );
};

export default TeamUsers;
