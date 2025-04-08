import {AddUserToTeamForm} from '@/components/forms/teams/add-user-to-team-form';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {useAuth} from '@/context/auth-provider';
import {ErrorComponent} from '@tanstack/react-router';
import React, {useState} from 'react';
import {Button} from '../../ui/button';

export const AddTeamUserDialog = ({
  teamId,
  buttonContent,
}: {
  teamId: string;
  buttonContent: React.ReactNode;
}) => {
  const {user} = useAuth();
  if (!user) {
    return <ErrorComponent error="Not authenticated." />;
  }

  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button
          variant="outline"
          className="bg-primary text-primary-foreground"
        >
          {buttonContent}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add user to team</DialogTitle>
          <DialogDescription>
            Add users to your team. Please enter the email of the user to add to
            your team, and select a role you would like to grant.
          </DialogDescription>
        </DialogHeader>
        <AddUserToTeamForm setDialogOpen={setOpen} teamId={teamId} />
      </DialogContent>
    </Dialog>
  );
};
