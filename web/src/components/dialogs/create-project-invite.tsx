import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {Button} from '../ui/button';
import {NOTEBOOK_NAME} from '@/constants';
import {CreateProjectInviteForm} from '../forms/create-project-invite';
import {useState} from 'react';
import {Plus} from 'lucide-react';

/**
 * Component for rendering a dialog to create a new project from a template.
 * @returns {JSX.Element} The rendered dialog component.
 */
export const CreateProjectInvite = () => {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild className="w-fit">
        <Button
          variant="outline"
          className="bg-primary text-primary-foreground"
        >
          <Plus />
          Create Invite
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Invite</DialogTitle>
          <DialogDescription>
            Create a new invitation for this {NOTEBOOK_NAME}.
          </DialogDescription>
        </DialogHeader>
        <CreateProjectInviteForm setDialogOpen={setOpen} />
      </DialogContent>
    </Dialog>
  );
};
