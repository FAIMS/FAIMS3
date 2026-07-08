import {useAuth} from '@/context/auth-provider';
import {useIsAuthorisedTo} from '@/hooks/auth-hooks';
import {useImpersonateUser} from '@/hooks/user-hooks';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert';
import {Action, type GetListAllUsersItem, Role} from '@faims3/data-model';
import {VenetianMask} from 'lucide-react';
import {useState} from 'react';
import {toast} from 'sonner';
import {Button} from '../ui/button';

/**
 * Opens a confirmation to impersonate a user. On confirm, the current (admin)
 * session is stashed and swapped for a session authenticating as the target
 * user; the app navigates to the Control Centre home so data loads as the
 * impersonated user.
 *
 * Only rendered for admins authorised to impersonate, and never for the current
 * user or for cluster (GENERAL_ADMIN) accounts.
 */
export function ImpersonateUserDialog({
  rowUser,
}: {
  rowUser: GetListAllUsersItem;
}) {
  const [open, setOpen] = useState(false);
  const {user} = useAuth();
  const impersonate = useImpersonateUser();
  const canImpersonate = useIsAuthorisedTo({
    action: Action.IMPERSONATE_USER,
    resourceId: rowUser._id,
  });

  const blocked =
    rowUser._id === user?.user.id ||
    (rowUser.globalRoles ?? []).includes(Role.GENERAL_ADMIN);

  if (!canImpersonate || blocked) {
    return null;
  }

  const displayName = rowUser.name || rowUser.emails[0]?.email || rowUser._id;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild className="w-fit">
        <Button variant="outline" title="Impersonate user">
          <VenetianMask className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="break-words [overflow-wrap:anywhere]">
            Impersonate {displayName}
          </DialogTitle>
          <DialogDescription asChild className="text-inherit">
            <Alert variant="warning" className="w-full border-2 border-warning">
              <AlertTitle>Heads up:</AlertTitle>
              <AlertDescription>
                <ul className="mt-2 list-disc space-y-2 pl-5">
                  <li>
                    You will be signed in as this user and see exactly what they
                    see.
                  </li>
                  <li>
                    Any actions you take will be performed and attributed as
                    this user.
                  </li>
                  <li>
                    Use &ldquo;Return to your account&rdquo; in the banner to
                    end impersonation. The session also ends automatically after
                    a short time.
                  </li>
                </ul>
              </AlertDescription>
            </Alert>
          </DialogDescription>
        </DialogHeader>
        <Button
          className="h-auto w-full whitespace-normal break-words py-2 [overflow-wrap:anywhere]"
          disabled={impersonate.isPending}
          onClick={() =>
            impersonate.mutate(
              {targetUserId: rowUser._id},
              {
                onSuccess: () => setOpen(false),
                onError: e => {
                  console.error(e);
                  toast.error(
                    e instanceof Error
                      ? e.message
                      : 'Failed to impersonate user'
                  );
                },
              }
            )
          }
        >
          {impersonate.isPending ? 'Starting…' : `Impersonate ${displayName}`}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
