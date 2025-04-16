import {DataTable} from '@/components/data-table/data-table';
import {columns} from '@/components/tables/project-users';
import {useAuth} from '@/context/auth-provider';
import {useGetUsersForProject} from '@/hooks/queries';

/**
 * ProjectUsers component renders a table of users for a project.
 * It displays the project name, email, and role for each user.
 *
 * @param {string} projectId - The unique identifier of the project.
 * @returns {JSX.Element} The rendered ProjectUsers component.
 */
const ProjectUsers = ({projectId}: {projectId: string}) => {
  const {user} = useAuth();
  const {isLoading, data: projectUsers} = useGetUsersForProject({
    user,
    projectId,
  });

  const tableData = projectUsers?.users.map(user => ({
    ...user,
    projectRoles: user.roles.filter(role => role.value).map(role => role.name),
  }));

  return (
    <DataTable columns={columns} data={tableData || []} loading={isLoading} />
  );
};

export default ProjectUsers;
