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
import {config} from '@/constants';
import {Plus} from 'lucide-react';
import {useIsAuthorisedTo, useRequiredUser} from '@/hooks/auth-hooks';
import {useGetTeam} from '@/hooks/queries';
import {Action, getUserResourcesForAction} from '@faims3/data-model';

export const CreateProjectDialog = ({
  defaultValues,
  specifiedTeam = undefined,
}: {
  defaultValues?: {teamId?: string};
  specifiedTeam?: string;
}) => {
  const [open, setOpen] = useState(false);

  const user = useRequiredUser();
  const {data: team} = useGetTeam({user, teamId: specifiedTeam});
  const canCreateGlobally = useIsAuthorisedTo({action: Action.CREATE_PROJECT});
  const canCreateInSpecifiedTeam = useIsAuthorisedTo({
    action: Action.CREATE_PROJECT_IN_TEAM,
    resourceId: specifiedTeam,
  });
  const canCreateInSomeTeam =
    getUserResourcesForAction({
      decodedToken: user.decodedToken,
      action: Action.CREATE_PROJECT_IN_TEAM,
    }).length > 0;
  const canCreate =
    canCreateGlobally ||
    (specifiedTeam ? canCreateInSpecifiedTeam : canCreateInSomeTeam);

  if (!canCreate) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild className="w-fit">
        <Button
          variant="outline"
          className="bg-primary text-primary-foreground"
        >
          <Plus />
          Create {config.notebookNameCapitalized}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Create {config.notebookNameCapitalized}
            {specifiedTeam && <> in '{team?.name ?? 'Team'}'</>}
          </DialogTitle>
          <DialogDescription>
            Create a new {config.notebookNameCapitalized} with a name. Start
            from an existing template, upload a JSON {config.notebookName}{' '}
            design file, or leave blank to start from scratch.
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
