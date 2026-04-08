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
import {useAuth} from '@/context/auth-provider';
import {useQueryClient} from '@tanstack/react-query';
import {useState} from 'react';
import {toast} from 'sonner';
import {NOTEBOOK_NAME, NOTEBOOK_NAME_CAPITALIZED} from '@/constants';

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
  const {user} = useAuth();
  const queryClient = useQueryClient();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOnOpenChange !== undefined;
  const open = isControlled ? (controlledOpen ?? false) : internalOpen;
  const setOpen = isControlled ? controlledOnOpenChange! : setInternalOpen;
  const [pending, setPending] = useState(false);

  const onRestore = async () => {
    if (!user) return;
    setPending(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/notebooks/${encodeURIComponent(projectId)}/restore`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        }
      );
      if (!response.ok) {
        let message = response.statusText;
        try {
          const body = (await response.json()) as {error?: {message?: string}};
          if (body?.error?.message) message = body.error.message;
        } catch {
          /* ignore */
        }
        toast.error(message);
        return;
      }
      toast.success(
        `${NOTEBOOK_NAME_CAPITALIZED} restored (closed — not open for new records)`
      );
      queryClient.invalidateQueries({queryKey: ['projects']});
      queryClient.invalidateQueries({queryKey: ['projects', projectId]});
      setOpen(false);
    } catch (e) {
      console.error(e);
      toast.error('Request failed');
    } finally {
      setPending(false);
    }
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Restore this {NOTEBOOK_NAME_CAPITALIZED}?</DialogTitle>
          <DialogDescription className="text-left">
            This {NOTEBOOK_NAME} will return to the <strong>closed</strong>{' '}
            state (not open for new activations). You can change open/closed
            status afterwards if you have permission.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button disabled={pending} onClick={onRestore}>
            {pending ? 'Restoring…' : 'Restore'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
