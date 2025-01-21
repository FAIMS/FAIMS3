import {useAuth} from '@/auth';
import {useQuery} from '@tanstack/react-query';
import {get} from '@/lib/utils';
import {DataTable} from '@/components/ui/data-table/data-table';
import {columns} from '@/components/tables/survey-users';

const SurveyUsers = ({surveyId}: {surveyId: string}) => {
  const {user} = useAuth();

  const {data, isPending, error} = useQuery({
    queryKey: ['survey-users', surveyId],
    queryFn: () => user && get(`/api/notebooks/${surveyId}/users`, user),
  });

  return (
    <DataTable
      columns={columns}
      data={
        !data
          ? []
          : data.users.map((user: any) => ({
              ...user,
              'survey-role': user.roles.find((role: any) => role.value)?.name,
            }))
      }
      loading={isPending}
    />
  );
};

export default SurveyUsers;
