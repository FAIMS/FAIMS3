import {DataTable} from '@/components/data-table/data-table';
import {CreateTeamInvite} from '@/components/dialogs/teams/create-team-invite';
import {useGetTeamInviteColumns} from '@/components/tables/team-invites';
import { WEB_URL } from '@/constants';
import {useAuth} from '@/context/auth-provider';
import {useIsAuthorisedTo} from '@/hooks/auth-hooks';
import {useGetTeamInvites} from '@/hooks/queries';
import {removeInviteForTeam} from '@/hooks/teams-hooks';
import {Action} from '@faims3/data-model';
import {ErrorComponent} from '@tanstack/react-router';

/**
 * ProjectInvites component renders a table of invites for a project.
 * It displays the project name, email, and role for each invite.
 *
 * @param {string} projectId - The unique identifier of the project.
 * @returns {JSX.Element} The rendered ProjectInvites component.
 */
const TeamInvites = ({teamId}: {teamId: string}) => {
  const {user} = useAuth();
  if (!user) {
    return <ErrorComponent error="Not authenticated" />;
  }

  const {data, isLoading} = useGetTeamInvites({
    user,
    teamId,
    redirect: `${WEB_URL}/teams/${teamId}`,
  });

  const columns = useGetTeamInviteColumns({
    teamId,
    deleteInviteHandler: async inviteId => {
      return await removeInviteForTeam({teamId, inviteId, user});
    },
  });

  // can we add a user to the team?
  const canInviteMemberToTeam = useIsAuthorisedTo({
    action: Action.CREATE_MEMBER_TEAM_INVITE,
    resourceId: teamId,
  });
  const canInviteManagerToTeam = useIsAuthorisedTo({
    action: Action.CREATE_MANAGER_TEAM_INVITE,
    resourceId: teamId,
  });
  const canInviteAdminToTeam = useIsAuthorisedTo({
    action: Action.CREATE_ADMIN_TEAM_INVITE,
    resourceId: teamId,
  });
  const canAddSomeUser =
    canInviteAdminToTeam || canInviteManagerToTeam || canInviteMemberToTeam;

  return (
    <DataTable
      columns={columns}
      data={data || []}
      loading={isLoading}
      button={canAddSomeUser && <CreateTeamInvite teamId={teamId} />}
    />
  );
};

export default TeamInvites;
