import {Button} from '@/components/ui/button';
import {Card} from '@/components/ui/card';
import {List, ListDescription, ListItem, ListLabel} from '@/components/ui/list';
import {NOTEBOOK_NAME_CAPITALIZED} from '@/constants';
import {useAuth} from '@/context/auth-provider';
import {useGetProjects} from '@/hooks/get-hooks';
import {Route} from '@/routes/projects/$projectId';

/**
 * ProjectActions component renders action cards for editing and closing a project.
 * It provides options to edit the project design and close the project, along with
 * relevant warnings and descriptions.
 *
 * @param {ProjectActionsProps} props - The properties object.
 * @param {string} props.projectId - The unique identifier of the project.
 * @returns {JSX.Element} The rendered ProjectActions component.
 */
const ProjectActions = (): JSX.Element => {
  const {user} = useAuth();
  const {projectId} = Route.useParams();
  const {data} = useGetProjects(user, projectId);

  return (
    <div className="flex flex-col gap-2 justify-between">
      <Card className="flex flex-col gap-4 flex-1">
        <List>
          <ListItem>
            <ListLabel>Download JSON</ListLabel>
            <ListDescription>
              Download the JSON file for this {NOTEBOOK_NAME_CAPITALIZED}.
            </ListDescription>
          </ListItem>
          <ListItem>
            <Button variant="outline">
              <a
                href={`data:text/json;charset=utf-8,${encodeURIComponent(
                  JSON.stringify(data)
                )}`}
                download={`${projectId}.json`}
              >
                Download JSON
              </a>
            </Button>
          </ListItem>
        </List>
      </Card>
    </div>
  );
};

export default ProjectActions;
