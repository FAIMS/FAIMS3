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
import {useArchiveProject} from '@/hooks/archive-hooks';
import {useState} from 'react';
import {toast} from 'sonner';
import {NOTEBOOK_NAME_CAPITALIZED} from '@/constants';
import {
  getArchiveProjectDialogBody,
  getArchiveProjectUnsyncedAlertDescription,
} from '@/project-archive/project-lifecycle-copy';
import {AlertTriangle} from 'lucide-react';

type ArchiveProjectDialogProps = {
  projectId: string;
};

export function ArchiveProjectDialog({projectId}: ArchiveProjectDialogProps) {
  const {user} = useAuth();
  const {mutate, isPending} = useArchiveProject();
  const [open, setOpen] = useState(false);

  const onConfirm = () => {
    if (!user) return;
    mutate(
      {projectId},
      {
        onSuccess: () => {
          toast.success(`${NOTEBOOK_NAME_CAPITALIZED} archived`);
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
            {getArchiveProjectUnsyncedAlertDescription()}
          </AlertDescription>
        </Alert>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={isPending} onClick={onConfirm}>
            {isPending ? 'Archiving…' : 'Archive'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
