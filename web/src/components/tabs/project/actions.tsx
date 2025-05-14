import {Button} from '@/components/ui/button';
import {EditProjectDialog} from '@/components/dialogs/edit-project-dialog';
import {Card} from '@/components/ui/card';
import {List, ListDescription, ListItem, ListLabel} from '@/components/ui/list';
import {NOTEBOOK_NAME, NOTEBOOK_NAME_CAPITALIZED} from '@/constants';
import {useAuth} from '@/context/auth-provider';
import {useGetProject} from '@/hooks/queries';
import {Route} from '@/routes/_protected/projects/$projectId';
import {ProjectStatusDialog} from '@/components/dialogs/change-project-status-dialog';
import {useIsAuthorisedTo} from '@/hooks/auth-hooks';
import {Action} from '@faims3/data-model';

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
  const {data} = useGetProject({user, projectId});

  // Permissions
  const canChangeProjectStatus = useIsAuthorisedTo({
    action: Action.CHANGE_PROJECT_STATUS,
    resourceId: projectId,
  });

  return (
    <div className="flex flex-col gap-2 justify-between">
      <Card className="flex-1">
        <List className="flex flex-col gap-4">
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
                  JSON.stringify({
                    'ui-specification': data?.['ui-specification'],
                    metadata: data?.metadata,
                  })
                )}`}
                download={`${projectId}.json`}
              >
                Download JSON
              </a>
            </Button>
          </ListItem>
        </List>
      </Card>
      <Card className="flex-1">
        <List className="flex flex-col gap-4">
          <ListItem>
            <ListLabel>Replace Project</ListLabel>
            <ListDescription>Replace the JSON project file.</ListDescription>
          </ListItem>
          <ListItem>
            <EditProjectDialog />
          </ListItem>
        </List>
      </Card>
      {canChangeProjectStatus && (
        <Card className="flex-1">
          <ProjectStatusDialog projectId={projectId} />
        </Card>
      )}
    </div>
  );
};

export default ProjectActions;
