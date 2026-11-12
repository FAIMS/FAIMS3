// SPDX-License-Identifier: Apache-2.0
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {useRequiredUser} from '@/hooks/auth-hooks';
import {useGetTeam} from '@/hooks/queries';
import {ErrorComponent} from '@tanstack/react-router';
import {LoaderCircleIcon, Pencil} from 'lucide-react';
import {useState} from 'react';
import {UpdateTeamForm} from '../../forms/teams/update-team-form';
import {Button} from '../../ui/button';

export const UpdateTeamDialog = ({teamId}: {teamId: string}) => {
  const user = useRequiredUser();
  const {data, isLoading, isError} = useGetTeam({user, teamId});
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild className="w-fit">
        <Button
          variant="outline"
          disabled={isLoading}
          data-testid="web-team-edit-details-button"
        >
          Edit name &amp; description
          <Pencil className="ml-1 h-4 w-4" aria-hidden />
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
