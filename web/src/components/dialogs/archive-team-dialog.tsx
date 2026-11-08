// SPDX-License-Identifier: Apache-2.0
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {Button} from '../ui/button';
import {useRequiredUser} from '@/hooks/auth-hooks';
import {Route} from '@/routes/_protected/teams/$teamId';
import {useNavigate} from '@tanstack/react-router';
import {useQueryClient} from '@tanstack/react-query';
import {useState} from 'react';
import {toast} from 'sonner';
import {putArchiveTeamRequest} from '@/hooks/archive-hooks';
import {config} from '@/constants';

/**
 * ArchiveTeamDialog renders a dialog for archiving or restoring a team.
 */
export const ArchiveTeamDialog = ({archived}: {archived: boolean}) => {
  const user = useRequiredUser();
  const {teamId} = Route.useParams();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const onClick = async () => {
    const willArchive = !archived;
    try {
      await putArchiveTeamRequest({
        teamId,
        token: user.token,
        archive: willArchive,
      });

      queryClient.invalidateQueries({queryKey: ['teams']});
      queryClient.invalidateQueries({queryKey: ['teams', teamId]});
      setOpen(false);

      if (willArchive) {
        toast.success('Successfully archived');
        await navigate({to: '/teams'});
      } else {
        toast.success('Team restored');
      }
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : 'Something went wrong. Please try again.'
      );
    }
  };

  return archived ? (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild className="w-fit">
        <Button variant="outline" data-testid="web-team-archive-button">
          Un-archive Team
        </Button>
      </DialogTrigger>
      <DialogContent data-testid="web-team-archive-dialog">
        <DialogHeader>
          <DialogTitle>Un-archive Team</DialogTitle>
          <DialogDescription>
            Restore this team so it appears in Teams lists and can be used for
            new {config.notebookNamePlural}, templates, map layers, and invites.
          </DialogDescription>
        </DialogHeader>
        <Button
          variant="destructive"
          className="w-full"
          onClick={onClick}
          data-testid="web-team-archive-confirm"
        >
          Un-archive Team
        </Button>
      </DialogContent>
    </Dialog>
  ) : (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild className="w-fit">
        <Button variant="outline" data-testid="web-team-archive-button">
          Archive Team
        </Button>
      </DialogTrigger>
      <DialogContent data-testid="web-team-archive-dialog">
        <DialogHeader>
          <DialogTitle>Archive Team</DialogTitle>
          <DialogDescription>
            Hide this team from default lists and stop new membership, invites,
            and in-team creates. Owned {config.notebookNamePlural}, templates,
            and map layers keep their own status and stay usable.
          </DialogDescription>
        </DialogHeader>
        <Button
          variant="destructive"
          className="w-full"
          onClick={onClick}
          data-testid="web-team-archive-confirm"
        >
          Archive Team
        </Button>
      </DialogContent>
    </Dialog>
  );
};
