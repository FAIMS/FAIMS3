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
import {UpdateProjectForm} from '../forms/update-project-form';
import {Pencil} from 'lucide-react';
import {NOTEBOOK_NAME, NOTEBOOK_NAME_CAPITALIZED} from '@/constants';

/**
 * EditProjectDialog component renders a dialog for editing a project.
 * It provides a button to open the dialog and a form to update the project.
 *
 * The onSuccess callback is called after a successful update.
 *
 * @returns {JSX.Element} The rendered EditProjectDialog component.
 */
export const EditProjectDialog = ({onSuccess}: {onSuccess: () => void}) => {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild className="w-fit">
        <Button variant="outline">
          Replace {NOTEBOOK_NAME_CAPITALIZED} File
          <Pencil />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Replace Project File</DialogTitle>
          <DialogDescription>
            Upload a new {NOTEBOOK_NAME} file to replace the current one. The
            new file must be a valid JSON file.
          </DialogDescription>
        </DialogHeader>
        <UpdateProjectForm setDialogOpen={setOpen} onSuccess={onSuccess} />
      </DialogContent>
    </Dialog>
  );
};
