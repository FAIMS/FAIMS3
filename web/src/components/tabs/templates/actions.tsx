import {ArchiveTemplateDialog} from '@/components/dialogs/archive-template-dialog';
import {EditTemplateDialog} from '@/components/dialogs/edit-template';
import {List, ListDescription, ListItem, ListLabel} from '@/components/ui/list';
import {NOTEBOOK_NAME, NOTEBOOK_NAME_CAPITALIZED} from '@/constants';
import {ProjectFromTemplateDialog} from '@/components/dialogs/project-from-template';
import {Button} from '@/components/ui/button';
import {Card} from '@/components/ui/card';
import {useAuth} from '@/context/auth-provider';
import {useGetTemplates} from '@/hooks/get-hooks';
import {Route} from '@/routes/_protected/templates/$templateId';

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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 justify-between">
      <Card>
        <List>
          <ListItem>
            <ListLabel>Download JSON</ListLabel>
            <ListDescription>
              Download the JSON file for this template.
            </ListDescription>
          </ListItem>
          <ListItem>
            <Button variant="outline">
              <a
                href={`data:text/json;charset=utf-8,${encodeURIComponent(
                  JSON.stringify({
                    metadata: data?.metadata,
                    'ui-specification': data?.['ui-specification'],
                  })
                )}`}
                download={`${templateId}.json`}
              >
                Download JSON
              </a>
            </Button>
          </ListItem>
        </List>
      </Card>
      <Card>
        <List>
          <ListItem>
            <ListLabel>Create {NOTEBOOK_NAME_CAPITALIZED}</ListLabel>
            <ListDescription>
              Create a new {NOTEBOOK_NAME} based on this template.
            </ListDescription>
          </ListItem>
          <ListItem>
            <ProjectFromTemplateDialog />
          </ListItem>
        </List>
      </Card>
      <Card>
        <List>
          <ListItem>
            <ListLabel>Edit Template</ListLabel>
            <ListDescription>Edit the current template.</ListDescription>
          </ListItem>
          <ListItem>
            <EditTemplateDialog />
          </ListItem>
        </List>
      </Card>
      <Card>
        <List>
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
