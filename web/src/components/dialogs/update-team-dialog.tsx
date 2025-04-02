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
import {CreateTeamForm} from '../forms/create-team-form';
import {Button} from '../ui/button';
import {useGetTeam} from '@/hooks/get-hooks';
import {useAuth} from '@/context/auth-provider';
import {LoaderCircleIcon} from 'lucide-react';
import {UpdateTeamForm} from '../forms/update-team-form';
import {ErrorComponent} from '@tanstack/react-router';

export const UpdateTeamDialog = ({teamId}: {teamId: string}) => {
  const {user} = useAuth();
  if (!user) {
    return <p>Not authenticated...</p>;
  }
  const {data, isLoading, isError} = useGetTeam(user, teamId);
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild className="w-fit">
        <Button variant={'outline'}>Update Team</Button>
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
