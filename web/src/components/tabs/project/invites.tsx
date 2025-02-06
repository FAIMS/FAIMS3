import {DataTable} from '@/components/data-table/data-table';
import {columns} from '@/components/tables/project-invites';

/**
 * ProjectInvites component renders a table of invites for a project.
 * It displays the project name, email, and role for each invite.
 *
 * @param {string} projectId - The unique identifier of the project.
 * @returns {JSX.Element} The rendered ProjectInvites component.
 */
const ProjectInvites = () => {
  return (
    <DataTable
      columns={columns}
      data={[]}
      loading={false}
      onAddClick={() => {}}
    />
  );
};

export default ProjectInvites;
