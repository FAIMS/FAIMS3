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
import {Route} from '@/routes/_protected/templates/$templateId';
import {useNavigate} from '@tanstack/react-router';
import {useQueryClient} from '@tanstack/react-query';
import {useState} from 'react';
import {toast} from 'sonner';
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
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const onClick = async () => {
    const willArchive = !archived;
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/templates/${templateId}/archive`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${user?.token}`,
          },
          body: JSON.stringify({
            archive: willArchive,
          }),
        }
      );

      if (!response.ok) {
        let message = response.statusText;
        try {
          const body = (await response.json()) as {
            error?: {message?: string};
          };
          if (body?.error?.message) message = body.error.message;
        } catch {
          /* use statusText */
        }
        toast.error(message);
        return;
      }

      queryClient.invalidateQueries({queryKey: ['templates']});
      queryClient.invalidateQueries({queryKey: ['templates', templateId]});
      queryClient.invalidateQueries({queryKey: ['templatesbyteam']});
      setOpen(false);

      if (willArchive) {
        toast.success('Successfully archived');
        await navigate({to: '/templates'});
      }
    } catch (e) {
      toast.error('Something went wrong. Please try again.');
      console.log(e);
    }
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
            This makes the template read-only and prevents new {NOTEBOOK_NAME}s
            from being created from it.
          </DialogDescription>
        </DialogHeader>
        <Button variant="destructive" className="w-full" onClick={onClick}>
          Archive Template
        </Button>
      </DialogContent>
    </Dialog>
  );
};
