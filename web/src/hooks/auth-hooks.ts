import {useAuth} from '@/context/auth-provider';
import {Action, isAuthorized} from '@faims3/data-model';
import {useMemo} from 'react';

/**
 * A simple custom hook which returns whether the user can do the thing, and
 * re-renders if token changes. Applies to the active user.
 */
export const useIsAuthorisedTo = ({
  action,
  resourceId,
}: {
  action: Action;
  resourceId?: string;
}): boolean => {
  const {user} = useAuth();

  console.log('Checking auth with input: ', {action, resourceId});
  console.log('User: ', {user});

  if (!user || !user.decodedToken) {
    console.log('User or decoded token not defined');
    return false;
  }

  return useMemo(
    () =>
      isAuthorized({
        decodedToken: user.decodedToken!,
        action,
        resourceId,
      }),
    [action, resourceId, user.token]
  );
};
