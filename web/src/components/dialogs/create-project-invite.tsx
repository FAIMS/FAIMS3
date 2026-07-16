import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {Button} from '../ui/button';
import {config} from '@/constants';
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
          data-testid="web-project-invite-create-button"
        >
          <Plus />
          Create Invite
        </Button>
      </DialogTrigger>
      <DialogContent data-testid="web-project-invite-create-dialog">
        <DialogHeader>
          <DialogTitle>Create Invite</DialogTitle>
          <DialogDescription>
            Create a new invitation for this {config.notebookName}.
          </DialogDescription>
        </DialogHeader>
        <CreateProjectInviteForm setDialogOpen={setOpen} />
      </DialogContent>
    </Dialog>
  );
};
