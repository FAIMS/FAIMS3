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
import {useAuth} from '@/context/auth-provider';
import {ErrorComponent} from '@tanstack/react-router';
import {AddTemplateToTeamForm} from '../forms/add-template-to-team-form';

export const AddTemplateToTeamDialog = ({templateId}: {templateId: string}) => {
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
          Assign Template to Team
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Template to Team</DialogTitle>
          <DialogDescription>
            Assign this template to a different team. The template will then be
            available to members of the new team.
          </DialogDescription>
        </DialogHeader>
        <AddTemplateToTeamForm
          setDialogOpen={setOpen}
          templateId={templateId}
        />
      </DialogContent>
    </Dialog>
  );
};
