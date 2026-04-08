import {useAuth} from '@/context/auth-provider';
import {useIsAuthorisedTo} from '@/hooks/auth-hooks';
import {Button} from '../ui/button';
import {useQueryClient} from '@tanstack/react-query';
import {Action} from '@faims3/data-model';
import {RotateCcw} from 'lucide-react';

export function ReEnableUserButton({userId}: {userId: string}) {
  const {user} = useAuth();
  const queryClient = useQueryClient();
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
      onClick={async () => {
        try {
          const res = await fetch(
            `${import.meta.env.VITE_API_URL}/api/users/${encodeURIComponent(userId)}/enable`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${user?.token}`,
              },
            }
          );
          if (!res.ok) {
            console.error('Re-enable user failed', res.status);
            return;
          }
          await queryClient.invalidateQueries({queryKey: ['users']});
        } catch (e) {
          console.error(e);
        }
      }}
    >
      <RotateCcw className="h-3.5 w-3.5" />
      Re-enable
    </Button>
  );
}
