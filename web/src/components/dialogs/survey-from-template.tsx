import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {Button} from '../ui/button';
import {CreateSurveyFromTemplateForm} from '../forms/create-survey-from-template-form';

export const SurveyFromTemplateDialog = () => (
  <Dialog>
    <DialogTrigger className="w-fit">
      <Button>Create Survey</Button>
    </DialogTrigger>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Create Survey</DialogTitle>
        <DialogDescription>
          Create a new survey based on this template.
        </DialogDescription>
      </DialogHeader>
      <CreateSurveyFromTemplateForm />
    </DialogContent>
  </Dialog>
);
