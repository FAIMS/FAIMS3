import {useIsAuthorisedTo} from '@/hooks/auth-hooks';
import {useEnableUserAccount} from '@/hooks/user-hooks';
import {Button} from '../ui/button';
import {Action} from '@faims3/data-model';
import {RotateCcw} from 'lucide-react';
import {toast} from 'sonner';

export function ReEnableUserButton({userId}: {userId: string}) {
  const enableUser = useEnableUserAccount();
  const canEnable = useIsAuthorisedTo({
    action: Action.ENABLE_USER_ACCOUNT,
    resourceId: userId,
  });

  if (!canEnable) {
    return null;
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1"
      disabled={enableUser.isPending}
      onClick={() =>
        enableUser.mutate(
          {targetUserId: userId},
          {
            onError: e => {
              console.error(e);
              toast.error(
                e instanceof Error ? e.message : 'Failed to re-enable account'
              );
            },
          }
        )
      }
    >
      <RotateCcw className="h-3.5 w-3.5" />
      {enableUser.isPending ? 'Re-enabling…' : 'Re-enable'}
    </Button>
  );
}
