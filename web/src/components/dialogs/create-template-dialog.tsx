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
import { Plus } from 'lucide-react';

export const CreateTemplateDialog = ({
  defaultValues,
}: {
  defaultValues?: {teamId?: string};
}) => {
  const [open, setOpen] = useState(false);

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
          <DialogTitle>Create Template</DialogTitle>
          <DialogDescription>
            Create a new template by uploading a JSON template file.
          </DialogDescription>
        </DialogHeader>
        <CreateTemplateForm
          setDialogOpen={setOpen}
          defaultValues={defaultValues}
        />
      </DialogContent>
    </Dialog>
  );
};
