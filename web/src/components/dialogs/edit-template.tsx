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
import {Route} from '@/routes/_protected/templates/$templateId';
import {useAuth} from '@/context/auth-provider';
import {useGetTemplate} from '@/hooks/queries';
import {UpdateTemplateForm} from '../forms/update-template-form';
import {useState} from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';

/**
 * EditTemplateDialog component renders a dialog for editing a template.
 * It provides a button to open the dialog and a form to update the template.
 *
 * @returns {JSX.Element} The rendered EditTemplateDialog component.
 */
export const EditTemplateDialog = () => {
  const {user} = useAuth();
  const {templateId} = Route.useParams();
  const {data, isLoading} = useGetTemplate(user, templateId);
  const [open, setOpen] = useState(false);

  return (
    <div>
      {data?.metadata.project_status === 'archived' ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger className="w-fit">
              <Button variant="outline" disabled={true}>
                Edit Template
              </Button>
            </TooltipTrigger>
            <TooltipContent className="w-32 text-balance">
              Unable to edit an archived template.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
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
                <ListDescription>
                  1. Download the template file.
                </ListDescription>
                <Button variant="outline" disabled={isLoading}>
                  <a
                    href={`data:text/json;charset=utf-8,${encodeURIComponent(
                      JSON.stringify({
                        metadata: data?.metadata,
                        'ui-specification': data?.['ui-specification'],
                      })
                    )}`}
                    download={`${templateId}.json`}
                  >
                    Download
                  </a>
                </Button>
              </ListItem>
              <ListItem>
                {
                  //TODO Update this view to link directly into designer
                }
                <ListDescription>
                  2. Edit the template using Designer.
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
      )}
    </div>
  );
};
