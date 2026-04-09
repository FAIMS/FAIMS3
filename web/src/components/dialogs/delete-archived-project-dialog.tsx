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
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {useAuth} from '@/context/auth-provider';
import {useDeleteArchivedProject} from '@/hooks/archive-hooks';
import {useNavigate, useRouterState} from '@tanstack/react-router';
import {useState} from 'react';
import {toast} from 'sonner';
import {NOTEBOOK_NAME, NOTEBOOK_NAME_CAPITALIZED} from '@/constants';
import {AlertTriangle, Skull} from 'lucide-react';

type DeleteArchivedProjectDialogProps = {
  projectId: string;
  /** Exact display name the user must type to confirm (usually the project/notebook name). */
  projectDisplayName: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function DeleteArchivedProjectDialog({
  projectId,
  projectDisplayName,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: DeleteArchivedProjectDialogProps) {
  const {user} = useAuth();
  const {mutate, isPending} = useDeleteArchivedProject();
  const navigate = useNavigate();
  const pathname = useRouterState({select: s => s.location.pathname});
  const isOnProjectDetailPage =
    pathname === `/projects/${projectId}` ||
    pathname.endsWith(`/projects/${projectId}`);
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOnOpenChange !== undefined;
  const open = isControlled ? (controlledOpen ?? false) : internalOpen;
  const setOpen = isControlled ? controlledOnOpenChange! : setInternalOpen;
  const [confirmText, setConfirmText] = useState('');

  const matches = confirmText.trim() === projectDisplayName.trim();

  const onDelete = () => {
    if (!user || !matches) return;
    mutate(
      {projectId, confirmName: projectDisplayName.trim()},
      {
        onSuccess: () => {
          toast.success(`${NOTEBOOK_NAME_CAPITALIZED} permanently deleted`);
          setOpen(false);
          setConfirmText('');
          if (isOnProjectDetailPage) {
            void navigate({to: '/projects'});
          }
        },
        onError: e => {
          console.error(e);
          toast.error(e instanceof Error ? e.message : 'Request failed');
        },
      }
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={v => {
        setOpen(v);
        if (!v) setConfirmText('');
      }}
    >
      {!isControlled ? (
        <DialogTrigger asChild>
          <Button variant="destructive" className="w-fit">
            Permanently delete {NOTEBOOK_NAME_CAPITALIZED}
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent className="max-w-lg text-black dark:text-foreground">
        <DialogHeader className="space-y-4">
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Skull className="h-5 w-5" />
            Irreversible deletion
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-4 text-left text-sm text-black dark:text-foreground">
              <p className="text-black dark:text-foreground">
                <span className="font-semibold">WARNING:</span> You are about to
                permanently delete all records in this {NOTEBOOK_NAME}. This
                action cannot be undone.
              </p>
              <Alert
                variant="destructive"
                className="w-full border-destructive text-black dark:text-foreground [&>svg]:text-black dark:[&>svg]:text-foreground"
              >
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle className="sr-only">Export data</AlertTitle>
                <AlertDescription className="text-black dark:text-foreground">
                  Ensure you have exported the data from the system, and stored
                  it appropriately.
                </AlertDescription>
              </Alert>
            </div>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label
            htmlFor="confirm-project-display-name"
            className="text-black dark:text-foreground"
          >
            Type the {NOTEBOOK_NAME} name exactly to confirm deletion:{' '}
            <span className="font-mono font-medium text-black dark:text-foreground">
              {projectDisplayName}
            </span>
          </Label>
          <Input
            id="confirm-project-display-name"
            autoComplete="off"
            value={confirmText}
            onChange={e => setConfirmText(e.target.value)}
            placeholder={`${NOTEBOOK_NAME_CAPITALIZED} name`}
          />
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!matches || isPending}
            onClick={onDelete}
          >
            {isPending ? 'Deleting…' : 'Delete forever'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
