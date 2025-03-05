import {useAuth} from '@/context/auth-provider';
import {columns} from '@/components/tables/projects';
import {DataTable} from '@/components/data-table/data-table';
import {useNavigate} from '@tanstack/react-router';
import {useGetProjects} from '@/hooks/get-hooks';
import {NOTEBOOK_NAME} from '@/constants';
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

  const {isPending, data} = useGetProjects(user);

  const navigate = useNavigate();

  return (
    <DataTable
      columns={columns}
      data={data.filter((notebook: any) => notebook.template_id === templateId)}
      button={<ProjectFromTemplateDialog />}
      loading={isPending}
      onRowClick={({project_id}) =>
        navigate({to: `/${NOTEBOOK_NAME}s/${project_id}`})
      }
    />
  );
};

export default TemplateProjects;
