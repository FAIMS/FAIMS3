import {useAuth} from '@/auth';
import {useQuery} from '@tanstack/react-query';
import {DataTable} from '@/components/data-table/data-table';
import {columns} from '@/components/tables/survey-users';

/**
 * SurveyUsers component renders a table of users for a survey.
 * It displays the survey name, email, and role for each user.
 *
 * @param {string} surveyId - The unique identifier of the survey.
 * @returns {JSX.Element} The rendered SurveyUsers component.
 */
const SurveyUsers = ({surveyId}: {surveyId: string}) => {
  const {user} = useAuth();

  const {data, isPending} = useQuery({
    queryKey: ['survey-users', surveyId],
    queryFn: async () => {
      if (!user) return [];

      const data = await fetch(
        `http://localhost:8080/api/notebooks/${surveyId}/users`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${user.token}`,
          },
        }
      ).then(response => response.json());

      return data.users.map((user: any) => ({
        ...user,
        'survey-role': user.roles.find((role: any) => role.value)?.name,
      }));
    },
  });

  return <DataTable columns={columns} data={data || []} loading={isPending} />;
};

export default SurveyUsers;
