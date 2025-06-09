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
import {CreateProjectForm} from '../forms/create-project-form';
import {NOTEBOOK_NAME, NOTEBOOK_NAME_CAPITALIZED} from '@/constants';
import {Plus} from 'lucide-react';
import {useAuth} from '@/context/auth-provider';
import {useGetTeam} from '@/hooks/queries';
import {ErrorComponent} from '@tanstack/react-router';

export const CreateProjectDialog = ({
  defaultValues,
  specifiedTeam = undefined,
}: {
  defaultValues?: {teamId?: string};
  specifiedTeam?: string;
}) => {
  const [open, setOpen] = useState(false);

  const {user} = useAuth();
  const {data: team} = useGetTeam(user, specifiedTeam);

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
          <Plus />
          Create {NOTEBOOK_NAME_CAPITALIZED}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Create {NOTEBOOK_NAME_CAPITALIZED}
            {specifiedTeam && <> in '{team?.name ?? 'Team'}'</>}
          </DialogTitle>
          <DialogDescription>
            Create a new {NOTEBOOK_NAME_CAPITALIZED} by selecting an existing
            template, uploading a JSON {NOTEBOOK_NAME} file, or leaving both 
            blank to use a blank notebook you can edit.
          </DialogDescription>
        </DialogHeader>
        <CreateProjectForm
          setDialogOpen={setOpen}
          defaultValues={defaultValues}
          specifiedTeam={specifiedTeam}
        />
      </DialogContent>
    </Dialog>
  );
};
