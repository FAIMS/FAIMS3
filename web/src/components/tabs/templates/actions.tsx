import {EditTemplateDialog} from '@/components/dialogs/edit-template';
import {ProjectFromTemplateDialog} from '@/components/dialogs/project-from-template';
import {Button} from '@/components/ui/button';
import {Card} from '@/components/ui/card';
import {List, ListDescription, ListItem, ListLabel} from '@/components/ui/list';
import {NOTEBOOK_NAME, NOTEBOOK_NAME_CAPITALIZED} from '@/constants';
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

  return (
    <div className="flex flex-col gap-2 justify-between">
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
                  JSON.stringify(data)
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
          <ProjectFromTemplateDialog />
        </List>
      </Card>
      <Card>
        <List>
          <ListItem>
            <ListLabel>Edit Template</ListLabel>
            <ListDescription>Edit the current template.</ListDescription>
          </ListItem>
          <EditTemplateDialog />
        </List>
      </Card>
    </div>
  );
};

export default TemplateActions;
