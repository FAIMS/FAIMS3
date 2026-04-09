import {useAuth} from '@/context/auth-provider';
import {useIsAuthorisedTo} from '@/hooks/auth-hooks';
import {useDisableUserAccount} from '@/hooks/user-hooks';
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
import {Action, type GetListAllUsersItem, Role} from '@faims3/data-model';
import {NOTEBOOK_NAME_CAPITALIZED} from '@/constants';
import {toast} from 'sonner';

/**
 * Opens a confirmation to disable a user account (soft-off; data retained).
 */
export function DisableUserDialog({rowUser}: {rowUser: GetListAllUsersItem}) {
  const [open, setOpen] = useState(false);
  const {user} = useAuth();
  const disableUser = useDisableUserAccount();
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
            use the API. {NOTEBOOK_NAME_CAPITALIZED}s and records they
            contributed stay unchanged.
          </DialogDescription>
        </DialogHeader>
        <Button
          className="w-full"
          variant="destructive"
          disabled={disableUser.isPending}
          onClick={() =>
            disableUser.mutate(
              {targetUserId: rowUser._id},
              {
                onSuccess: () => setOpen(false),
                onError: e => {
                  console.error(e);
                  toast.error(
                    e instanceof Error ? e.message : 'Failed to disable account'
                  );
                },
              }
            )
          }
        >
          {disableUser.isPending ? 'Disabling…' : 'Disable account'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
