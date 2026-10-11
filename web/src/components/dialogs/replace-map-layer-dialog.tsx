// SPDX-License-Identifier: Apache-2.0
import {ReplaceMapLayerForm} from '@/components/forms/replace-map-layer-form';
import {Button} from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {Upload} from 'lucide-react';
import {useState} from 'react';

export function ReplaceMapLayerDialog({
  assetId,
  disabled,
}: {
  assetId: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild className="w-fit">
        <Button variant="outline" disabled={disabled}>
          Upload replacement
          <Upload className="ml-1 h-4 w-4" aria-hidden />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Replace map layer file</DialogTitle>
          <DialogDescription>
            Upload a new georeferenced file for this layer. Linked surveys keep
            the layer and receive the new file after processing.
          </DialogDescription>
        </DialogHeader>
        <ReplaceMapLayerForm assetId={assetId} setDialogOpen={setOpen} />
      </DialogContent>
    </Dialog>
  );
}
