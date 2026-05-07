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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';

export const AddTemplateToTeamDialog = ({
  templateId,
  disabled = false,
}: {
  templateId: string;
  /** When true (e.g. template is archived), the control is disabled with a tooltip. */
  disabled?: boolean;
}) => {
  const [open, setOpen] = useState(false);

  const {user} = useAuth();

  if (!user) {
    return <ErrorComponent error="Unauthenticated" />;
  }

  if (disabled) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-block w-fit">
              <Button
                variant="outline"
                className="bg-primary text-primary-foreground"
                disabled
              >
                Assign Template to Team
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-balance">
            Archived templates cannot be reassigned to a team. Un-archive the
            template first.
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
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
