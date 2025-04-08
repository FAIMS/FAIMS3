import {useAuth} from '@/context/auth-provider';
import {ListItem, ListLabel, ListDescription} from '@/components/ui/list';
import {Skeleton} from '@/components/ui/skeleton';
import {List} from '@/components/ui/list';
import {Card} from '@/components/ui/card';
import {useGetProjects} from '@/hooks/get-hooks';
import {TeamCellComponent} from '@/components/tables/cells/team-cell';

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

/**
 * ProjectDetails component renders a list of details for a project.
 * It displays the project name, description, created by, team, and version.
 *
 * @param {string} projectId - The unique identifier of the project.
 * @returns {JSX.Element} The rendered ProjectDetails component.
 */
const ProjectDetails = ({projectId}: {projectId: string}) => {
  const {user} = useAuth();

  const {data, isPending} = useGetProjects(user, projectId);

  return (
    <Card>
      <List>
        {detailsFields.map(({field, label, render, isMetadata = true}) => {
          const cellData = isMetadata ? data?.metadata[field] : data?.[field];
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

export default ProjectDetails;
