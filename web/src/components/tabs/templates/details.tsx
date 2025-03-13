import {useAuth} from '@/context/auth-provider';
import {ListItem, ListLabel, ListDescription} from '@/components/ui/list';
import {Skeleton} from '@/components/ui/skeleton';
import {List} from '@/components/ui/list';
import {Card} from '@/components/ui/card';
import {useGetTemplate} from '@/hooks/queries';

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

/**
 * TemplateDetails component renders a list of details for a template.
 * It displays the template name, description, created by, team, and version.
 *
 * @param {TemplateDetailsProps} props - The properties object.
 * @param {string} props.templateId - The unique identifier of the template.
 * @returns {JSX.Element} The rendered TemplateDetails component.
 */
const TemplateDetails = ({templateId}: TemplateDetailsProps) => {
  const {user} = useAuth();

  const {data, isPending} = useGetTemplate(user, templateId);

  return (
    <Card>
      <List>
        {detailsFields.map(({field, label}) => (
          <ListItem key={field}>
            <ListLabel>{label}</ListLabel>
            {isPending ? (
              <Skeleton />
            ) : (
              <ListDescription>{data?.metadata[field]}</ListDescription>
            )}
          </ListItem>
        ))}
      </List>
    </Card>
  );
};

export default TemplateDetails;
