import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {Button} from '../ui/button';
import {List, ListDescription, ListItem} from '../ui/list';
import {Route} from '@/routes/projects/$projectId';
import {useAuth} from '@/context/auth-provider';
import {useGetProjects} from '@/hooks/get-hooks';
import {useState} from 'react';
import {NOTEBOOK_NAME, NOTEBOOK_NAME_CAPITALIZED} from '@/constants';
import {UpdateProjectForm} from '../forms/update-project-form';

export const EditProjectDialog = () => {
  const {user} = useAuth();
  const {projectId} = Route.useParams();

  const {data} = useGetProjects(user, projectId);

  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild className="w-fit">
        <Button>Edit {NOTEBOOK_NAME_CAPITALIZED}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {NOTEBOOK_NAME_CAPITALIZED}</DialogTitle>
          <DialogDescription>
            Follow the following steps to edit the current {NOTEBOOK_NAME}.
          </DialogDescription>
        </DialogHeader>
        <List>
          <ListItem className="space-y-2">
            <ListDescription>
              1. Download the {NOTEBOOK_NAME} file.
            </ListDescription>
            <Button variant="outline">
              <a
                href={`data:text/json;charset=utf-8,${encodeURIComponent(
                  JSON.stringify(data)
                )}`}
                download={`${projectId}.json`}
              >
                Download
              </a>
            </Button>
          </ListItem>
          <ListItem>
            <ListDescription>
              2. Edit the {NOTEBOOK_NAME} either using a text editor or
              uploading the template file to{' '}
              <a
                className="underline text-primary"
                href={import.meta.env.VITE_DESIGNER_URL}
                target="_blank"
                rel="noreferrer"
              >
                Fieldmark Designer
              </a>
              .
            </ListDescription>
          </ListItem>
          <ListItem className="space-y-2">
            <ListDescription>
              3. Upload the edited {NOTEBOOK_NAME} file.
            </ListDescription>
            <UpdateProjectForm setDialogOpen={setOpen} />
          </ListItem>
        </List>
      </DialogContent>
    </Dialog>
  );
};
