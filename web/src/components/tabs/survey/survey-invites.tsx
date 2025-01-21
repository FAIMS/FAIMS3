import {useAuth} from '@/auth';
import {DataTable} from '@/components/ui/data-table/data-table';
import {columns} from '@/components/tables/survey-invites';

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
