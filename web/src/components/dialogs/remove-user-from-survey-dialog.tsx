import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {Button} from '../ui/button';
import {NOTEBOOK_NAME} from '@/constants';
import {useState} from 'react';
import {useAuth} from '@/context/auth-provider';
import {Trash} from 'lucide-react';
import {Route} from '@/routes/projects/$projectId';
import {useQueryClient} from '@tanstack/react-query';

/**
 *
 * Removes a user from a survey.
 * @param {string} userId - The ID of the user to remove.
 * @param {boolean} admin - Whether the user is an admin.
 * @returns {JSX.Element} The rendered RemoveUserFromSurveyDialog component.
 */
export const RemoveUserFromSurveyDialog = ({
  userId,
  admin,
}: {
  userId: string;
  admin: boolean;
}) => {
  const {user} = useAuth();
  const {projectId} = Route.useParams();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild className="w-fit">
        <Button variant="outline" disabled={admin}>
          <Trash className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove User</DialogTitle>
          <DialogDescription>
            Remove user: <span className="text-primary">{userId}</span> from
            this {NOTEBOOK_NAME}.
          </DialogDescription>
        </DialogHeader>
        <Button
          variant="destructive"
          className="w-full"
          onClick={async () => {
            const response = await fetch(
              `${import.meta.env.VITE_API_URL}/api/notebooks/${projectId}/users/${userId}`,
              {
                method: 'DELETE',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${user?.token}`,
                },
              }
            );

            if (!response.ok) return;

            queryClient.invalidateQueries({
              queryKey: ['project-users', projectId],
            });

            setOpen(false);
          }}
        >
          Remove User
        </Button>
      </DialogContent>
    </Dialog>
  );
};
