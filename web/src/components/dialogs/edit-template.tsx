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
import {Pencil} from 'lucide-react';

/**
 * EditTemplateDialog component renders a dialog for editing a template.
 * It provides a button to open the dialog and a form to update the template.
 *
 * @returns {JSX.Element} The rendered EditTemplateDialog component.
 */
export const EditTemplateDialog = () => {
  const {user} = useAuth();
  const {templateId} = Route.useParams();
  const {data} = useGetTemplate(user, templateId);
  const [open, setOpen] = useState(false);

  return (
    <div>
      {data?.metadata.project_status === 'archived' ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger className="w-fit">
              <Button variant="outline" disabled={true}>
                Replace Template JSON
                <Pencil />
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
            <Button variant="outline">
              Replace Template JSON
              <Pencil />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Replace Template JSON</DialogTitle>
              <DialogDescription>
                Upload a new template JSON file to replace the current one. new
                file must be a valid JSON file.
              </DialogDescription>
            </DialogHeader>
            <UpdateTemplateForm setDialogOpen={setOpen} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
