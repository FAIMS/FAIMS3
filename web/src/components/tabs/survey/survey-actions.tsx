import {Alert, AlertTitle, AlertDescription} from '@/components/ui/alert';
import {Button} from '@/components/ui/button';
import {Card} from '@/components/ui/card';
import {List, ListDescription, ListItem, ListLabel} from '@/components/ui/list';
import {AlertCircle} from 'lucide-react';

const SurveyActions = ({surveyId}: {surveyId: string}) => {
  return (
    <div className="flex flex-col gap-2 justify-between">
      <Card className="flex flex-col gap-4 flex-1">
        <List>
          <ListItem>
            <ListLabel>Edit Survey</ListLabel>
            <ListDescription>Current Responses: 203</ListDescription>
          </ListItem>
          <ListItem>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Warning</AlertTitle>
              <AlertDescription>
                Updating the design for a survey with existing responses could
                result in data incosistencies.
              </AlertDescription>
            </Alert>
          </ListItem>
          <ListItem>
            <Button variant="destructive">Edit Survey Design</Button>
          </ListItem>
        </List>
      </Card>
      <Card className="flex flex-col gap-4 flex-1">
        <List className="flex flex-col justify-between h-full">
          <ListItem>
            <ListLabel>Close Survey</ListLabel>
            <ListDescription>Current Status: Active</ListDescription>
          </ListItem>
          <ListItem>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Warning</AlertTitle>
              <AlertDescription>
                Closing a survey prevents new responses from being added to it.
              </AlertDescription>
            </Alert>
          </ListItem>
          <Button variant="destructive">Close Survey</Button>
        </List>
      </Card>
    </div>
  );
};

export default SurveyActions;
