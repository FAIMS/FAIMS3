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
import {useGetProject} from '@/hooks/get-hooks';
import {ProjectStatus} from '@faims3/data-model';
import {useQueryClient} from '@tanstack/react-query';
import {AlertCircle, CheckCircle} from 'lucide-react';
import {useState} from 'react';
import {Button} from '../ui/button';

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
      <div className="mb-4">
        <h3 className="text-base font-medium mb-2 text-card-foreground">
          {NOTEBOOK_NAME_CAPITALIZED} Status
        </h3>

        {/* Status indicator */}
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
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <AlertCircle size={16} />
              <span className="text-sm font-medium">Closed</span>
            </div>
          )}
        </div>

        {/* Status definitions */}
        <div className="bg-muted p-3 rounded-md mb-4 text-sm">
          <h4 className="text-xs font-medium mb-2 text-card-foreground">
            What this means:
          </h4>
          <p className="text-xs text-muted-foreground mb-2">
            <span className="font-medium text-emerald-500">Open:</span>{' '}
            {NOTEBOOK_NAME_CAPITALIZED} is active and available for data
            collection on users' devices.
          </p>
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-muted-foreground">Closed:</span>{' '}
            {NOTEBOOK_NAME_CAPITALIZED} is read-only. Users will not be able to
            activate this {NOTEBOOK_NAME} for data collection.
          </p>
        </div>
      </div>

      {isOpen ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              className="w-full text-destructive border-border hover:bg-destructive/10 hover:text-destructive"
            >
              Close {NOTEBOOK_NAME_CAPITALIZED}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Close {NOTEBOOK_NAME_CAPITALIZED}</DialogTitle>
              <DialogDescription>
                Are you sure you want to close this {NOTEBOOK_NAME}? This will
                make the {NOTEBOOK_NAME} read-only and prevent new data from
                being collected. <b>It may be re-opened if necessary.</b>
              </DialogDescription>
            </DialogHeader>
            <Button variant="destructive" className="w-full" onClick={onClick}>
              Yes, Close {NOTEBOOK_NAME_CAPITALIZED}
            </Button>
          </DialogContent>
        </Dialog>
      ) : (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              className="w-full text-emerald-500 border-border hover:bg-emerald-500/10 hover:text-emerald-600"
            >
              Reopen {NOTEBOOK_NAME_CAPITALIZED}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reopen {NOTEBOOK_NAME_CAPITALIZED}</DialogTitle>
              <DialogDescription>
                Reopen this {NOTEBOOK_NAME} to allow data collection and
                editing.
              </DialogDescription>
            </DialogHeader>
            <Button
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white"
              onClick={onClick}
            >
              Reopen {NOTEBOOK_NAME_CAPITALIZED}
            </Button>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
