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
import {Checkbox} from '@/components/ui/checkbox';
import {Label} from '@/components/ui/label';
import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert';
import {useAuth} from '@/context/auth-provider';
import {useArchiveProject} from '@/hooks/archive-hooks';
import {useNavigate} from '@tanstack/react-router';
import {useState} from 'react';
import {toast} from 'sonner';
import {NOTEBOOK_NAME, NOTEBOOK_NAME_CAPITALIZED} from '@/constants';
import {AlertTriangle} from 'lucide-react';

type ArchiveProjectDialogProps = {
  projectId: string;
  /** When true, shows the archive control without opening the dialog. */
  disabled?: boolean;
};

export function ArchiveProjectDialog({
  projectId,
  disabled = false,
}: ArchiveProjectDialogProps) {
  const {user} = useAuth();
  const {mutate, isPending} = useArchiveProject();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setConfirmed(false);
    }
  };

  const onConfirm = () => {
    if (!user) return;
    mutate(
      {projectId},
      {
        onSuccess: () => {
          toast.success(`${NOTEBOOK_NAME_CAPITALIZED} archived`);
          handleOpenChange(false);
          void navigate({to: '/projects', replace: true});
        },
        onError: e => {
          console.error(e);
          toast.error(e instanceof Error ? e.message : 'Request failed');
        },
      }
    );
  };

  if (disabled) {
    return (
      <Button variant="outline" className="w-fit" disabled>
        Archive {NOTEBOOK_NAME_CAPITALIZED}
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-fit">
          Archive {NOTEBOOK_NAME_CAPITALIZED}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Archive This {NOTEBOOK_NAME_CAPITALIZED}?</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-4 text-left">
              <Alert
                variant="destructive"
                className="w-full text-black dark:text-foreground [&>svg]:text-black dark:[&>svg]:text-foreground"
              >
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Data loss risk</AlertTitle>
                <AlertDescription className="space-y-3 [&_ol]:mt-2 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5 [&_li]:pl-1">
                  <p>
                    Archiving a {NOTEBOOK_NAME} can result in data loss if users
                    have not completed their synchronization whilst online.
                  </p>
                  <p>Please ensure the following:</p>
                  <ol>
                    <li>
                      All users have opened the app whilst online and confirm
                      synchronization has completed, indicated by a green tick
                      next to each record.
                    </li>
                    <li>
                      You have reported the data from the system and stored it
                      appropriately.
                    </li>
                  </ol>
                </AlertDescription>
              </Alert>
              <div className="flex items-center gap-3 text-sm leading-relaxed">
                <Checkbox
                  id="archive-project-confirm"
                  checked={confirmed}
                  onCheckedChange={v => setConfirmed(v === true)}
                  className="shrink-0"
                />
                <Label
                  htmlFor="archive-project-confirm"
                  className="cursor-pointer text-left font-normal text-foreground"
                >
                  I have performed the above steps and confirm that I would like
                  to archive this {NOTEBOOK_NAME}
                </Label>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={isPending || !confirmed}
            onClick={onConfirm}
          >
            {isPending ? 'Archiving…' : 'Archive'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
