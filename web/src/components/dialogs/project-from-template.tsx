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

/**
 * Component for rendering a dialog to create a new project from a template.
 * @returns {JSX.Element} The rendered dialog component.
 */
export const ProjectFromTemplateDialog = () => {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild className="w-fit">
        <Button variant="outline">Create {NOTEBOOK_NAME_CAPITALIZED}</Button>
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
