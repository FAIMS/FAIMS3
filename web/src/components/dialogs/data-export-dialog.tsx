import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {Button} from '../ui/button';
import ExportProjectForm from '../forms/export-project-form';
import {NOTEBOOK_NAME_CAPITALIZED} from '@/constants';

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
        <DialogDescription>
          Export all responses for this {NOTEBOOK_NAME_CAPITALIZED} to a CSV
          file.
        </DialogDescription>
      </DialogHeader>
      <ExportProjectForm type="csv" />
    </DialogContent>
  </Dialog>
);
