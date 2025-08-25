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
import {Plus} from 'lucide-react';
import {useGetTeam} from '@/hooks/queries';
import {useAuth} from '@/context/auth-provider';
import {ErrorComponent} from '@tanstack/react-router';
import {CreateTemplateFromProjectForm} from '../forms/create-template-from-project';
import {NOTEBOOK_NAME} from '@/constants';

export const CreateTemplateFromProjectDialog = ({
  defaultValues,
  projectId,
  specifiedTeam = undefined,
}: {
  defaultValues?: {teamId?: string};
  projectId: string;
  specifiedTeam?: string;
}) => {
  const [open, setOpen] = useState(false);
  const {user} = useAuth();
  if (!user) {
    return <ErrorComponent error="Unauthenticated" />;
  }

  const {data: team} = useGetTeam(user, specifiedTeam);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild className="w-fit">
        <Button
          variant="outline"
          className="flex items-center space-x-2 bg-primary text-primary-foreground"
        >
          <Plus size={16} />
          <span>Create Template</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg space-y-6">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium">
            Create Template
            {specifiedTeam && <> in “{team?.name ?? 'Team'}”</>}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            This will create a template using the current {NOTEBOOK_NAME}
            structure.
          </DialogDescription>
        </DialogHeader>

        <CreateTemplateFromProjectForm
          setDialogOpen={setOpen}
          defaultValues={defaultValues}
          specifiedTeam={specifiedTeam}
          projectId={projectId}
        />
      </DialogContent>
    </Dialog>
  );
};
