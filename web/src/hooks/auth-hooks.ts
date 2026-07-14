import {isUserExpired, useAuth, User} from '@/context/auth-provider';
import {
  Action,
  getUserResourcesForAction,
  isAuthorized,
  Role,
} from '@faims3/data-model';
import {useMemo} from 'react';

/**
 * Returns the authenticated user, asserting it is present.
 *
 * Every route under `_protected` renders `SessionExpiredOverlay` instead of
 * the `<Outlet />` when the user is null or expired, so components below that
 * layout can never render without a user. This hook exists so those
 * components can take a non-null `User` directly instead of each hand-rolling
 * an `if (!user)` guard (dead code that also forces hooks-ordering gymnastics
 * under `react/rules-of-hooks`).
 *
 * @throws If called outside an authenticated route — a programming error, not
 *   a reachable user state.
 */
export const useRequiredUser = (): User => {
  const {user} = useAuth();
  if (!user) {
    throw new Error(
      'useRequiredUser rendered without an authenticated user. It must only be used under the _protected route layout.'
    );
  }
  return user;
};

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

  return useMemo(() => {
    if (!user || isExpired()) {
      return false;
    }
    return userCanCreateTemplate(user);
  }, [user, user?.token, isExpired()]);
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
