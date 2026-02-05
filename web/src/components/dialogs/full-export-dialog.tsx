import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {Button} from '../ui/button';
import {NOTEBOOK_NAME_CAPITALIZED} from '@/constants';
import ExportFullForm from '../forms/export-full-form';

/**
 * FullExportDialog component renders a dialog for creating a full
 * project export. It provides options to select which components to include
 * in the export (CSV data, photos, spatial data, metadata).
 *
 * @returns {JSX.Element} The rendered FullExportDialog component.
 */
export const FullExportDialog = () => {
  return (
    <Dialog>
      <DialogTrigger asChild className="w-fit">
        <Button>Full Export</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Full Export</DialogTitle>
          <DialogDescription>
            Download a complete export of this {NOTEBOOK_NAME_CAPITALIZED}{' '}
            including all data, photos, and spatial information in a single ZIP
            file. May take some time to download large datasets.
          </DialogDescription>
        </DialogHeader>
        <ExportFullForm />
      </DialogContent>
    </Dialog>
  );
};
