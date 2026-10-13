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
        className="max-h-[90vh] max-w-lg overflow-y-auto"
        data-testid="web-map-layers-create-dialog"
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-medium">
            Add map layer
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                Upload a map layer. You can upload raster or vector layers. Once
                uploaded, layers can be linked to surveys, and activated for
                offline use on devices.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="font-medium text-foreground">Raster/Image</p>
                  <ul className="list-disc space-y-0.5 pl-4">
                    <li>GeoTIFF (.tif, .tiff)</li>
                    <li>Georeferenced PDF (.pdf)</li>
                    <li>
                      PNG or JPEG (.png, .jpg, .jpeg) with a world file and a
                      .prj
                    </li>
                  </ul>
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-foreground">Vector</p>
                  <ul className="list-disc space-y-0.5 pl-4">
                    <li>GeoJSON (.geojson, .json)</li>
                    <li>GeoPackage (.gpkg)</li>
                    <li>Zipped shapefile (.zip)</li>
                    <li>KML (.kml)</li>
                  </ul>
                </div>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>
        <CreateMapLayerForm setDialogOpen={setOpen} />
      </DialogContent>
    </Dialog>
  );
}
