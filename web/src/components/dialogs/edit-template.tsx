import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {Button} from '../ui/button';
import {List, ListDescription, ListItem} from '../ui/list';
import {Route} from '@/routes/templates/$templateId';
import {useAuth} from '@/context/auth-provider';
import {useGetTemplates} from '@/hooks/get-hooks';
import {UpdateTemplateForm} from '../forms/update-template-form';
import {useState} from 'react';

/**
 * EditTemplateDialog component renders a dialog for editing a template.
 * It provides a button to open the dialog and a form to update the template.
 *
 * @returns {JSX.Element} The rendered EditTemplateDialog component.
 */
export const EditTemplateDialog = () => {
  const {user} = useAuth();
  const {templateId} = Route.useParams();

  const {data} = useGetTemplates(user, templateId);

  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild className="w-fit">
        <Button variant="outline">Edit Template</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Template</DialogTitle>
          <DialogDescription>
            Follow the following steps to edit the current template.
          </DialogDescription>
        </DialogHeader>
        <List>
          <ListItem className="space-y-2">
            <ListDescription>1. Download the template file.</ListDescription>
            <Button variant="outline">
              <a
                href={`data:text/json;charset=utf-8,${encodeURIComponent(
                  JSON.stringify(data)
                )}`}
                download={`${templateId}.json`}
              >
                Download
              </a>
            </Button>
          </ListItem>
          <ListItem>
            <ListDescription>
              2. Edit the template either using a text editor or uploading the
              template file to{' '}
              <a
                className="underline text-primary"
                href={import.meta.env.VITE_DESIGNER_URL}
                target="_blank"
                rel="noreferrer"
              >
                Fieldmark Designer
              </a>
              .
            </ListDescription>
          </ListItem>
          <ListItem className="space-y-2">
            <ListDescription>
              3. Upload the edited template file.
            </ListDescription>
            <UpdateTemplateForm setDialogOpen={setOpen} />
          </ListItem>
        </List>
      </DialogContent>
    </Dialog>
  );
};
