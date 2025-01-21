import {useAuth} from '@/auth';
import {ListItem, ListLabel, ListDescription} from '@/components/ui/list';
import {Skeleton} from '@/components/ui/skeleton';
import {useQuery} from '@tanstack/react-query';
import {get} from '@/lib/utils';
import {List} from '@/components/ui/list';
import {Card} from '@/components/ui/card';

const detailsFields = [
  {field: 'name', label: 'Name'},
  {field: 'pre_description', label: 'Description'},
  {field: 'project_lead', label: 'Created by'},
  {field: 'lead_institution', label: 'Team'},
  {field: 'notebook_version', label: 'Version'},
];

const SurveyDetails = ({surveyId}: {surveyId: string}) => {
  const {user} = useAuth();

  const {data, isPending, error} = useQuery({
    queryKey: ['survey', surveyId],
    queryFn: () => user && get(`/api/notebooks/${surveyId}`, user),
  });

  if (error) return 'An error has occurred: ' + error.message;

  return (
    <Card>
      <List>
        {detailsFields.map(({field, label}) => (
          <ListItem key={field}>
            <ListLabel>{label}</ListLabel>
            {isPending ? (
              <Skeleton />
            ) : (
              <ListDescription>{data.metadata[field]}</ListDescription>
            )}
          </ListItem>
        ))}
      </List>
    </Card>
  );
};

export default SurveyDetails;
