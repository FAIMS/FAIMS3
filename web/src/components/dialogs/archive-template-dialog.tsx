import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {Button} from '../ui/button';
import {useAuth} from '@/context/auth-provider';
import {Route} from '@/routes/templates/$templateId';
import {useQueryClient} from '@tanstack/react-query';
import {useState} from 'react';
import {NOTEBOOK_NAME} from '@/constants';

/**
 * ArchiveTemplateDialog component renders a dialog for archiving a template.
 * It provides a button to open the dialog and a form to archive the template.
 *
 * @returns {JSX.Element} The rendered ArchiveTemplateDialog component.
 */
export const ArchiveTemplateDialog = ({archived}: {archived: boolean}) => {
  const {user} = useAuth();
  const {templateId} = Route.useParams();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const onClick = async () => {
    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/api/templates/${templateId}/archive`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user?.token}`,
        },
        body: JSON.stringify({
          archive: !archived,
        }),
      }
    );

    if (!response.ok) return;

    queryClient.invalidateQueries({queryKey: ['templates', undefined]});
    queryClient.invalidateQueries({queryKey: ['templates', templateId]});
    setOpen(false);
  };

  return archived ? (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild className="w-fit">
        <Button variant="outline">Un-archive Template</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Un-archive Template</DialogTitle>
          <DialogDescription>
            Un-archive the current template. This will allow the template to be
            edited and used to create {NOTEBOOK_NAME}s.
          </DialogDescription>
        </DialogHeader>
        <Button variant="destructive" className="w-full" onClick={onClick}>
          Un-archive Template
        </Button>
      </DialogContent>
    </Dialog>
  ) : (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild className="w-fit">
        <Button variant="outline">Archive Template</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Archive Template</DialogTitle>
          <DialogDescription>
            Archive the current template. This make the template read-only and
            prevent {NOTEBOOK_NAME} from being created from it.
          </DialogDescription>
        </DialogHeader>
        <Button variant="destructive" className="w-full" onClick={onClick}>
          Archive Template
        </Button>
      </DialogContent>
    </Dialog>
  );
};
