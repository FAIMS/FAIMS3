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
import {config} from '@/constants';
import {mapLayerFormatsDocsUrl} from '@/lib/map-layer-docs';
import {ExternalLink, Upload} from 'lucide-react';
import {useState} from 'react';

/** Dialog wrapping {@link ReplaceMapLayerForm} to re-upload layer files. */
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
            the layer and receive the new file after processing.{' '}
            <a
              href={mapLayerFormatsDocsUrl(config.docsUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-foreground underline underline-offset-4 hover:text-primary"
            >
              Learn more about supported formats and CRS
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          </DialogDescription>
        </DialogHeader>
        <ReplaceMapLayerForm assetId={assetId} setDialogOpen={setOpen} />
      </DialogContent>
    </Dialog>
  );
}
