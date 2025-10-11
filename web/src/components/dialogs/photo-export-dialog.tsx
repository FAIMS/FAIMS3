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
import ExportPhotosForm from '../forms/export-photos-form';

/**
 * PhotoExportDialog component renders a dialog for exporting a project's photos.
 * It provides a button to open the dialog and a form to export the project's photos.
 *
 * @returns {JSX.Element} The rendered PhotoExportDialog component.
 */
export const PhotoExportDialog = () => {
  return (
    <Dialog>
      <DialogTrigger asChild className="w-fit">
        <Button>Photo Export</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Photo Export</DialogTitle>
          <DialogDescription>
            Export all photos for this {NOTEBOOK_NAME_CAPITALIZED} to a ZIP
            file.
          </DialogDescription>
        </DialogHeader>
        <ExportPhotosForm />
      </DialogContent>
    </Dialog>
  );
};
