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

export const CreateProjectDialog = () => {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild className="w-fit">
        <Button variant={'outline'}>Create Project</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Project</DialogTitle>
          <DialogDescription>
            Create a new project by selecting an existing template or uploading
            a JSON notebook specification file.
          </DialogDescription>
        </DialogHeader>
        <CreateProjectForm setDialogOpen={setOpen} />
      </DialogContent>
    </Dialog>
  );
};
