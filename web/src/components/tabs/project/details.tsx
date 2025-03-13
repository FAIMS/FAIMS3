import {useAuth} from '@/context/auth-provider';
import {ListItem, ListLabel, ListDescription} from '@/components/ui/list';
import {Skeleton} from '@/components/ui/skeleton';
import {List} from '@/components/ui/list';
import {Card} from '@/components/ui/card';
import {useGetProject} from '@/hooks/get-hooks';

const detailsFields = [
  {field: 'name', label: 'Name'},
  {field: 'pre_description', label: 'Description'},
  {field: 'project_lead', label: 'Created by'},
  {field: 'lead_institution', label: 'Team'},
  {field: 'notebook_version', label: 'Version'},
] as const;

/**
 * ProjectDetails component renders a list of details for a project.
 * It displays the project name, description, created by, team, and version.
 *
 * @param {string} projectId - The unique identifier of the project.
 * @returns {JSX.Element} The rendered ProjectDetails component.
 */
const ProjectDetails = ({projectId}: {projectId: string}) => {
  const {user} = useAuth();

  const {data, isPending} = useGetProject(user, projectId);

  return (
    <Card>
      <List>
        {detailsFields.map(({field, label}) => (
          <ListItem key={field}>
            <ListLabel>{label}</ListLabel>
            {isPending ? (
              <Skeleton />
            ) : (
              <ListDescription>
                {data?.metadata[field] as string}
              </ListDescription>
            )}
          </ListItem>
        ))}
      </List>
    </Card>
  );
};

export default ProjectDetails;
