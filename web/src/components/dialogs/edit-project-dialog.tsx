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
import {config} from '@/constants';

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
          Replace {config.notebookNameCapitalized} File
          <Pencil />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Replace Project File</DialogTitle>
          <DialogDescription>
            Upload a JSON file with top-level metadata and uiSpec (same shape as
            Download JSON). This replaces the {config.notebookName} design only;
            it does not change title, description, or team.
          </DialogDescription>
        </DialogHeader>
        <UpdateProjectForm setDialogOpen={setOpen} onSuccess={onSuccess} />
      </DialogContent>
    </Dialog>
  );
};
