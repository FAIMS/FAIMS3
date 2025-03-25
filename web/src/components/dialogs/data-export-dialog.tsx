import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {Button} from '../ui/button';
import ExportProjectForm from '../forms/export-project-form';
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs';

/**
 * DataExportDialog component renders a dialog for exporting a project's data.
 * It provides a button to open the dialog and a form to export the project's data.
 *
 * @returns {JSX.Element} The rendered DataExportDialog component.
 */
export const DataExportDialog = () => (
  <Dialog>
    <DialogTrigger asChild className="w-fit">
      <Button>Data Export</Button>
    </DialogTrigger>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Data Export</DialogTitle>
        <DialogDescription>
          Export all responses for this project to your preferred format.
        </DialogDescription>
      </DialogHeader>
      <Tabs defaultValue="csv" className="w-full">
        <TabsList className="flex gap-2 w-fit">
          <TabsTrigger value="csv">CSV</TabsTrigger>
          <TabsTrigger value="json">JSON</TabsTrigger>
          <TabsTrigger value="xlsx">XLSX</TabsTrigger>
        </TabsList>
        <TabsContent value="csv">
          <ExportProjectForm type="csv" />
        </TabsContent>
        <TabsContent value="json">
          <ExportProjectForm type="json" />
        </TabsContent>
        <TabsContent value="xlsx">
          <ExportProjectForm type="xlsx" />
        </TabsContent>
      </Tabs>
    </DialogContent>
  </Dialog>
);
