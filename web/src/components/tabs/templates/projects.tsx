// SPDX-License-Identifier: Apache-2.0
import {useAuth} from '@/context/auth-provider';
import {columns} from '@/components/tables/projects';
import {DataTable} from '@/components/data-table/data-table';
import {useNavigate} from '@tanstack/react-router';
import {usePagedProjects} from '@/hooks/queries';
import {ProjectFromTemplateDialog} from '@/components/dialogs/project-from-template';

/**
 * TemplateProjects component renders a table of projects for a template.
 * It displays the project name, description, and status for each project.
 *
 * @param {string} templateId - The unique identifier of the template.
 * @returns {JSX.Element} The rendered TemplateProjects component.
 */
const TemplateProjects = ({templateId}: {templateId: string}) => {
  const {user} = useAuth();
  const {tableLoading, notebooks, pageSize, serverPagination, serverSearch} =
    usePagedProjects({user, templateId});
  const navigate = useNavigate();

  return (
    <DataTable
      columns={columns}
      data={notebooks}
      button={<ProjectFromTemplateDialog />}
      loading={tableLoading}
      defaultRowsPerPage={pageSize}
      serverPagination={serverPagination}
      serverSearch={serverSearch}
      onRowClick={({_id}) => navigate({to: `/projects/${_id}`})}
    />
  );
};

export default TemplateProjects;
