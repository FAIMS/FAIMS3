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

/**
 * ArchiveTemplateDialog component renders a dialog for archiving a template.
 * It provides a button to open the dialog and a form to archive the template.
 *
 * @returns {JSX.Element} The rendered ArchiveTemplateDialog component.
 */
export const ArchiveTemplateDialog = () => {
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
      }
    );

    if (!response.ok) return;

    queryClient.invalidateQueries({queryKey: ['templates', undefined]});
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild className="w-fit">
        <Button variant="outline">Archive Template</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Archive Template</DialogTitle>
          <DialogDescription>
            Archive the current template. This will remove the template from the
            list of templates and make it read-only.
          </DialogDescription>
        </DialogHeader>
        <Button variant="destructive" className="w-full" onClick={onClick}>
          Archive Template
        </Button>
      </DialogContent>
    </Dialog>
  );
};
