import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {Button} from '@/components/ui/button';
import {config} from '@/constants';
import {useAuth} from '@/context/auth-provider';
import {useGetProject} from '@/hooks/queries';
import {Route} from '@/routes/_protected/projects/$projectId';
import {EditProjectDetailsForm} from '@/components/forms/edit-project-details-form';
import {LoaderCircleIcon, Pencil} from 'lucide-react';
import {useState} from 'react';

/**
 * Dialog to edit survey name and description (PUT /api/notebooks/:id metadata only).
 */
export const EditProjectDetailsDialog = () => {
  const {user} = useAuth();
  const {projectId} = Route.useParams();
  const {data, isLoading, isError} = useGetProject({user, projectId});
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild className="w-fit">
        <Button variant="outline" disabled={isLoading}>
          Edit name &amp; description
          <Pencil className="ml-1 h-4 w-4" aria-hidden />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Edit {config.notebookNameCapitalized} details
          </DialogTitle>
          <DialogDescription>
            Update the display name and short description for this{' '}
            {config.notebookNameCapitalized.toLowerCase()}. Design documentation
            stays in the editor.
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <LoaderCircleIcon className="animate-spin" aria-label="Loading" />
        ) : isError || !data ? (
          <p className="text-sm text-destructive">
            Could not load {config.notebookNameCapitalized.toLowerCase()}{' '}
            details.
          </p>
        ) : (
          <EditProjectDetailsForm
            projectId={projectId}
            name={data.name}
            description={data.description}
            setDialogOpen={setOpen}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
