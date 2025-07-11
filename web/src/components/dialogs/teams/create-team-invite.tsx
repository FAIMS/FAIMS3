import {CreateTeamInviteForm} from '@/components/forms/teams/create-team-invite-form';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {Plus} from 'lucide-react';
import {useState} from 'react';
import {Button} from '../../ui/button';

/**
 * Component for rendering a dialog to create a new project from a template.
 * @returns {JSX.Element} The rendered dialog component.
 */
export const CreateTeamInvite = ({teamId}: {teamId: string}) => {
  const [open, setOpen] = useState(false);

  return (
    // modal is false here because of a bug in radix-ui that leads to
    // an infinite recursion in Firefox when the select control in the form
    // is clicked.
    <Dialog open={open} onOpenChange={setOpen} modal={false}>
      <DialogTrigger asChild className="w-fit">
        <Button
          variant="outline"
          className="bg-primary text-primary-foreground"
        >
          <Plus />
          Create Team Invite
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Team Invite</DialogTitle>
          <DialogDescription>
            Create a new invitation for this team.
          </DialogDescription>
        </DialogHeader>
        <CreateTeamInviteForm setDialogOpen={setOpen} teamId={teamId} />
      </DialogContent>
    </Dialog>
  );
};
