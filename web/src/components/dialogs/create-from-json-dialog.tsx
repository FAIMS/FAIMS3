import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {Button} from '../ui/button';
import {useState} from 'react';
import {CreateProjectForm} from '../forms/create-project-form';
import {CreateTemplateForm} from '../forms/create-template-form';
import {capitalize} from '@/lib/utils';

interface CreateFromJSONDialogProps {
  type: 'template' | 'project';
}

/**
 * CreateFromJSONDialog component renders a dialog for creating a project from a template,
 * or a template from a project.
 * It provides a button to open the dialog and a form to create the project or template.
 *
 * @param {CreateFromJSONDialogProps} props - The props for the dialog.
 * @returns {JSX.Element} The rendered CreateFromJSONDialog component.
 */
export const CreateFromJSONDialog = ({type}: CreateFromJSONDialogProps) => {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild className="w-fit">
        <Button variant={'outline'}>Create {capitalize(type)}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create {capitalize(type)}</DialogTitle>
          <DialogDescription>
            Create a new {type} by uploading a JSON {type} file.
          </DialogDescription>
        </DialogHeader>
        {type === 'template' && <CreateTemplateForm setDialogOpen={setOpen} />}
        {type === 'project' && <CreateProjectForm setDialogOpen={setOpen} />}
      </DialogContent>
    </Dialog>
  );
};
