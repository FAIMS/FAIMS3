import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {Button} from '../ui/button';
import {CreateSurveyFromTemplateForm} from '../forms/create-survey-from-template-form';

/**
 * Component for rendering a dialog to create a new survey from a template.
 * @returns {JSX.Element} The rendered dialog component.
 */
export const SurveyFromTemplateDialog = () => (
  <Dialog>
    <DialogTrigger asChild className="w-fit">
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
