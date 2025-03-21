import {rangeRight} from 'lodash';
import {resourceRolesEqual, roleGrantsAction} from './helpers';
import {Action, actionDetails, Role} from './model';
import {
  decodeAndValidateToken,
  DecodedTokenPermissions,
  encodeClaim,
  ResourceRole,
  TokenPermissions,
} from './tokenEncoding';

/**
 * Determines if a token authorizes an action on a resource
 * Handles both resource-specific permissions and global permissions
 */
export function isTokenAuthorized({
  token,
  action,
  resourceId,
}: {
  token: TokenPermissions;
  action: Action;
  resourceId?: string;
}): boolean {
  try {
    // Firstly - decode and validate token
    const decodedToken = decodeAndValidateToken(token);
    return isAuthorized({decodedToken, action, resourceId});
  } catch (error: any) {
    // Log the error for debugging/auditing
    console.error(
      `Authorization failed due to token validation error: ${error.message ?? 'Unknown'}.`
    );
    // Always fail closed (deny access) when there's an error
    return false;
  }
}

/**
 * Determines if a token authorizes an action on a resource
 * Handles both resource-specific permissions and global permissions
 */
export function isAuthorized({
  decodedToken,
  action,
  resourceId,
}: {
  decodedToken: DecodedTokenPermissions;
  action: Action;
  resourceId?: string;
}): boolean {
  try {
    // Check if this action needs a resource id
    const actionInfo = actionDetails[action];

    // No resource ID provided for an action which is specific to a resource!
    if (actionInfo.resourceSpecific && resourceId === undefined) {
      return false;
    }

    // If this is a non resource specific action, then resource permissions and
    // resource roles are irrelevant - just check general roles. If none provide it, abort.
    if (!actionInfo.resourceSpecific) {
      // Check if any role grants this action in the global scope
      return roleGrantsAction({roles: decodedToken.globalRoles, action});
    }

    // So this is a resource specific action - this can be granted through
    // a) global roles which grant a permission granting this action
    // b) per resource roles which grant a permission granting this action
    // c) per resource permissions granting this action

    // a) global roles which grant a permission granting this action
    if (roleGrantsAction({roles: decodedToken.globalRoles, action})) {
      return true;
    }

    // b) per resource roles which grant a permission granting this action
    for (const resourceRole of decodedToken.resourceRoles) {
      // Only consider if the resource IDs match
      if (resourceRole.resourceId === resourceId) {
        // If this role grants the action - proceed!
        if (roleGrantsAction({roles: [resourceRole.role], action})) {
          return true;
        }
      }
    }

    // Nothing grants this action - no!
    return false;
  } catch (error: any) {
    // Log the error for debugging/auditing
    console.error(
      `Authorization failed due to token validation error: ${error.message ?? 'Unknown'}.`
    );
    // Always fail closed (deny access) when there's an error
    return false;
  }
}

export function hasResourceRole({
  resourceRoles,
  needs,
  resourceId,
}: {
  resourceRoles: ResourceRole[];
  needs: Role;
  resourceId: string;
}) {
  return resourceRoles.some(r =>
    resourceRolesEqual(r, {resourceId, role: needs})
  );
}

// Maps a add/remove role -> action needed to do that
export function projectRoleToAction({
  add,
  role,
}: {
  add: boolean;
  role: Role;
}): Action {
  // Trying to add a role is a specific action for each role level
  let actionNeeded = undefined;
  if (role === Role.PROJECT_ADMIN) {
    if (add) {
      actionNeeded = Action.ADD_ADMIN_TO_PROJECT;
    } else {
      actionNeeded = Action.REMOVE_ADMIN_FROM_PROJECT;
    }
  } else if (role === Role.PROJECT_MANAGER) {
    if (add) {
      actionNeeded = Action.ADD_MANAGER_TO_PROJECT;
    } else {
      actionNeeded = Action.REMOVE_MANAGER_FROM_PROJECT;
    }
  } else if (role === Role.PROJECT_CONTRIBUTOR) {
    if (add) {
      actionNeeded = Action.ADD_CONTRIBUTOR_TO_PROJECT;
    } else {
      actionNeeded = Action.REMOVE_CONTRIBUTOR_FROM_PROJECT;
    }
  } else if (role === Role.PROJECT_GUEST) {
    if (add) {
      actionNeeded = Action.ADD_GUEST_TO_PROJECT;
    } else {
      actionNeeded = Action.REMOVE_GUEST_FROM_PROJECT;
    }
  }

  if (!actionNeeded) {
    throw Error('Could not find suitable action for this role change!');
  }

  return actionNeeded;
}

// Maps a create invite -> action needed to do that
export function projectInviteToAction({
  action,
  role,
}: {
  action: 'create' | 'delete';
  role: Role;
}): Action {
  // Trying to add a role is a specific action for each role level
  let actionNeeded = undefined;
  if (role === Role.PROJECT_ADMIN) {
    if (action === 'create') {
      actionNeeded = Action.CREATE_ADMIN_PROJECT_INVITE;
    } else {
      actionNeeded = Action.DELETE_ADMIN_PROJECT_INVITE;
    }
  } else if (role === Role.PROJECT_MANAGER) {
    if (action === 'create') {
      actionNeeded = Action.CREATE_MANAGER_PROJECT_INVITE;
    } else {
      actionNeeded = Action.DELETE_MANAGER_PROJECT_INVITE;
    }
  } else if (role === Role.PROJECT_CONTRIBUTOR) {
    if (action === 'create') {
      actionNeeded = Action.CREATE_CONTRIBUTOR_PROJECT_INVITE;
    } else {
      actionNeeded = Action.DELETE_CONTRIBUTOR_PROJECT_INVITE;
    }
  } else if (role === Role.PROJECT_GUEST) {
    if (action === 'create') {
      actionNeeded = Action.CREATE_GUEST_PROJECT_INVITE;
    } else {
      actionNeeded = Action.DELETE_GUEST_PROJECT_INVITE;
    }
  }

  if (!actionNeeded) {
    throw Error('Could not find suitable action for this role change!');
  }

  return actionNeeded;
}
