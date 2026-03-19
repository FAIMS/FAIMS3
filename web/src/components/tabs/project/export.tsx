import {DataExportDialog} from '@/components/dialogs/data-export-dialog';
import {PhotoExportDialog} from '@/components/dialogs/photo-export-dialog';
import {FullExportDialog} from '@/components/dialogs/full-export-dialog';
import {Card} from '@/components/ui/card';
import {CopyButton} from '@/components/ui/copy-button';
import {Input} from '@/components/ui/input';
import {ListDescription, ListItem, ListLabel} from '@/components/ui/list';
import {API_URL, NOTEBOOK_NAME} from '@/constants';

function buildFeatureServiceUrl(projectId: string): string {
  const base = API_URL.replace(/\/$/, '');
  return `${base}/api/notebooks/${projectId}/FeatureServer`;
}

/**
 * ProjectExport component renders a card with options to export a project's data.
 * It allows users to:
 * - Create a full export with all data, photos, and spatial information
 * - Export the project's data to CSV or geospatial formats
 * - Download a ZIP file containing all photos
 * - Copy the ESRI Feature Service URL for use in ArcGIS, QGIS, or scripts
 *
 * @param {string} projectId - The unique identifier of the project.
 * @returns {JSX.Element} The rendered ProjectExport component.
 */
const ProjectExport = ({projectId}: {projectId: string}): JSX.Element => {
  const featureServiceUrl = buildFeatureServiceUrl(projectId);

  return (
    <div className="flex flex-col gap-2">
      <Card className="flex flex-col gap-4 flex-1 justify-between">
        <ListItem>
          <ListLabel>Full Export</ListLabel>
          <ListDescription>
            Download a complete export of this {NOTEBOOK_NAME} as a single ZIP
            file. Includes all records, photos, and spatial data with
            configurable options.
          </ListDescription>
        </ListItem>
        <FullExportDialog />
      </Card>
      <Card className="flex flex-col gap-4 flex-1 justify-between">
        <ListItem>
          <ListLabel>Data Export</ListLabel>
          <ListDescription>
            Export all responses for this {NOTEBOOK_NAME}. You can select a data
            format which suits your needs. Photos can be downloaded separately
            below.
          </ListDescription>
        </ListItem>
        <DataExportDialog />
      </Card>
      <Card className="flex flex-col gap-4 flex-1 justify-between">
        <ListItem>
          <ListLabel>Photo Export</ListLabel>
          <ListDescription>
            Export all photos for this {NOTEBOOK_NAME} to a ZIP file.
          </ListDescription>
        </ListItem>
        <PhotoExportDialog />
      </Card>
      <Card className="flex flex-col gap-4 flex-1 justify-between">
        <ListItem>
          <ListLabel>ESRI Feature Service</ListLabel>
          <ListDescription>
            Use this URL in ArcGIS (Add Layer from URL), QGIS (Add ArcGIS
            Feature Server Layer), or scripts. Requests require a Bearer token
            (same as the Records API).
          </ListDescription>
        </ListItem>
        <div className="flex gap-2 items-center flex-wrap">
          <Input
            readOnly
            value={featureServiceUrl}
            className="flex-1 min-w-[280px] font-mono text-sm"
            aria-label="Feature Service URL"
          />
          <CopyButton value={featureServiceUrl}>Copy URL</CopyButton>
        </div>
      </Card>
    </div>
  );
};

export default ProjectExport;
