import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {Button} from '../ui/button';
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
export const EditTemplateDialog = ({onSuccess}: {onSuccess: () => void}) => {
  const {user} = useAuth();
  const {templateId} = Route.useParams();
  const {data} = useGetTemplate({user, templateId});
  const [open, setOpen] = useState(false);

  return (
    <div>
      {data?.archived === true ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger className="w-fit">
              <Button variant="outline" disabled={true}>
                Replace Template JSON or XLSForm
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
              Replace Template
              <Pencil />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Replace Template</DialogTitle>
              <DialogDescription>
                Upload a JSON file with top-level metadata and uiSpec (same
                shape as Download JSON), or an XLSForm (.xlsx). This replaces
                the template design only; it does not change title, description,
                or team.
              </DialogDescription>
            </DialogHeader>
            <UpdateTemplateForm setDialogOpen={setOpen} onSuccess={onSuccess} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
