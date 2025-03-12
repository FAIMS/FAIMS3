import {useAuth} from '@/context/auth-provider';
import {useQuery} from '@tanstack/react-query';
import {DataTable} from '@/components/data-table/data-table';
import {columns} from '@/components/tables/project-users';

/**
 * ProjectUsers component renders a table of users for a project.
 * It displays the project name, email, and role for each user.
 *
 * @param {string} projectId - The unique identifier of the project.
 * @returns {JSX.Element} The rendered ProjectUsers component.
 */
const ProjectUsers = ({projectId}: {projectId: string}) => {
  const {user} = useAuth();

  const {data, isPending} = useQuery({
    queryKey: ['project-users', projectId],
    queryFn: async () => {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/users`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${user?.token}`,
          },
        }
      );

      const data = await response.json();

      return data
        .filter((user: any) => user.project_roles[projectId])
        .map((user: any) => ({
          ...user,
          'team-roles': user.other_roles,
          'project-roles': user.project_roles[projectId],
        }));
    },
  });

  return <DataTable columns={columns} data={data || []} loading={isPending} />;
};

export default ProjectUsers;
