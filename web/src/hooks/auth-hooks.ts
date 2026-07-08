import {isUserExpired, useAuth, User} from '@/context/auth-provider';
import {
  Action,
  getUserResourcesForAction,
  isAuthorized,
  Role,
} from '@faims3/data-model';
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
 * True when the user may create a template either globally (`CREATE_TEMPLATE`)
 * or in at least one team (`CREATE_TEMPLATE_IN_TEAM`).
 *
 * Does not require team membership — global creators with zero teams still
 * return true, matching the API permission model.
 */
export const userCanCreateTemplate = (user: User | null): boolean => {
  if (!user?.decodedToken) {
    return false;
  }
  return (
    isAuthorized({
      decodedToken: user.decodedToken,
      action: Action.CREATE_TEMPLATE,
    }) ||
    getUserResourcesForAction({
      decodedToken: user.decodedToken,
      action: Action.CREATE_TEMPLATE_IN_TEAM,
    }).length > 0
  );
};

/**
 * Hook wrapper for {@link userCanCreateTemplate}. Re-renders when the auth
 * token changes.
 */
export const useCanCreateTemplate = (): boolean => {
  const {user, isExpired} = useAuth();

  if (!user || isExpired()) {
    return false;
  }

  return useMemo(() => userCanCreateTemplate(user), [user.token]);
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
  const {user} = useAuth();

  return useMemo(() => {
    if (!user || isUserExpired(user) || user.decodedToken == null) {
      return false;
    }
    return userCanDo({
      user,
      action,
      resourceId,
    });
  }, [action, resourceId, user?.token, user?.decodedToken]);
};
