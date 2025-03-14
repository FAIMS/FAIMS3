import {canPerformAction, roleGrantsAction} from './helpers';
import {Action, actionDetails} from './model';
import {decodeAndValidateToken, EncodedTokenPermissions} from './tokenEncoding';

/**
 * Determines if a token authorizes an action on a resource
 * Handles both resource-specific permissions and global permissions
 */
export function isAuthorized(
  token: EncodedTokenPermissions,
  action: Action,
  resourceId?: string
): boolean {
  try {
    // Firstly - decode and validate token
    const decodedToken = decodeAndValidateToken(token);

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
