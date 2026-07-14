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
import {useCanCreateTemplate, useRequiredUser} from '@/hooks/auth-hooks';

/**
 * Dialog entry point for creating a new template.
 *
 * Renders nothing when the user lacks create permission, except on team pages
 * where `specifiedTeam` fixes the owning team and the parent already gates
 * access via `CREATE_TEMPLATE_IN_TEAM`.
 */
export const CreateTemplateDialog = ({
  defaultValues,
  specifiedTeam = undefined,
}: {
  defaultValues?: {teamId?: string};
  specifiedTeam?: string;
}) => {
  const [open, setOpen] = useState(false);
  const user = useRequiredUser();
  const canCreateTemplate = useCanCreateTemplate();
  const {data: team} = useGetTeam({user, teamId: specifiedTeam});

  // Global list: hide trigger when user cannot create at all.
  // Team tab passes specifiedTeam and relies on parent permission checks.
  if (!canCreateTemplate && !specifiedTeam) {
    return null;
  }

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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium">
            Create Template
            {specifiedTeam && <> in “{team?.name ?? 'Team'}”</>}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Enter a template name and optional description. Optionally upload an
            existing JSON design file, or leave it blank to start from scratch.
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
