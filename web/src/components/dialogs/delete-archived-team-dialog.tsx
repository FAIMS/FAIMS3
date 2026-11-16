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
import {useDeleteArchivedTeam} from '@/hooks/archive-hooks';
import {config} from '@/constants';
import {toast} from 'sonner';
import {cn} from '@/lib/utils';

type DeleteArchivedTeamDialogProps = {
  teamId: string;
  teamName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DeleteArchivedTeamDialog({
  teamId,
  teamName,
  open,
  onOpenChange,
}: DeleteArchivedTeamDialogProps) {
  const deleteMutation = useDeleteArchivedTeam();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onClick={e => e.stopPropagation()}
        className="max-h-[min(90vh,40rem)] overflow-y-auto text-foreground"
      >
        <DialogHeader>
          <DialogTitle className="text-foreground">
            Permanently delete team
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 text-sm text-foreground">
              <p className="leading-relaxed text-foreground">
                This permanently removes{' '}
                <span
                  className={cn(
                    'mx-0.5 inline-block max-w-full align-middle rounded-md border border-border',
                    'bg-muted px-1.5 py-0.5 font-mono text-sm text-foreground',
                    'break-words [overflow-wrap:anywhere]'
                  )}
                  title={teamName}
                >
                  {teamName}
                </span>
                . This cannot be undone.
              </p>
              <div className="rounded-md border-2 border-destructive bg-destructive/10 p-4 text-foreground">
                <p className="leading-relaxed text-foreground">
                  Delete is refused while the team still owns{' '}
                  {config.notebookNamePlural}, templates, or map layers.
                  Reassign or delete those first. Membership roles for this team
                  are removed after a successful delete.
                </p>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleteMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={deleteMutation.isPending}
            onClick={() =>
              deleteMutation.mutate(
                {teamId},
                {
                  onSuccess: () => {
                    toast.success('Team deleted');
                    onOpenChange(false);
                  },
                  onError: err => {
                    toast.error(
                      err instanceof Error ? err.message : 'Delete failed'
                    );
                  },
                }
              )
            }
          >
            Delete team
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
