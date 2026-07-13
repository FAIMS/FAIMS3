import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {Button} from '@/components/ui/button';
import {useRestoreArchivedProject} from '@/hooks/archive-hooks';
import {useState} from 'react';
import {toast} from 'sonner';
import {config} from '@/constants';

type RestoreArchivedProjectDialogProps = {
  projectId: string;
  /** Controlled mode (e.g. table row actions). Omit for default trigger button. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function RestoreArchivedProjectDialog({
  projectId,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: RestoreArchivedProjectDialogProps) {
  const {mutate, isPending} = useRestoreArchivedProject();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOnOpenChange !== undefined;
  const open = isControlled ? (controlledOpen ?? false) : internalOpen;
  const setOpen = isControlled ? controlledOnOpenChange! : setInternalOpen;

  const onRestore = () => {
    mutate(
      {projectId},
      {
        onSuccess: () => {
          toast.success(
            `${config.notebookNameCapitalized} restored (closed — not open for new records)`
          );
          setOpen(false);
        },
        onError: e => {
          console.error(e);
          toast.error(e instanceof Error ? e.message : 'Request failed');
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled ? (
        <DialogTrigger asChild>
          <Button variant="default" className="w-fit">
            Restore from archive
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent className="text-black dark:text-foreground">
        <DialogHeader>
          <DialogTitle className="text-black dark:text-foreground">
            Restore this {config.notebookNameCapitalized}?
          </DialogTitle>
          <DialogDescription asChild>
            <p className="text-left text-sm leading-relaxed !text-black dark:!text-foreground [&_strong]:text-inherit">
              When restored, this {config.notebookName} will be{' '}
              <strong>&apos;closed&apos;</strong>. You can{' '}
              <strong>&apos;reopen&apos;</strong> this {config.notebookName} by
              going to the {config.notebookNamePluralCapitalized}/
              <strong>&apos;Actions&apos;</strong> tab.
            </p>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button disabled={isPending} onClick={onRestore}>
            {isPending ? 'Restoring…' : 'Restore'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
