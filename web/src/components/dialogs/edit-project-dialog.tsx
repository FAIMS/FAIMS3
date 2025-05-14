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

/**
 * EditProjectDialog component renders a dialog for editing a project.
 * It provides a button to open the dialog and a form to update the project.
 *
 * @returns {JSX.Element} The rendered EditProjectDialog component.
 */
export const EditProjectDialog = () => {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild className="w-fit">
        <Button variant="outline">
          Replace Project File
          <Pencil />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Replace Project File</DialogTitle>
          <DialogDescription>
            Upload a new project file to replace the current one. The new file
            must be a valid JSON file.
          </DialogDescription>
        </DialogHeader>
        <UpdateProjectForm setDialogOpen={setOpen} />
      </DialogContent>
    </Dialog>
  );
};
