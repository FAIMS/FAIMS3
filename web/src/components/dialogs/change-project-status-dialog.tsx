import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {NOTEBOOK_NAME, NOTEBOOK_NAME_CAPITALIZED} from '@/constants';
import {useAuth} from '@/context/auth-provider';
import {ProjectStatus} from '@faims3/data-model';
import {useQueryClient} from '@tanstack/react-query';
import {AlertCircle, CheckCircle, Info} from 'lucide-react';
import {useState} from 'react';
import {Button} from '../ui/button';
import {useGetProject} from '@/hooks/queries';

export const ProjectStatusDialog = ({projectId}: {projectId: string}) => {
  const {user} = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  // Get the project data including status
  const {data: project} = useGetProject({user, projectId});
  const isOpen = project?.status === ProjectStatus.OPEN;

  const onClick = async () => {
    try {
      await fetch(
        `${import.meta.env.VITE_API_URL}/api/notebooks/${projectId}/status`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${user?.token}`,
          },
          body: JSON.stringify({
            status: isOpen ? ProjectStatus.CLOSED : ProjectStatus.OPEN,
          }),
        }
      );
      queryClient.invalidateQueries({queryKey: ['projects', undefined]});
      queryClient.invalidateQueries({queryKey: ['projects', projectId]});
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
            {NOTEBOOK_NAME_CAPITALIZED} Status
          </h3>
          <Dialog>
            <DialogTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                aria-label={`More about ${NOTEBOOK_NAME} status`}
              >
                <Info className="h-4 w-4" aria-hidden />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-foreground">
                  {NOTEBOOK_NAME_CAPITALIZED} status
                </DialogTitle>
                <DialogDescription asChild>
                  <div className="space-y-3 text-left text-sm text-foreground">
                    <p>
                      <span className="font-medium text-emerald-600 dark:text-emerald-500">
                        Open:
                      </span>{' '}
                      {NOTEBOOK_NAME_CAPITALIZED} is active and available for
                      data collection on user devices.
                    </p>
                    <p>
                      <span className="font-medium text-destructive">
                        Closed:
                      </span>{' '}
                      {NOTEBOOK_NAME_CAPITALIZED} is read-only. Users will not
                      be able to activate this {NOTEBOOK_NAME} for data
                      collection.
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
            >
              Close {NOTEBOOK_NAME_CAPITALIZED}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg text-black dark:text-foreground">
            <DialogHeader>
              <DialogTitle className="pb-2 text-black dark:text-foreground">
                Closed {NOTEBOOK_NAME_CAPITALIZED}
              </DialogTitle>
              <DialogDescription asChild>
                <div className="space-y-3 text-left text-sm !text-black dark:!text-foreground [&_*]:text-inherit [&_strong]:font-semibold [&_li]:marker:text-black [&_li]:dark:marker:text-foreground">
                  <ul className="list-disc space-y-3 pl-5">
                    <li>
                      Stops users from{' '}
                      <strong>
                        activating the {NOTEBOOK_NAME} and creating new records
                      </strong>
                      .
                    </li>
                    <li>
                      <strong>
                        Data will remain on the user&apos;s device
                      </strong>{' '}
                      until they manually deactivate the {NOTEBOOK_NAME}. This
                      allows them to finish synchronization if needed.
                    </li>
                    <li className="space-y-2">
                      <span>Can be reopened.</span>
                    </li>
                    <p className="text-sm">
                      To remove data from all user devices, you will need to
                      &apos;close&apos; the {NOTEBOOK_NAME}, then
                      &apos;archive&apos; it.
                    </p>
                  </ul>
                </div>
              </DialogDescription>
            </DialogHeader>
            <Button variant="destructive" onClick={onClick}>
              Yes, Close {NOTEBOOK_NAME_CAPITALIZED}
            </Button>
          </DialogContent>
        </Dialog>
      ) : (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">
              Reopen {NOTEBOOK_NAME_CAPITALIZED}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-foreground">
                Reopen {NOTEBOOK_NAME_CAPITALIZED}
              </DialogTitle>
              <DialogDescription className="text-foreground">
                Reopen this {NOTEBOOK_NAME} to allow data collection and
                editing.
              </DialogDescription>
            </DialogHeader>
            <Button variant="default" onClick={onClick}>
              Reopen {NOTEBOOK_NAME_CAPITALIZED}
            </Button>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
