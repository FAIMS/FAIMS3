import {useAuth} from '@/auth';
import {columns} from '@/components/tables/surveys';
import {DataTable} from '@/components/data-table/data-table';
import {useNavigate} from '@tanstack/react-router';
import {useGetSurveys} from '@/lib/queries';

/**
 * TemplateSurveys component renders a table of surveys for a template.
 * It displays the survey name, description, and status for each survey.
 *
 * @param {string} templateId - The unique identifier of the template.
 * @returns {JSX.Element} The rendered TemplateSurveys component.
 */
const TemplateSurveys = ({templateId}: {templateId: string}) => {
  const {user} = useAuth();

  const {isPending, data} = useGetSurveys(user);

  const navigate = useNavigate();

  return (
    <DataTable
      columns={columns}
      data={data.filter((notebook: any) => notebook.template_id === templateId)}
      loading={isPending}
      onRowClick={({non_unique_project_id}) =>
        navigate({to: `/surveys/${non_unique_project_id}`})
      }
    />
  );
};

export default TemplateSurveys;
