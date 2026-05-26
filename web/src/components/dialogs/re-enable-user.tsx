import {useIsAuthorisedTo} from '@/hooks/auth-hooks';
import {useEnableUserAccount} from '@/hooks/user-hooks';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {Button} from '../ui/button';
import {useState} from 'react';
import {RotateCcw} from 'lucide-react';
import {Action, type GetListAllUsersItem} from '@faims3/data-model';
import {toast} from 'sonner';
import {cn} from '@/lib/utils';

/**
 * Opens a confirmation before re-enabling a disabled user account.
 */
export function ReEnableUserDialog({rowUser}: {rowUser: GetListAllUsersItem}) {
  const [open, setOpen] = useState(false);
  const enableUser = useEnableUserAccount();
  const canEnable = useIsAuthorisedTo({
    action: Action.ENABLE_USER_ACCOUNT,
    resourceId: rowUser._id,
  });

  const displayId = rowUser.emails[0]?.email ?? rowUser.user_id ?? rowUser._id;

  const tooltip = !canEnable
    ? "You don't have permission to re-enable user accounts"
    : enableUser.isPending
      ? 'Re-enabling user…'
      : 'Re-enable this user account so they can sign in again';

  const triggerButton = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-9 w-9 shrink-0 text-foreground [&_svg]:size-[1.125rem]"
      aria-label="Re-enable user"
      disabled={!canEnable || enableUser.isPending}
    >
      <RotateCcw aria-hidden />
    </Button>
  );

  const triggerWrap = (
    <div
      className="flex justify-center"
      onClick={e => e.stopPropagation()}
      onKeyDown={e => e.stopPropagation()}
    >
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {!canEnable ? (
              <span className="inline-flex">{triggerButton}</span>
            ) : (
              <DialogTrigger asChild>{triggerButton}</DialogTrigger>
            )}
          </TooltipTrigger>
          <TooltipContent side="top">{tooltip}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );

  if (!canEnable) {
    return triggerWrap;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {triggerWrap}
      <DialogContent className="text-black">
        <DialogHeader>
          <DialogTitle className="text-black">Re-enable user</DialogTitle>
          <DialogDescription asChild className="text-black [&]:text-black">
            <div
              className={cn(
                'rounded-md border-2 border-red-500 bg-red-100 p-4 text-sm',
                'text-black'
              )}
            >
              <p className="font-medium text-black">Warning</p>
              <p className="mt-2 text-black">User {displayId}</p>
              <ul className="mt-2 list-disc space-y-2 pl-5 text-black">
                <li>They&apos;ll have their access restored to the system.</li>
                <li>The user will not be notified.</li>
              </ul>
            </div>
          </DialogDescription>
        </DialogHeader>
        <Button
          className="w-full"
          disabled={enableUser.isPending}
          onClick={() =>
            enableUser.mutate(
              {targetUserId: rowUser._id},
              {
                onSuccess: () => setOpen(false),
                onError: e => {
                  console.error(e);
                  toast.error(
                    e instanceof Error
                      ? e.message
                      : 'Failed to re-enable account'
                  );
                },
              }
            )
          }
        >
          {enableUser.isPending ? 'Re-enabling…' : 'Re-enable'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
