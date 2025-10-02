import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import ExportProjectForm from '../forms/export-project-form';
import {Button} from '../ui/button';

/**
 * DataExportDialog component renders a dialog for exporting a project's data.
 * It provides a button to open the dialog and a form to export the project's data.
 *
 * @returns {JSX.Element} The rendered DataExportDialog component.
 */
export const DataExportDialog = () => (
  <Dialog>
    <DialogTrigger asChild className="w-fit">
      <Button>Data Export</Button>
    </DialogTrigger>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Data Export</DialogTitle>
      </DialogHeader>
      <ExportProjectForm />
    </DialogContent>
  </Dialog>
);
