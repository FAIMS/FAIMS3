import {useAuth} from '@/auth';
import {columns} from '@/components/tables/surveys';
import {DataTable} from '@/components/data-table/data-table';
import {get} from '@/lib/utils';
import {useQuery} from '@tanstack/react-query';
import {useNavigate} from '@tanstack/react-router';

/**
 * TemplateSurveys component renders a table of surveys for a template.
 * It displays the survey name, description, and status for each survey.
 *
 * @param {string} templateId - The unique identifier of the template.
 * @returns {JSX.Element} The rendered TemplateSurveys component.
 */
const TemplateSurveys = ({templateId}: {templateId: string}) => {
  const {user} = useAuth();

  if (!user) return <></>;

  const {isPending, error, data} = useQuery({
    queryKey: ['surveys'],
    queryFn: () => get('/api/notebooks', user),
  });

  const navigate = useNavigate();

  if (error) return 'An error has occurred: ' + error.message;

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
