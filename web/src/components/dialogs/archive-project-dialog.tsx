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
import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert';
import {useAuth} from '@/context/auth-provider';
import {useQueryClient} from '@tanstack/react-query';
import {useState} from 'react';
import {toast} from 'sonner';
import {NOTEBOOK_NAME_CAPITALIZED} from '@/constants';
import {getArchiveProjectDialogBody} from '@/project-archive/project-lifecycle-copy';
import {AlertTriangle} from 'lucide-react';

type ArchiveProjectDialogProps = {
  projectId: string;
};

export function ArchiveProjectDialog({projectId}: ArchiveProjectDialogProps) {
  const {user} = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const onConfirm = async () => {
    if (!user) return;
    setPending(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/notebooks/${encodeURIComponent(projectId)}/archive`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${user.token}`,
          },
          body: JSON.stringify({archive: true}),
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
      toast.success(`${NOTEBOOK_NAME_CAPITALIZED} archived`);
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
      <DialogTrigger asChild>
        <Button variant="outline" className="w-fit">
          Archive {NOTEBOOK_NAME_CAPITALIZED}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Archive this {NOTEBOOK_NAME_CAPITALIZED}?</DialogTitle>
          <DialogDescription className="text-left">
            {getArchiveProjectDialogBody()}
          </DialogDescription>
        </DialogHeader>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Unsynced data risk</AlertTitle>
          <AlertDescription>
            Surveyors should sync before archiving if your deployment can remove
            local data from devices.
          </AlertDescription>
        </Alert>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={pending} onClick={onConfirm}>
            {pending ? 'Archiving…' : 'Archive'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
