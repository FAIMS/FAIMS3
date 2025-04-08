import {TeamCellComponent} from '@/components/tables/cells/team-cell';
import {Card} from '@/components/ui/card';
import {List, ListDescription, ListItem, ListLabel} from '@/components/ui/list';
import {Skeleton} from '@/components/ui/skeleton';
import {useAuth} from '@/context/auth-provider';
import {useGetTemplate} from '@/hooks/queries';

const detailsFields = [
  {field: 'name', label: 'Name'},
  {field: 'pre_description', label: 'Description'},
  {field: 'project_lead', label: 'Created by'},
  {field: 'notebook_version', label: 'Version'},

  {
    field: 'ownedByTeamId',
    label: 'Team',
    render: (teamId: string | undefined) => {
      if (!teamId) {
        return 'Not created in a team';
      } else {
        return <TeamCellComponent teamId={teamId} />;
      }
    },
    isMetadata: false,
  },
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
        {detailsFields.map(({field, label, render, isMetadata = true}) => {
          const cellData = isMetadata
            ? data?.metadata[field]
            : (data as any | undefined)?.[field];
          return (
            <ListItem key={field}>
              <ListLabel>{label}</ListLabel>
              {isPending ? (
                <Skeleton />
              ) : (
                <ListDescription>
                  {render ? render(cellData) : cellData}
                </ListDescription>
              )}
            </ListItem>
          );
        })}
      </List>
    </Card>
  );
};

export default TemplateDetails;
