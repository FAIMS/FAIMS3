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
import {
  useCanUploadMapLayer,
  useIsAuthorisedTo,
  useRequiredUser,
} from '@/hooks/auth-hooks';
import {useGetTeam} from '@/hooks/queries';
import {config} from '@/constants';
import {mapLayerFormatsDocsUrl} from '@/lib/map-layer-docs';
import {Action} from '@faims3/data-model';
import {ExternalLink, Plus} from 'lucide-react';
import {useState} from 'react';

/** Hidden when the user cannot upload a map layer. */
export function CreateMapLayerDialog({
  specifiedTeam,
}: {
  specifiedTeam?: string;
}) {
  const [open, setOpen] = useState(false);
  const user = useRequiredUser();
  const canUpload = useCanUploadMapLayer();
  const {data: team} = useGetTeam({user, teamId: specifiedTeam});
  const canCreateInSpecifiedTeam = useIsAuthorisedTo({
    action: Action.CREATE_MAP_ASSET_IN_TEAM,
    resourceId: specifiedTeam,
  });
  const canCreate = specifiedTeam ? canCreateInSpecifiedTeam : canUpload;

  if (!canCreate) {
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
            {specifiedTeam && <> in '{team?.name ?? 'Team'}'</>}
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
                    <li>
                      Zipped shapefile or File Geodatabase (.zip, .gdb.zip)
                    </li>
                    <li>KML (.kml)</li>
                  </ul>
                </div>
              </div>
              <p>
                <a
                  href={mapLayerFormatsDocsUrl(config.docsUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-foreground underline underline-offset-4 hover:text-primary"
                  data-testid="web-map-layers-create-formats-docs"
                >
                  Learn more about supported formats and CRS
                  <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <CreateMapLayerForm
          setDialogOpen={setOpen}
          specifiedTeam={specifiedTeam}
        />
      </DialogContent>
    </Dialog>
  );
}
