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

interface TemplateDetailsProps {
  templateId: string;
}

const TemplateDetails = ({templateId}: TemplateDetailsProps) => {
  const {user} = useAuth();

  const {data, isPending, error} = useQuery({
    queryKey: ['template', templateId],
    queryFn: () => user && get(`/api/templates/${templateId}`, user),
  });

  console.log(data);

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

export default TemplateDetails;
