import {ArchiveTemplateDialog} from '@/components/dialogs/archive-template-dialog';
import {EditTemplateDialog} from '@/components/dialogs/edit-template';
import {Card} from '@/components/ui/card';
import {List, ListDescription, ListItem, ListLabel} from '@/components/ui/list';

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
            <ListLabel>Edit Template</ListLabel>
            <ListDescription>Edit the current template.</ListDescription>
          </ListItem>
          <EditTemplateDialog />
        </List>
      </Card>
      <Card className="flex-1">
        <List className="flex flex-col gap-4">
          <ListItem>
            <ListLabel>Archive Template</ListLabel>
            <ListDescription>Archive the current template.</ListDescription>
          </ListItem>
          <ArchiveTemplateDialog />
        </List>
      </Card>
    </div>
  );
};

export default TemplateActions;
