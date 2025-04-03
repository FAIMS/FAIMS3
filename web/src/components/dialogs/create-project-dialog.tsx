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
import {NOTEBOOK_NAME_CAPITALIZED} from '@/constants';

export const CreateProjectDialog = ({defaultValues} : {defaultValues? : {teamId?: string}}) => {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild className="w-fit">
        <Button variant={'outline'}>Create {NOTEBOOK_NAME_CAPITALIZED}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create {NOTEBOOK_NAME_CAPITALIZED}</DialogTitle>
          <DialogDescription>
            Create a new {NOTEBOOK_NAME_CAPITALIZED} by selecting an existing
            template or uploading a JSON notebook specification file.
          </DialogDescription>
        </DialogHeader>
        <CreateProjectForm setDialogOpen={setOpen} defaultValues={defaultValues}/>
      </DialogContent>
    </Dialog>
  );
};
