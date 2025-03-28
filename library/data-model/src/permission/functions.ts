import {resourceRolesEqual, roleGrantsAction} from './helpers';
import {
  Action,
  actionDetails,
  Resource,
  Role,
  roleActions,
  roleDetails,
} from './model';
import {
  decodeAndValidateToken,
  DecodedTokenPermissions,
  ResourceRole,
  TokenPermissions,
} from './tokenEncoding';

/**
 * Determines if a token authorizes an action on a resource
 * Handles both resource-specific actions and global actions
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
 * Handles both resource-specific actions and global actions
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

    // If this is a non resource specific action, then resource roles
    // are irrelevant - just check global roles. If none provided, abort.
    if (!actionInfo.resourceSpecific) {
      // Check if any role grants this action in the global scope
      if (roleGrantsAction({roles: decodedToken.globalRoles, action})) {
        return true;
      }

      // Otherwise, resource specific roles can also grant global actions e.g.
      // being a team manager lets you create projects
      for (const resourceRole of decodedToken.resourceRoles) {
        // If this role grants the action - proceed!
        if (roleGrantsAction({roles: [resourceRole.role], action})) {
          return true;
        }
      }
    }

    // So this is a resource specific action - this can be granted through
    // a) global roles which grant this action
    // b) per resource roles which grant this action

    // a) global roles which grant this action
    if (roleGrantsAction({roles: decodedToken.globalRoles, action})) {
      return true;
    }

    // b) per resource roles which grant this action
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
      `Authorization failed due to processing error: ${error.message ?? 'Unknown'}.`
    );
    // Always fail closed (deny access) when there's an error
    return false;
  }
}

/**
 * Checks if a user has a specific resource role
 * @param resourceRoles The user's resource roles
 * @param needs The role being checked for
 * @param resourceId The specific resource ID
 * @returns True if the user has the specified role for the resource
 */
export function hasResourceRole({
  resourceRoles,
  needs,
  resourceId,
}: {
  resourceRoles: ResourceRole[];
  needs: Role;
  resourceId: string;
}): boolean {
  return resourceRoles.some(r =>
    resourceRolesEqual(r, {resourceId, role: needs})
  );
}

/**
 * Maps a add/remove role operation to the corresponding action needed
 * @param add Whether this is an add operation (true) or remove operation (false)
 * @param role The role being added or removed
 * @returns The action needed to perform this operation
 */
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

/**
 * Maps a create/delete invite operation to the corresponding action needed
 * @param action Whether this is a create or delete operation
 * @param role The role level for the invitation
 * @returns The action needed to perform this operation
 */
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

/**
 * Type definition for a resource identifier
 */
interface ResourceIdentifier {
  resourceId: string;
  resourceType: Resource;
}

/**
 * Type definition for resource associations
 */
interface ResourceAssociation {
  // The resource that has the association (e.g., a team)
  resource: ResourceIdentifier;
  // Resources associated with this resource (e.g., projects owned by the team)
  associatedResources: ResourceIdentifier[];
}

/**
 * Generates virtual resource roles for a user based on their existing roles and
 * resource associations
 */
export function generateVirtualResourceRoles({
  decodedToken,
  resourceAssociations,
}: {
  decodedToken: DecodedTokenPermissions;
  resourceAssociations: ResourceAssociation[];
}): ResourceRole[] {
  // Set to track unique resource roles (avoid duplicates)
  const virtualRolesSet = new Set<string>();
  const virtualRoles: ResourceRole[] = [];

  /**
   * Helper function to process a role and generate virtual roles
   */
  function processRole({
    role,
    resourceId,
    resourceType,
  }: {
    role: Role;
    resourceId: string;
    resourceType: Resource | undefined;
  }): void {
    const roleConfig = roleActions[role];

    // Skip if role doesn't have virtual roles function
    if (!roleConfig.virtualRoles) {
      return;
    }

    // Find applicable resource associations
    let applicableResources: ResourceIdentifier[] = [];

    // Find matching associations
    for (const association of resourceAssociations) {
      if (
        association.resource.resourceType === resourceType &&
        association.resource.resourceId === resourceId
      ) {
        applicableResources = association.associatedResources;
        break;
      }
    }

    // Generate virtual roles for applicable resources
    const generatedRoles = roleConfig.virtualRoles(applicableResources);

    // Add unique virtual roles to the result
    for (const vRole of generatedRoles) {
      const roleKey = `${vRole.resourceId}:${vRole.role}`;
      if (!virtualRolesSet.has(roleKey)) {
        virtualRolesSet.add(roleKey);
        virtualRoles.push(vRole);
      }
    }
  }

  // Currently global roles do not allow virtual roles - they already apply to
  // everything

  // Process resource-specific roles
  for (const resourceRole of decodedToken.resourceRoles) {
    const details = roleDetails[resourceRole.role];
    if (!details.resource) {
      // This role is not resource specific - how can you distribute non
      // resource specific roles to a specific list of resources?
      console.warn(
        'Skipping virtual role distribution for a non resource specific role: ',
        details.name,
        details.description
      );
      continue;
    }
    processRole({
      role: resourceRole.role,
      resourceId: resourceRole.resourceId,
      resourceType: details.resource,
    });
  }

  return virtualRoles;
}

/**
 * Extends a decoded token with virtual roles based on resource associations
 */
export function extendTokenWithVirtualRoles({
  decodedToken,
  resourceAssociations,
}: {
  decodedToken: DecodedTokenPermissions;
  resourceAssociations: ResourceAssociation[];
}): DecodedTokenPermissions {
  const virtualRoles = generateVirtualResourceRoles({
    decodedToken,
    resourceAssociations,
  });

  return {
    ...decodedToken,
    resourceRoles: [...decodedToken.resourceRoles, ...virtualRoles],
  };
}
