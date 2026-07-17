import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {config} from '@/constants';
import {useRequiredUser} from '@/hooks/auth-hooks';
import {ProjectStatus} from '@faims3/data-model';
import {useQueryClient} from '@tanstack/react-query';
import {AlertCircle, CheckCircle, Info} from 'lucide-react';
import {useState} from 'react';
import {Button} from '../ui/button';
import {useGetProject} from '@/hooks/queries';

export const ProjectStatusDialog = ({projectId}: {projectId: string}) => {
  const user = useRequiredUser();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  // Get the project data including status
  const {data: project} = useGetProject({user, projectId});
  const isOpen = project?.status === ProjectStatus.OPEN;

  const onClick = async () => {
    try {
      await fetch(`${config.apiUrl}/api/notebooks/${projectId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          status: isOpen ? ProjectStatus.CLOSED : ProjectStatus.OPEN,
        }),
      });
      queryClient.invalidateQueries({queryKey: ['projects']});
      queryClient.invalidateQueries({queryKey: ['projects', projectId]});
      queryClient.invalidateQueries({queryKey: ['projectsbyteam']});
      setOpen(false);
    } catch (e) {
      console.log(e);
    }
  };

  return (
    <div>
      <div className="mb-2">
        <div className="flex items-center gap-1.5 mb-2">
          <h3 className="text-base font-medium text-card-foreground">
            {config.notebookNameCapitalized} Status
          </h3>
          <Dialog>
            <DialogTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                aria-label={`More about ${config.notebookName} status`}
              >
                <Info className="h-4 w-4" aria-hidden />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-foreground">
                  {config.notebookNameCapitalized} status
                </DialogTitle>
                <DialogDescription asChild>
                  <div className="space-y-3 text-left text-sm text-foreground">
                    <p>
                      <span className="font-medium text-emerald-600 dark:text-emerald-500">
                        Open:
                      </span>{' '}
                      {config.notebookNameCapitalized} is active and available
                      for data collection on user devices.
                    </p>
                    <p>
                      <span className="font-medium text-destructive">
                        Closed:
                      </span>{' '}
                      {config.notebookNameCapitalized} is read-only. Users will
                      not be able to activate this {config.notebookName} for
                      data collection.
                    </p>
                  </div>
                </DialogDescription>
              </DialogHeader>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-medium text-card-foreground">
            Current status:
          </span>
          {isOpen ? (
            <div className="flex items-center gap-1.5 text-emerald-500">
              <CheckCircle size={16} />
              <span className="text-sm font-medium">Open</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-destructive">
              <AlertCircle size={16} />
              <span className="text-sm font-medium">Closed</span>
            </div>
          )}
        </div>
      </div>

      {isOpen ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              className="text-destructive border-border hover:bg-destructive/10 hover:text-destructive"
              data-testid="web-project-status-close"
            >
              Close {config.notebookNameCapitalized}
            </Button>
          </DialogTrigger>
          <DialogContent
            className="max-w-lg text-black dark:text-foreground"
            data-testid="web-project-status-close-dialog"
          >
            <DialogHeader>
              <DialogTitle className="pb-2 text-black dark:text-foreground">
                Closed {config.notebookNameCapitalized}
              </DialogTitle>
              <DialogDescription asChild>
                <div className="space-y-3 text-left text-sm !text-black dark:!text-foreground [&_*]:text-inherit [&_strong]:font-semibold [&_li]:marker:text-black [&_li]:dark:marker:text-foreground">
                  <ul className="list-disc space-y-3 pl-5">
                    <li>
                      Stops users from{' '}
                      <strong>
                        activating the {config.notebookName} and creating new
                        records
                      </strong>
                      .
                    </li>
                    <li>
                      <strong>
                        Data will remain on the user&apos;s device
                      </strong>{' '}
                      until they manually deactivate the {config.notebookName}.
                      This allows them to finish synchronization if needed.
                    </li>
                    <li className="space-y-2">
                      <span>Can be reopened.</span>
                    </li>
                    <p className="text-sm">
                      To remove data from all user devices, you will need to
                      &apos;close&apos; the {config.notebookName}, then
                      &apos;archive&apos; it.
                    </p>
                  </ul>
                </div>
              </DialogDescription>
            </DialogHeader>
            <Button
              variant="destructive"
              onClick={onClick}
              data-testid="web-project-status-close-confirm"
            >
              Yes, Close {config.notebookNameCapitalized}
            </Button>
          </DialogContent>
        </Dialog>
      ) : (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" data-testid="web-project-status-reopen">
              Reopen {config.notebookNameCapitalized}
            </Button>
          </DialogTrigger>
          <DialogContent data-testid="web-project-status-reopen-dialog">
            <DialogHeader>
              <DialogTitle className="text-foreground">
                Reopen {config.notebookNameCapitalized}
              </DialogTitle>
              <DialogDescription className="text-foreground">
                Reopen this {config.notebookName} to allow data collection and
                editing.
              </DialogDescription>
            </DialogHeader>
            <Button
              variant="default"
              onClick={onClick}
              data-testid="web-project-status-reopen-confirm"
            >
              Reopen {config.notebookNameCapitalized}
            </Button>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
