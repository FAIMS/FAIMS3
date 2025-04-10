import {DataTable} from '@/components/data-table/data-table';
import {CreateProjectInvite} from '@/components/dialogs/create-project-invite';
import {useGetInviteColumns} from '@/components/tables/project-invites';
import {APP_TOKEN_RETURN_PATH, APP_URL, WEB_URL} from '@/constants';
import {useAuth} from '@/context/auth-provider';
import {useIsAuthorisedTo} from '@/hooks/auth-hooks';
import {removeInviteForProject} from '@/hooks/project-hooks';
import {useGetProjectInvites} from '@/hooks/queries';
import {Action} from '@faims3/data-model';
import {ErrorComponent} from '@tanstack/react-router';

/**
 * ProjectInvites component renders a table of invites for a project.
 * It displays the project name, email, and role for each invite.
 *
 * @param {string} projectId - The unique identifier of the project.
 * @returns {JSX.Element} The rendered ProjectInvites component.
 */
const ProjectInvites = ({projectId}: {projectId: string}) => {
  const {user} = useAuth();
  if (!user) {
    return <ErrorComponent error="Not authenticated" />;
  }

  const {data, isLoading} = useGetProjectInvites({
    user,
    projectId,
    // this redirect is designed to bring the user back to the main app logged
    // in
    redirect: APP_TOKEN_RETURN_PATH,
  });

  const columns = useGetInviteColumns({
    projectId,
    deleteInviteHandler: async inviteId => {
      return await removeInviteForProject({inviteId, projectId, user});
    },
  });

  // can we add a user to the team?
  const canInviteGuestToTeam = useIsAuthorisedTo({
    action: Action.CREATE_GUEST_PROJECT_INVITE,
    resourceId: projectId,
  });
  const canInviteContributorToTeam = useIsAuthorisedTo({
    action: Action.CREATE_CONTRIBUTOR_PROJECT_INVITE,
    resourceId: projectId,
  });
  const canInviteManagerToTeam = useIsAuthorisedTo({
    action: Action.CREATE_MANAGER_PROJECT_INVITE,
    resourceId: projectId,
  });
  const canInviteAdminToTeam = useIsAuthorisedTo({
    action: Action.CREATE_ADMIN_PROJECT_INVITE,
    resourceId: projectId,
  });
  const canInviteSomeUser =
    canInviteAdminToTeam ||
    canInviteManagerToTeam ||
    canInviteContributorToTeam ||
    canInviteGuestToTeam;

  return (
    <DataTable
      columns={columns}
      data={data || []}
      loading={isLoading}
      button={canInviteSomeUser && <CreateProjectInvite />}
    />
  );
};

export default ProjectInvites;
