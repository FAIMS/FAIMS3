import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {Button} from '@/components/ui/button';
import {GenerateTestRecordsForm} from '@/components/forms/generate-test-records-form';
import {NOTEBOOK_NAME_CAPITALIZED} from '@/constants';
import {Route} from '@/routes/_protected/projects/$projectId';
import {useState} from 'react';

type GenerateTestRecordsDialogProps = {
  disabled?: boolean;
};

export function GenerateTestRecordsDialog({
  disabled = false,
}: GenerateTestRecordsDialogProps) {
  const {projectId} = Route.useParams();
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-fit" disabled={disabled}>
          Generate test records
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate test records</DialogTitle>
          <DialogDescription>
            Developer-mode tool that creates random records in this{' '}
            {NOTEBOOK_NAME_CAPITALIZED.toLowerCase()}. Each record picks a
            random form and fills every field with sample values, including map
            geometries placed within Australia when map fields are present.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <GenerateTestRecordsForm
            setDialogOpen={setOpen}
            projectId={projectId}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
