import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {useAuth} from '@/context/auth-provider';
import {useGetTeam} from '@/hooks/get-hooks';
import {ErrorComponent} from '@tanstack/react-router';
import {LoaderCircleIcon} from 'lucide-react';
import React, {useState} from 'react';
import {UpdateTeamForm} from '../../forms/teams/update-team-form';
import {Button} from '../../ui/button';

export const UpdateTeamDialog = ({
  teamId,
  buttonContent,
}: {
  teamId: string;
  buttonContent?: React.ReactNode;
}) => {
  const {user} = useAuth();
  if (!user) {
    return <p>Not authenticated...</p>;
  }
  const {data, isLoading, isError} = useGetTeam(user, teamId);
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild className="w-fit">
        <Button
          variant="outline"
          className="bg-primary text-primary-foreground"
        >
          {buttonContent ?? 'Update Team'}
        </Button>
      </DialogTrigger>
      <DialogContent>
        {isLoading ? (
          <LoaderCircleIcon />
        ) : isError ? (
          <ErrorComponent
            error={'Failed to fetch team details. Cannot update.'}
          />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Update Team</DialogTitle>
              <DialogDescription>
                Update the details of your existing team.
              </DialogDescription>
            </DialogHeader>
            {data && (
              <UpdateTeamForm
                description={data.description}
                name={data.name}
                teamId={teamId}
                setDialogOpen={setOpen}
              />
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
