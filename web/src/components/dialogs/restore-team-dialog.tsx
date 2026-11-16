// SPDX-License-Identifier: Apache-2.0
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {Button} from '@/components/ui/button';
import {useRestoreTeamFromArchive} from '@/hooks/archive-hooks';
import {config} from '@/constants';
import {toast} from 'sonner';

type RestoreTeamDialogProps = {
  teamId: string;
  teamName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Confirmation dialog for restoring an archived team via PUT /api/teams/:id/archive.
 */
export function RestoreTeamDialog({
  teamId,
  teamName: _teamName,
  open,
  onOpenChange,
}: RestoreTeamDialogProps) {
  const {mutate, isPending} = useRestoreTeamFromArchive();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClick={e => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Restore team</DialogTitle>
          <DialogDescription asChild>
            <p className="text-sm leading-relaxed">
              Restoring this team will unarchive it. Membership and owned{' '}
              {config.notebookNamePlural}, templates, and map layers are
              unchanged. You will be able to invite members and create new
              resources in the team again.
            </p>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={isPending}
            onClick={() => {
              mutate(
                {teamId},
                {
                  onSuccess: () => {
                    toast.success('Team restored');
                    onOpenChange(false);
                  },
                  onError: err => {
                    toast.error(
                      err instanceof Error ? err.message : 'Restore failed'
                    );
                  },
                }
              );
            }}
          >
            Restore team
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
