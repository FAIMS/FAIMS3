import {DataTable} from '@/components/data-table/data-table';
import {CreateProjectInvite} from '@/components/dialogs/create-project-invite';
import {columns} from '@/components/tables/project-invites';
import {useAuth} from '@/context/auth-provider';
import {useGetInvites} from '@/hooks/get-hooks';

/**
 * ProjectInvites component renders a table of invites for a project.
 * It displays the project name, email, and role for each invite.
 *
 * @param {string} projectId - The unique identifier of the project.
 * @returns {JSX.Element} The rendered ProjectInvites component.
 */
const ProjectInvites = ({projectId}: {projectId: string}) => {
  const {user} = useAuth();

  const {data, isLoading} = useGetInvites(user, projectId);

  return (
    <DataTable
      columns={columns}
      data={data}
      loading={isLoading}
      button={<CreateProjectInvite />}
    />
  );
};

export default ProjectInvites;
