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
import {NOTEBOOK_NAME_PLURAL_CAPITALIZED} from '@/constants';

type RestoreTemplateDialogProps = {
  templateId: string;
  templateName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Confirmation dialog for restoring an archived template via POST /api/templates/:id/restore.
 */
export function RestoreTemplateDialog({
  templateId,
  templateName: _templateName,
  open,
  onOpenChange,
}: RestoreTemplateDialogProps) {
  const {mutate, isPending} = useRestoreTemplateFromArchive();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onClick={e => e.stopPropagation()}
        className="text-black"
      >
        <DialogHeader>
          <DialogTitle className="text-black">Restore template</DialogTitle>
          <DialogDescription asChild>
            <p className="text-sm leading-relaxed text-black">
              Restoring this template will unarchive it. You will be able to edit
              the template and create new {NOTEBOOK_NAME_PLURAL_CAPITALIZED} from it.
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
