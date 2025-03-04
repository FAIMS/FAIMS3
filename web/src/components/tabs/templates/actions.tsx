import {ArchiveTemplateDialog} from '@/components/dialogs/archive-template-dialog';
import {EditTemplateDialog} from '@/components/dialogs/edit-template';
import {Card} from '@/components/ui/card';
import {List, ListDescription, ListItem, ListLabel} from '@/components/ui/list';
import {useAuth} from '@/context/auth-provider';
import {useGetTemplates} from '@/hooks/get-hooks';
import {Route} from '@/routes/templates/$templateId';

/**
 * TemplateActions component renders action cards for creating a project from a template,
 * editing the template, and archiving the template.
 *
 * @param {string} templateId - The unique identifier of the template.
 * @returns {JSX.Element} The rendered TemplateActions component.
 */
const TemplateActions = () => {
  const {user} = useAuth();
  const {templateId} = Route.useParams();
  const {data} = useGetTemplates(user, templateId);
  const archived = data?.metadata.project_status === 'archived';

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
          {archived ? (
            <ListItem>
              <ListLabel>Un-archive Template</ListLabel>
              <ListDescription>
                Un-archive the current template.
              </ListDescription>
            </ListItem>
          ) : (
            <ListItem>
              <ListLabel>Archive Template</ListLabel>
              <ListDescription>Archive the current template.</ListDescription>
            </ListItem>
          )}
          <ArchiveTemplateDialog archived={archived} />
        </List>
      </Card>
    </div>
  );
};

export default TemplateActions;
