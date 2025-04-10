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
import {CreateTemplateForm} from '../forms/create-template-form';
import {Plus} from 'lucide-react';
import {useGetTeam} from '@/hooks/queries';
import {useAuth} from '@/context/auth-provider';
import {ErrorComponent} from '@tanstack/react-router';

export const CreateTemplateDialog = ({
  defaultValues,
  specifiedTeam = undefined,
}: {
  defaultValues?: {teamId?: string};
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
          className="bg-primary text-primary-foreground"
        >
          <Plus />
          Create Template
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Create Template{specifiedTeam && <> in '{team?.name ?? 'Team'}'</>}
          </DialogTitle>
          <DialogTitle></DialogTitle>
          <DialogDescription>
            Create a new template by uploading a JSON template file.
          </DialogDescription>
        </DialogHeader>
        <CreateTemplateForm
          setDialogOpen={setOpen}
          defaultValues={defaultValues}
          specifiedTeam={specifiedTeam}
        />
      </DialogContent>
    </Dialog>
  );
};
