import {DataExportDialog} from '@/components/dialogs/data-export-dialog';
import {PhotoExportDialog} from '@/components/dialogs/photo-export-dialog';
import {Card} from '@/components/ui/card';
import {ListDescription, ListItem, ListLabel} from '@/components/ui/list';
import {NOTEBOOK_NAME} from '@/constants';

/**
 * ProjectExport component renders a card with options to export a project's data.
 * It allows users to export the project's data to CSV, JSON, or XLSX formats,
 * as well as to download a ZIP file containing all photos.
 *
 * @param {string} projectId - The unique identifier of the project.
 * @returns {JSX.Element} The rendered ProjectExport component.
 */
const ProjectExport = (): JSX.Element => (
  <div className="flex flex-col gap-2">
    <Card className="flex flex-col gap-4 flex-1 justify-between">
      <ListItem>
        <ListLabel>Data Export</ListLabel>
        <ListDescription>
          Export all responses for this {NOTEBOOK_NAME} to a CSV file.
        </ListDescription>
      </ListItem>
      <DataExportDialog />
    </Card>
    <Card className="flex flex-col gap-4 flex-1 justify-between">
      <ListItem>
        <ListLabel>Photo export</ListLabel>
        <ListDescription>
          Export all photos for this {NOTEBOOK_NAME} to a ZIP file.
        </ListDescription>
      </ListItem>
      <PhotoExportDialog />
    </Card>
  </div>
);

export default ProjectExport;
