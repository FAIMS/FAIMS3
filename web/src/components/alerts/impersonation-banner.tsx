import {useAuth} from '@/context/auth-provider';
import {useRequiredUser} from '@/hooks/auth-hooks';
import {Button} from '@/components/ui/button';
import {VenetianMask} from 'lucide-react';

/**
 * Persistent banner shown while the current session is an impersonation
 * session. Provides a clear way to return to the admin's own account.
 */
export function ImpersonationBanner() {
  const {isImpersonating, impersonatorName, stopImpersonation} = useAuth();
  const user = useRequiredUser();

  if (!isImpersonating) {
    return null;
  }

  const impersonatedName = user.user.name ?? user.user.email ?? 'this user';

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border-2 border-warning bg-warning-background px-4 py-2 text-sm text-foreground">
      <div className="flex items-center gap-2">
        <VenetianMask className="h-4 w-4 shrink-0 text-warning" />
        <span>
          You are impersonating <strong>{impersonatedName}</strong>
          {impersonatorName ? ` (as ${impersonatorName})` : ''}. Actions are
          performed as this user.
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="border-warning bg-background text-foreground hover:bg-warning-background"
        onClick={() => stopImpersonation()}
      >
        Return to your account
      </Button>
    </div>
  );
}
