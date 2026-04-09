import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {Button} from '@/components/ui/button';
import {useAuth} from '@/context/auth-provider';
import {useDeleteArchivedTemplate} from '@/hooks/archive-hooks';
import {useTemplateSurveyReferences} from '@/hooks/queries';
import {
  templateDeleteDialogLabels,
  getTemplateDeleteDialogBody,
} from '@/archive/template-delete-warnings';
import {toast} from 'sonner';
import {cn} from '@/lib/utils';

type DeleteArchivedTemplateDialogProps = {
  templateId: string;
  templateName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DeleteArchivedTemplateDialog({
  templateId,
  templateName,
  open,
  onOpenChange,
}: DeleteArchivedTemplateDialogProps) {
  const {user} = useAuth();

  const referencesQuery = useTemplateSurveyReferences({
    user,
    templateId,
    enabled: open,
  });

  const deleteMutation = useDeleteArchivedTemplate();

  const notebookRefCount = referencesQuery.data?.surveyCount ?? null;
  const body =
    notebookRefCount !== null
      ? getTemplateDeleteDialogBody({
          templateName,
          referencingNotebookCount: notebookRefCount,
        })
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onClick={e => e.stopPropagation()}
        className="max-h-[min(90vh,40rem)] overflow-y-auto text-black"
      >
        <DialogHeader>
          <DialogTitle className="text-black">
            {templateDeleteDialogLabels.title}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 text-sm text-black">
              {referencesQuery.isLoading && (
                <p>{templateDeleteDialogLabels.loadingReferences}</p>
              )}
              {referencesQuery.isError && (
                <p className="text-black">
                  {referencesQuery.error instanceof Error
                    ? referencesQuery.error.message
                    : templateDeleteDialogLabels.loadError}
                </p>
              )}
              {body && (
                <>
                  <p className="leading-relaxed text-black">
                    {templateDeleteDialogLabels.introBefore}
                    <span
                      className={cn(
                        'mx-0.5 inline-block max-w-full align-middle rounded-md border border-border',
                        'bg-muted px-1.5 py-0.5 font-mono text-sm text-black',
                        'break-words [overflow-wrap:anywhere]'
                      )}
                      title={body.nameLabel}
                    >
                      {body.nameLabel}
                    </span>
                    {templateDeleteDialogLabels.introAfter}
                  </p>
                  {body.linkedWarningText && (
                    <div
                      className={cn(
                        'rounded-md border-2 border-red-500 bg-red-100 p-4',
                        'text-black'
                      )}
                    >
                      <p className="leading-relaxed text-black">
                        {body.linkedWarningText}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleteMutation.isPending}
          >
            {templateDeleteDialogLabels.cancel}
          </Button>
          <Button
            variant="destructive"
            disabled={
              deleteMutation.isPending ||
              referencesQuery.isLoading ||
              referencesQuery.isError ||
              notebookRefCount === null
            }
            onClick={() =>
              deleteMutation.mutate(
                {templateId},
                {
                  onSuccess: () => {
                    toast.success('Template deleted');
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
            {templateDeleteDialogLabels.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
