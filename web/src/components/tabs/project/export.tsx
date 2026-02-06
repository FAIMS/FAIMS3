import {DataExportDialog} from '@/components/dialogs/data-export-dialog';
import {PhotoExportDialog} from '@/components/dialogs/photo-export-dialog';
import {FullExportDialog} from '@/components/dialogs/full-export-dialog';
import {Card} from '@/components/ui/card';
import {ListDescription, ListItem, ListLabel} from '@/components/ui/list';
import {NOTEBOOK_NAME} from '@/constants';

/**
 * ProjectExport component renders a card with options to export a project's data.
 * It allows users to:
 * - Create a full export with all data, photos, and spatial information
 * - Export the project's data to CSV or geospatial formats
 * - Download a ZIP file containing all photos
 *
 * @returns {JSX.Element} The rendered ProjectExport component.
 */
const ProjectExport = (): JSX.Element => (
  <div className="flex flex-col gap-2">
    <Card className="flex flex-col gap-4 flex-1 justify-between">
      <ListItem>
        <ListLabel>Full Export</ListLabel>
        <ListDescription>
          Download a complete export of this {NOTEBOOK_NAME} as a single ZIP
          file. Includes all records, photos, and spatial data with configurable
          options.
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
  </div>
);

export default ProjectExport;
