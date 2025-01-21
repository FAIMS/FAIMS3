import {Alert, AlertTitle, AlertDescription} from '@/components/ui/alert';
import {Button} from '@/components/ui/button';
import {Card} from '@/components/ui/card';
import {List, ListDescription, ListItem, ListLabel} from '@/components/ui/list';
import {AlertCircle} from 'lucide-react';

const TemplateActions = ({templateId}: {templateId: string}) => {
  return (
    <div className="flex flex-col gap-2 justify-between">
      <Card className="flex-1">
        <List className="flex flex-col gap-4">
          <ListItem>
            <ListLabel>Create Survey</ListLabel>
            <ListDescription>
              Create a new survey based on this template.
            </ListDescription>
          </ListItem>
          <Button>Create Survey</Button>
        </List>
      </Card>
      <Card className="flex-1">
        <List className="flex flex-col gap-4">
          <ListItem>
            <ListLabel>Edit Template</ListLabel>
            <ListDescription>Edit the current template.</ListDescription>
          </ListItem>
          <Button>Edit Template</Button>
        </List>
      </Card>
      <Card className="flex flex-col gap-4 flex-1">
        <List className="flex flex-col justify-between h-full">
          <ListItem>
            <ListLabel>Archive Template</ListLabel>
          </ListItem>
          <ListItem>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Warning</AlertTitle>
              <AlertDescription>
                Archiving the template will prevent surveys from being created
                from it.
              </AlertDescription>
            </Alert>
          </ListItem>
          <Button variant="destructive">Archive Template</Button>
        </List>
      </Card>
    </div>
  );
};

export default TemplateActions;
