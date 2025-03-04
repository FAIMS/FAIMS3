import {EditProjectDialog} from '@/components/dialogs/edit-project-dialog';
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
      <Card className="flex-1">
        <List className="flex flex-col gap-4">
          <ListItem>
            <ListLabel>Edit {NOTEBOOK_NAME_CAPITALIZED}</ListLabel>
            <ListDescription>Edit the current {NOTEBOOK_NAME}.</ListDescription>
          </ListItem>
          <EditProjectDialog />
        </List>
      </Card>
    </div>
  );
};

export default ProjectActions;
