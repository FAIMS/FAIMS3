// SPDX-License-Identifier: Apache-2.0
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
import {AddProjectToTeamForm} from '../forms/add-project-to-team-form';

export const AddProjectToTeamDialog = ({projectId}: {projectId: string}) => {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild className="w-fit">
        <Button>Assign {config.notebookNameCapitalized} to Team</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Assign {config.notebookNameCapitalized} to Team
          </DialogTitle>
          <DialogDescription>
            Choose which team owns this {config.notebookName}. The{' '}
            {config.notebookName} will then be available to members of that
            team.
          </DialogDescription>
        </DialogHeader>
        <AddProjectToTeamForm setDialogOpen={setOpen} projectId={projectId} />
      </DialogContent>
    </Dialog>
  );
};
