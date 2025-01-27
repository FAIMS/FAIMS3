import {useAuth} from '@/auth';
import {DataTable} from '@/components/data-table/data-table';
import {columns} from '@/components/tables/survey-invites';

/**
 * SurveyInvites component renders a table of invites for a survey.
 * It displays the survey name, email, and role for each invite.
 *
 * @param {string} surveyId - The unique identifier of the survey.
 * @returns {JSX.Element} The rendered SurveyInvites component.
 */
const SurveyInvites = ({surveyId}: {surveyId: string}) => {
  const {user} = useAuth();

  return (
    <DataTable
      columns={columns}
      data={[]}
      loading={false}
      onAddClick={() => {}}
    />
  );
};

export default SurveyInvites;
