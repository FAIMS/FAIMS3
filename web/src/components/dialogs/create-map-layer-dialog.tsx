// SPDX-License-Identifier: Apache-2.0
import {CreateMapLayerForm} from '@/components/forms/create-map-layer-form';
import {Button} from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {useCanUploadMapLayer} from '@/hooks/auth-hooks';
import {Plus} from 'lucide-react';
import {useState} from 'react';

/** Hidden when the user cannot upload a map layer. */
export function CreateMapLayerDialog() {
  const [open, setOpen] = useState(false);
  const canUpload = useCanUploadMapLayer();

  if (!canUpload) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild className="w-fit">
        <Button
          variant="outline"
          className="flex items-center space-x-2 bg-primary text-primary-foreground"
          data-testid="web-map-layers-create-button"
        >
          <Plus size={16} />
          <span>Add map layer</span>
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-w-lg"
        data-testid="web-map-layers-create-dialog"
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-medium">
            Add map layer
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Upload a georeferenced file. Processing starts immediately and the
            layer stays unavailable to surveys until it is ready.
          </DialogDescription>
        </DialogHeader>
        <CreateMapLayerForm setDialogOpen={setOpen} />
      </DialogContent>
    </Dialog>
  );
}
