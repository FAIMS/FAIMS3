import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {NOTEBOOK_NAME_CAPITALIZED} from '@/constants';
import {useState} from 'react';
import {CreateTeamForm} from '../../forms/teams/create-team-form';
import {Button} from '../../ui/button';

export const CreateTeamDialog = () => {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild className="w-fit">
        <Button variant={'outline'}>Create Team</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Team</DialogTitle>
          <DialogDescription>
            Create a new team to help manage users and share access to{' '}
            {NOTEBOOK_NAME_CAPITALIZED}s and Templates.
          </DialogDescription>
        </DialogHeader>
        <CreateTeamForm setDialogOpen={setOpen} />
      </DialogContent>
    </Dialog>
  );
};
