import {EditTemplateDialog} from '@/components/dialogs/edit-template';
import {ProjectFromTemplateDialog} from '@/components/dialogs/project-from-template';
import {Alert, AlertTitle, AlertDescription} from '@/components/ui/alert';
import {Button} from '@/components/ui/button';
import {Card} from '@/components/ui/card';
import {List, ListDescription, ListItem, ListLabel} from '@/components/ui/list';
import {NOTEBOOK_NAME, NOTEBOOK_NAME_CAPITALIZED} from '@/constants';

/**
 * TemplateActions component renders action cards for creating a project from a template,
 * editing the template, and archiving the template.
 *
 * @param {string} templateId - The unique identifier of the template.
 * @returns {JSX.Element} The rendered TemplateActions component.
 */
const TemplateActions = () => {
  return (
    <div className="flex flex-col gap-2 justify-between">
      <Card className="flex-1">
        <List className="flex flex-col gap-4">
          <ListItem>
            <ListLabel>Create {NOTEBOOK_NAME_CAPITALIZED}</ListLabel>
            <ListDescription>
              Create a new {NOTEBOOK_NAME} based on this template.
            </ListDescription>
          </ListItem>
          <ProjectFromTemplateDialog />
        </List>
      </Card>
      <Card className="flex-1">
        <List className="flex flex-col gap-4">
          <ListItem>
            <ListLabel>Edit Template</ListLabel>
            <ListDescription>Edit the current template.</ListDescription>
          </ListItem>
          <EditTemplateDialog />
        </List>
      </Card>
      <Card className="flex flex-col gap-4 flex-1">
        <List className="flex flex-col justify-between h-full">
          <ListItem>
            <ListLabel>Archive Template</ListLabel>
            <ListDescription>Archive the current template.</ListDescription>
          </ListItem>
          <ListItem>
            <Alert variant="destructive">
              <AlertTitle>Warning</AlertTitle>
              <AlertDescription>
                Archiving the template will prevent {NOTEBOOK_NAME}s from being
                created from it.
              </AlertDescription>
            </Alert>
          </ListItem>
          <Button variant="destructive">Archive Template</Button>
        </List>
      </Card>
    </div>
  );
};

export default TemplateActions;
