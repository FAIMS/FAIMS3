import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {Button} from '../ui/button';
import {CreateProjectFromTemplateForm} from '../forms/create-project-from-template';
import {NOTEBOOK_NAME, NOTEBOOK_NAME_CAPITALIZED} from '@/constants';
import {useState} from 'react';
import {useAuth} from '@/context/auth-provider';
import {Route} from '@/routes/templates/$templateId';
import {useGetTemplates} from '@/hooks/get-hooks';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';

/**
 * Component for rendering a dialog to create a new project from a template.
 * @returns {JSX.Element} The rendered dialog component.
 */
export const ProjectFromTemplateDialog = () => {
  const {user} = useAuth();
  const {templateId} = Route.useParams();
  const {data} = useGetTemplates(user, templateId);
  const [open, setOpen] = useState(false);
  const archived = data?.metadata.project_status === 'archived';

  return archived ? (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <Button
            variant="outline"
            disabled={data?.metadata.project_status === 'archived'}
          >
            Create {NOTEBOOK_NAME_CAPITALIZED}
          </Button>
        </TooltipTrigger>
        <TooltipContent className="w-32 text-balance">
          Unable to create a project from an archived template.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ) : (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild className="w-fit">
        <Button
          variant="outline"
          disabled={data?.metadata.project_status === 'archived'}
        >
          Create {NOTEBOOK_NAME_CAPITALIZED}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create {NOTEBOOK_NAME_CAPITALIZED}</DialogTitle>
          <DialogDescription>
            Create a new {NOTEBOOK_NAME} based on this template.
          </DialogDescription>
        </DialogHeader>
        <CreateProjectFromTemplateForm setDialogOpen={setOpen} />
      </DialogContent>
    </Dialog>
  );
};
