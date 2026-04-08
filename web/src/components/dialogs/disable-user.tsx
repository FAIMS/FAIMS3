import {useAuth} from '@/context/auth-provider';
import {useIsAuthorisedTo} from '@/hooks/auth-hooks';
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
import {UserX} from 'lucide-react';
import {useQueryClient} from '@tanstack/react-query';
import {Action, type GetListAllUsersItem, Role} from '@faims3/data-model';

/**
 * Opens a confirmation to disable a user account (soft-off; data retained).
 */
export function DisableUserDialog({rowUser}: {rowUser: GetListAllUsersItem}) {
  const [open, setOpen] = useState(false);
  const {user} = useAuth();
  const queryClient = useQueryClient();
  const canDisable = useIsAuthorisedTo({
    action: Action.DISABLE_USER_ACCOUNT,
    resourceId: rowUser._id,
  });

  const blocked =
    rowUser._id === user?.user.id ||
    (rowUser.globalRoles ?? []).includes(Role.GENERAL_ADMIN);

  if (!canDisable || blocked) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild className="w-fit">
        <Button variant="outline" title="Disable user account">
          <UserX className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Disable user account</DialogTitle>
          <DialogDescription>
            {rowUser.name} ({rowUser._id}) will no longer be able to sign in or
            use the API. Surveys and records they contributed stay unchanged.
          </DialogDescription>
        </DialogHeader>
        <Button
          className="w-full"
          variant="destructive"
          onClick={async () => {
            try {
              const res = await fetch(
                `${import.meta.env.VITE_API_URL}/api/users/${encodeURIComponent(rowUser._id)}/disable`,
                {
                  method: 'POST',
                  headers: {
                    Authorization: `Bearer ${user?.token}`,
                  },
                }
              );
              if (!res.ok) {
                console.error('Disable user failed', res.status);
                return;
              }
              await queryClient.invalidateQueries({queryKey: ['users']});
              setOpen(false);
            } catch (e) {
              console.error(e);
            }
          }}
        >
          Disable account
        </Button>
      </DialogContent>
    </Dialog>
  );
}
