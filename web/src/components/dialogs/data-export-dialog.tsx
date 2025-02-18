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

export const DataExportDialog = () => (
  <Dialog>
    <DialogTrigger asChild className="w-fit">
      <Button>Data Export</Button>
    </DialogTrigger>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Data Export</DialogTitle>
        <DialogDescription>
          Export all responses for this project to a CSV file.
        </DialogDescription>
      </DialogHeader>
      <ExportProjectForm type="csv" />
    </DialogContent>
  </Dialog>
);
