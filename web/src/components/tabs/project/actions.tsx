import {Alert, AlertTitle, AlertDescription} from '@/components/ui/alert';
import {Button} from '@/components/ui/button';
import {Card} from '@/components/ui/card';
import {List, ListDescription, ListItem, ListLabel} from '@/components/ui/list';
import {NOTEBOOK_NAME, NOTEBOOK_NAME_CAPITALIZED} from '@/constants';

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
  return (
    <div className="flex flex-col gap-2 justify-between">
      <Card className="flex flex-col gap-4 flex-1">
        <List>
          <ListItem>
            <ListLabel>Edit {NOTEBOOK_NAME_CAPITALIZED}</ListLabel>
            <ListDescription>Current Responses: 203</ListDescription>
          </ListItem>
          <ListItem>
            <Alert variant="destructive">
              <AlertTitle>Warning</AlertTitle>
              <AlertDescription>
                Updating the design for a {NOTEBOOK_NAME} with existing
                responses could result in data inconsistencies.
              </AlertDescription>
            </Alert>
          </ListItem>
          <ListItem>
            <Button variant="destructive">Edit {NOTEBOOK_NAME} Design</Button>
          </ListItem>
        </List>
      </Card>
      <Card className="flex flex-col gap-4 flex-1">
        <List className="flex flex-col justify-between h-full">
          <ListItem>
            <ListLabel>Close {NOTEBOOK_NAME_CAPITALIZED}</ListLabel>
            <ListDescription>Current Status: Active</ListDescription>
          </ListItem>
          <ListItem>
            <Alert variant="destructive">
              <AlertTitle>Warning</AlertTitle>
              <AlertDescription>
                Closing a {NOTEBOOK_NAME} prevents new responses from being
                added to it.
              </AlertDescription>
            </Alert>
          </ListItem>
          <Button variant="destructive">
            Close {NOTEBOOK_NAME_CAPITALIZED}
          </Button>
        </List>
      </Card>
    </div>
  );
};

export default ProjectActions;
