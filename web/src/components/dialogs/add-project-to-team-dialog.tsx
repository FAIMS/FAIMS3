import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {Button} from '../ui/button';
import {useState} from 'react';
import {config} from '@/constants';
import {useAuth} from '@/context/auth-provider';
import {ErrorComponent} from '@tanstack/react-router';
import {AddProjectToTeamForm} from '../forms/add-project-to-team-form';

export const AddProjectToTeamDialog = ({projectId}: {projectId: string}) => {
  const [open, setOpen] = useState(false);

  const {user} = useAuth();

  if (!user) {
    return <ErrorComponent error="Unauthenticated" />;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild className="w-fit">
        <Button
          variant="outline"
          className="bg-primary text-primary-foreground"
        >
          Assign {config.notebookNameCapitalized} to Team
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Assign {config.notebookNameCapitalized} to Team
          </DialogTitle>
          <DialogDescription>
            Assign this {config.notebookName} to a different team. The{' '}
            {config.notebookName} will then be available to members of the new
            team.
          </DialogDescription>
        </DialogHeader>
        <AddProjectToTeamForm setDialogOpen={setOpen} projectId={projectId} />
      </DialogContent>
    </Dialog>
  );
};
