import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {Button} from '@/components/ui/button';
import {useRestoreTemplateFromArchive} from '@/hooks/archive-hooks';
import {NOTEBOOK_NAME_CAPITALIZED} from '@/constants';

type RestoreTemplateDialogProps = {
  templateId: string;
  templateName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Confirmation dialog for restoring an archived template (mutation is stubbed until API exists).
 */
export function RestoreTemplateDialog({
  templateId,
  templateName,
  open,
  onOpenChange,
}: RestoreTemplateDialogProps) {
  const {mutate, isPending} = useRestoreTemplateFromArchive();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClick={e => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Restore template</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                Restore{' '}
                <span className="font-medium text-foreground">
                  {templateName}
                </span>{' '}
                to active status? It can be edited again and used to create new{' '}
                {NOTEBOOK_NAME_CAPITALIZED}s.
              </p>
              <p>
                Existing {NOTEBOOK_NAME_CAPITALIZED}s created from this template
                are not changed.
              </p>
            </div>
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
                {templateId},
                {
                  onSuccess: () => onOpenChange(false),
                }
              );
            }}
          >
            Restore template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
