import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {Button} from '../ui/button';
import {useState} from 'react';
import {Trash} from 'lucide-react';
import {useQueryClient} from '@tanstack/react-query';
import {Alert, AlertDescription, AlertTitle} from '../ui/alert';
import {useRequiredUser} from '@/hooks/auth-hooks';
import {config} from '@/constants';

/**
 * RemoveUserDialog component renders a dialog for removing a user.
 * It provides a button to open the dialog and a form to remove the user.
 *
 * @param {string} userId - The ID of the user to remove.
 * @param {boolean} admin - Whether the user is an admin.
 * @returns {JSX.Element} The rendered RemoveUserDialog component.
 */
export const RemoveUserDialog = ({
  userId,
  disabled,
}: {
  userId: string;
  disabled?: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const user = useRequiredUser();
  const QueryClient = useQueryClient();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild className="w-fit">
        <Button variant="outline" disabled={disabled}>
          <Trash className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove User</DialogTitle>
          <DialogDescription>
            Are you sure you wish to remove user: {userId}?
          </DialogDescription>
        </DialogHeader>
        <Alert variant="destructive" className="w-full">
          <AlertTitle>Warning</AlertTitle>
          <AlertDescription>
            Removing a user will mean they can no longer log in to the system.
          </AlertDescription>
        </Alert>
        <Button
          className="w-full"
          onClick={async () => {
            try {
              await fetch(`${config.apiUrl}/api/users/${userId}`, {
                method: 'DELETE',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${user.token}`,
                },
              });

              QueryClient.invalidateQueries({queryKey: ['users']});
              QueryClient.invalidateQueries({queryKey: ['projectusers']});
              QueryClient.invalidateQueries({queryKey: ['teamusers']});

              setOpen(false);
            } catch (e) {
              console.log(e);
            }
          }}
        >
          Remove User
        </Button>
      </DialogContent>
    </Dialog>
  );
};
