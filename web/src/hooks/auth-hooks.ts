import {useAuth, User} from '@/context/auth-provider';
import {Action, isAuthorized, Role} from '@faims3/data-model';
import {useMemo} from 'react';

/**
 * helper to map our user to the isAuthorized user
 */
export const userCanDo = ({
  user,
  action,
  resourceId,
}: {
  user: User;
  action: Action;
  resourceId?: string;
}): boolean => {
  return isAuthorized({
    decodedToken: user.decodedToken!,
    action,
    resourceId,
  });
};

/**
 * helper to map our user to the isAuthorized user
 */
export const webUserHasGlobalRole = ({
  user,
  role,
}: {
  user: User;
  role: Role;
}): boolean => {
  return (user.decodedToken?.globalRoles ?? []).includes(role);
};

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
  const {user, isExpired} = useAuth();

  if (
    // Checks for lack of authentication
    !user ||
    isExpired() ||
    user.decodedToken === null ||
    user.decodedToken === undefined
  ) {
    return false;
  }

  return useMemo(
    () =>
      userCanDo({
        user,
        action,
        resourceId,
      }),
    [action, resourceId, user.token]
  );
};
