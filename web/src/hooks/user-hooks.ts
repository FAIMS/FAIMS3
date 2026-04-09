import {useAuth, type User} from '@/context/auth-provider';
import {useMutation, useQueryClient} from '@tanstack/react-query';

function errorMessageFromUserJsonBody(
  json: unknown,
  fallbackStatusText: string
): string {
  if (
    json &&
    typeof json === 'object' &&
    json !== null &&
    'error' in json &&
    typeof (json as {error?: {message?: unknown}}).error?.message === 'string'
  ) {
    return (json as {error: {message: string}}).error.message;
  }
  return fallbackStatusText;
}

/**
 * POST /api/users/:targetUserId/disable — soft-disable account (retains data).
 */
export const postDisableUserAccount = async ({
  user,
  targetUserId,
}: {
  user: User;
  targetUserId: string;
}) => {
  const response = await fetch(
    `${import.meta.env.VITE_API_URL}/api/users/${encodeURIComponent(targetUserId)}/disable`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${user.token}`,
      },
    }
  );
  if (response.ok) {
    return;
  }
  const json: unknown = await response.json().catch(() => undefined);
  throw new Error(errorMessageFromUserJsonBody(json, response.statusText));
};

/**
 * POST /api/users/:targetUserId/enable — restore sign-in for a disabled account.
 */
export const postEnableUserAccount = async ({
  user,
  targetUserId,
}: {
  user: User;
  targetUserId: string;
}) => {
  const response = await fetch(
    `${import.meta.env.VITE_API_URL}/api/users/${encodeURIComponent(targetUserId)}/enable`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${user.token}`,
      },
    }
  );
  if (response.ok) {
    return;
  }
  const json: unknown = await response.json().catch(() => undefined);
  throw new Error(errorMessageFromUserJsonBody(json, response.statusText));
};

export function useDisableUserAccount() {
  const queryClient = useQueryClient();
  const {user} = useAuth();

  return useMutation({
    mutationFn: async ({targetUserId}: {targetUserId: string}) => {
      if (!user) {
        throw new Error('Not authenticated');
      }
      await postDisableUserAccount({user, targetUserId});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['users']});
    },
  });
}

export function useEnableUserAccount() {
  const queryClient = useQueryClient();
  const {user} = useAuth();

  return useMutation({
    mutationFn: async ({targetUserId}: {targetUserId: string}) => {
      if (!user) {
        throw new Error('Not authenticated');
      }
      await postEnableUserAccount({user, targetUserId});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['users']});
    },
  });
}
