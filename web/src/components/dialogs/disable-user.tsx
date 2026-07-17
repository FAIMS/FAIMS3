import {useIsAuthorisedTo, useRequiredUser} from '@/hooks/auth-hooks';
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
import {toast} from 'sonner';
import {config} from '@/constants';
import {cn} from '@/lib/utils';

/**
 * Opens a confirmation to disable a user account (soft-off; data retained).
 */
export function DisableUserDialog({rowUser}: {rowUser: GetListAllUsersItem}) {
  const [open, setOpen] = useState(false);
  const user = useRequiredUser();
  const disableUser = useDisableUserAccount();
  const canDisable = useIsAuthorisedTo({
    action: Action.DISABLE_USER_ACCOUNT,
    resourceId: rowUser._id,
  });

  const blocked =
    rowUser._id === user.user.id ||
    (rowUser.globalRoles ?? []).includes(Role.GENERAL_ADMIN);

  if (!canDisable || blocked) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild className="w-fit">
        <Button
          variant="outline"
          title="Disable user account"
          data-testid="web-users-disable-button"
        >
          <UserX className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent
        className="text-black"
        data-testid="web-users-disable-dialog"
      >
        <DialogHeader>
          <DialogTitle className="text-black">Disable User Account</DialogTitle>
          <DialogDescription asChild className="text-black">
            <div
              className={cn(
                'rounded-md border-2 border-red-500 bg-red-100 p-4 text-sm',
                'text-black'
              )}
            >
              <p className="font-medium text-black">Warning:</p>
              <ul className="mt-2 list-disc space-y-2 pl-5 text-black">
                <li>
                  The user&apos;s email will not be able to access any of the
                  system.
                </li>
                <li>
                  {config.notebookNamePluralCapitalized} and records they
                  contributed will not be affected.
                </li>
                <li>The user will not be notified.</li>
              </ul>
            </div>
          </DialogDescription>
        </DialogHeader>
        <Button
          className="w-full"
          variant="destructive"
          disabled={disableUser.isPending}
          data-testid="web-users-disable-confirm"
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
