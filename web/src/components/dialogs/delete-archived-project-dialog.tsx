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
import {useQueryClient} from '@tanstack/react-query';
import {useNavigate, useRouterState} from '@tanstack/react-router';
import {useState} from 'react';
import {toast} from 'sonner';
import {NOTEBOOK_NAME, NOTEBOOK_NAME_CAPITALIZED} from '@/constants';
import {deleteArchivedProjectDialogIntro} from '@/project-archive/project-lifecycle-copy';
import {Skull} from 'lucide-react';

type DeleteArchivedProjectDialogProps = {
  projectId: string;
  surveyName: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function DeleteArchivedProjectDialog({
  projectId,
  surveyName,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: DeleteArchivedProjectDialogProps) {
  const {user} = useAuth();
  const queryClient = useQueryClient();
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
  const [pending, setPending] = useState(false);

  const matches = confirmText.trim() === surveyName.trim();

  const onDelete = async () => {
    if (!user || !matches) return;
    setPending(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/notebooks/${encodeURIComponent(projectId)}/delete`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${user.token}`,
          },
          body: JSON.stringify({confirmName: surveyName.trim()}),
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
      toast.success(`${NOTEBOOK_NAME_CAPITALIZED} permanently deleted`);
      queryClient.invalidateQueries({queryKey: ['projects']});
      queryClient.removeQueries({queryKey: ['projects', projectId]});
      setOpen(false);
      setConfirmText('');
      if (isOnProjectDetailPage) {
        void navigate({to: '/projects'});
      }
    } catch (e) {
      console.error(e);
      toast.error('Request failed');
    } finally {
      setPending(false);
    }
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Skull className="h-5 w-5" />
            Irreversible deletion
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 text-left text-sm text-muted-foreground">
              {deleteArchivedProjectDialogIntro.map((line, i) => (
                <p key={i}>{line}</p>
              ))}
              <p className="font-medium text-foreground">
                Cold backups and infrastructure outside this control plane are
                your organisation’s responsibility.
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <Alert variant="destructive">
          <AlertTitle>Operations-only action</AlertTitle>
          <AlertDescription>
            This action requires elevated permissions. Project administrators
            cannot perform it.
          </AlertDescription>
        </Alert>
        <div className="space-y-2">
          <Label htmlFor="confirm-survey-name">
            Type the {NOTEBOOK_NAME} name exactly to confirm:{' '}
            <span className="font-mono font-medium text-foreground">
              {surveyName}
            </span>
          </Label>
          <Input
            id="confirm-survey-name"
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
            disabled={!matches || pending}
            onClick={onDelete}
          >
            {pending ? 'Deleting…' : 'Delete forever'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
