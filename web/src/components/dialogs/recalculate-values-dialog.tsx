import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {Button} from '../ui/button';
import {config} from '@/constants';
import RecalculateValuesForm from '../forms/recalculate-values-form';

/**
 * RecalculateValuesDialog renders a dialog for recalculating values derived
 * from parent records across the whole {notebook}. Provides a trigger button
 * and hosts the form that runs the operation and shows its summary.
 */
export const RecalculateValuesDialog = () => {
  return (
    <Dialog>
      <DialogTrigger asChild className="w-fit">
        <Button>Recalculate Values</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Recalculate Values</DialogTitle>
          <DialogDescription>
            Update values derived from parent records across this{' '}
            {config.notebookName}.
          </DialogDescription>
        </DialogHeader>
        <RecalculateValuesForm />
      </DialogContent>
    </Dialog>
  );
};
