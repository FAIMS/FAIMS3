import {Button} from '@/components/ui/button';
import {Card} from '@/components/ui/card';
import {ListDescription, ListItem, ListLabel} from '@/components/ui/list';
import {
  Select,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';

const SurveyExport = ({surveyId}: {surveyId: string}) => {
  return (
    <div className="flex flex-col gap-2">
      <Card className="flex flex-col gap-4 flex-1 justify-between">
        <ListItem>
          <ListLabel>Data export</ListLabel>
          <ListDescription>
            Export all responses for this survey to a CSV, JSON or XLSX file.
          </ListDescription>
        </ListItem>
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select a format" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="csv">CSV</SelectItem>
            <SelectItem value="json">JSON</SelectItem>
            <SelectItem value="xlsx">XLSX</SelectItem>
          </SelectContent>
        </Select>
        <Button>Download</Button>
      </Card>
      <Card className="flex flex-col gap-4 flex-1 justify-between">
        <ListItem>
          <ListLabel>Photo export</ListLabel>
          <ListDescription>
            Export all photos for this survey to a ZIP file.
          </ListDescription>
        </ListItem>
        <Button className="justify-self-end">Download ZIP</Button>
      </Card>
    </div>
  );
};

export default SurveyExport;
