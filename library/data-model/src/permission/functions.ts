import {COUCH_ADMIN_ROLE_NAME} from '../constants';
import {roleGrantsAction} from './helpers';
import {
  Action,
  actionDetails,
  actionRoles,
  Resource,
  Role,
  roleActions,
  roleDetails,
  RoleScope,
} from './model';
import {decodeAndValidateToken, encodeClaim} from './tokenEncoding';
import {TokenPermissions, DecodedTokenPermissions, ResourceRole} from './types';

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
 * What resources does this user have permission for with a resource-specific
 * action?
 */
export function getUserResourcesForAction({
  decodedToken,
  action,
}: {
  decodedToken: DecodedTokenPermissions;
  action: Action;
}): Array<string> {
  const authorizedResources: Array<string> = [];

  // Check resource-specific roles for access
  for (const resourceRole of decodedToken.resourceRoles) {
    if (
      resourceRole.resourceId &&
      roleGrantsAction({roles: [resourceRole.role], action})
    ) {
      authorizedResources.push(resourceRole.resourceId);
    }
  }

  return authorizedResources;
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
 * Maps a create/delete invite operation to the corresponding action needed
 * for teams
 * @param action Whether this is a create or delete operation
 * @param role The role level for the invitation
 * @returns The action needed to perform this operation
 */
export function teamInviteToAction({
  action,
  role,
}: {
  action: 'create' | 'delete';
  role: Role;
}): Action {
  // Trying to add a role is a specific action for each role level
  let actionNeeded = undefined;
  if (role === Role.TEAM_ADMIN) {
    if (action === 'create') {
      actionNeeded = Action.CREATE_ADMIN_TEAM_INVITE;
    } else {
      actionNeeded = Action.DELETE_ADMIN_TEAM_INVITE;
    }
  } else if (role === Role.TEAM_MANAGER) {
    if (action === 'create') {
      actionNeeded = Action.CREATE_MANAGER_TEAM_INVITE;
    } else {
      actionNeeded = Action.DELETE_MANAGER_TEAM_INVITE;
    }
  } else if (role === Role.TEAM_MEMBER) {
    if (action === 'create') {
      actionNeeded = Action.CREATE_MEMBER_TEAM_INVITE;
    } else {
      actionNeeded = Action.DELETE_MEMBER_TEAM_INVITE;
    }
  }

  if (!actionNeeded) {
    throw Error('Could not find suitable action for this role change!');
  }

  return actionNeeded;
}

/**
 * Maps a role and operation to the corresponding action
 * @param role The role being modified
 * @param add Whether adding (true) or removing (false)
 * @returns The corresponding permission action
 */
export function getTeamMembershipAction(role: Role, add: boolean): Action {
  switch (role) {
    case Role.TEAM_ADMIN:
      return add ? Action.ADD_ADMIN_TO_TEAM : Action.REMOVE_ADMIN_FROM_TEAM;
    case Role.TEAM_MANAGER:
      return add ? Action.ADD_MANAGER_TO_TEAM : Action.REMOVE_MANAGER_FROM_TEAM;
    case Role.TEAM_MEMBER:
      return add ? Action.ADD_MEMBER_TO_TEAM : Action.REMOVE_MEMBER_FROM_TEAM;
    default:
      throw new Error(`Invalid team role: ${role}`);
  }
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
export interface ResourceAssociation {
  // The resource that has the association (e.g., a team)
  resource: ResourceIdentifier;
  // Resources associated with this resource (e.g., projects owned by the team)
  associatedResources: ResourceIdentifier[];
}

/**
 * Generates virtual resource roles for a user based on their existing roles and
 * resource associations
 *
 * @param decodedToken The user's decoded token with their actual roles
 * @param resourceAssociations Mapping of resources to their associated resources
 * @returns Array of virtual resource roles that should be added
 */
export function generateVirtualResourceRoles({
  resourceRoles,
  resourceAssociations,
}: {
  resourceRoles: ResourceRole[];
  resourceAssociations: ResourceAssociation[];
}): ResourceRole[] {
  // Use a Map to track virtual roles with effective deduplication
  // Map key is 'resourceId:role' to ensure uniqueness
  const virtualRolesMap = new Map<string, ResourceRole>();

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

    // Find matching associations (there can be multiple such associations so
    // concat the list!)
    for (const association of resourceAssociations) {
      if (
        association.resource.resourceType === resourceType &&
        association.resource.resourceId === resourceId
      ) {
        applicableResources = applicableResources.concat(
          association.associatedResources
        );
      }
    }

    // Generate virtual roles for applicable resources
    for (const {resourceId, resourceType} of applicableResources) {
      if (roleConfig.virtualRoles.has(resourceType)) {
        // Get the roles this grants for this resource type
        const grantedRoles = roleConfig.virtualRoles.get(resourceType)!;

        // Add each granted role to the map (unless a higher role already exists)
        for (const grantedRole of grantedRoles) {
          const mapKey = `${resourceId}:${grantedRole}`;

          // If we haven't seen this resource+role combination yet, add it
          if (!virtualRolesMap.has(mapKey)) {
            virtualRolesMap.set(mapKey, {resourceId, role: grantedRole});
          }
        }
      }
    }
  }

  // Process resource-specific roles
  for (const resourceRole of resourceRoles) {
    const details = roleDetails[resourceRole.role];
    if (!details.resource) {
      // This role is not resource specific - skip
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

  // Return the unique values from the Map
  return Array.from(virtualRolesMap.values());
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
    resourceRoles: decodedToken.resourceRoles,
    resourceAssociations,
  });

  return {
    ...decodedToken,
    resourceRoles: [...decodedToken.resourceRoles, ...virtualRoles],
  };
}

/**
 * From a given ACTION, reverse looks up roles which grant that action,
 * and then encodes both the resource specific version i.e. <resource Id> ||
 * <role> and the global version <role> implying that either is
 * suitable for CouchDB authorization
 *
 * @returns list of roles to be used in couch db security documents
 */
export function necessaryActionToCouchRoleList({
  action,
  resourceId,
}: {
  action: Action;
  resourceId: string;
}): string[] {
  const roles: string[] = [];

  // Get all roles that can perform this action
  const rolesForAction = actionRoles[action];

  rolesForAction.forEach(role => {
    const details = roleDetails[role];

    // For global roles, just use the role name
    if (details.scope === RoleScope.GLOBAL) {
      roles.push(role);
    }

    // For resource-specific roles, encode with resourceId
    else {
      roles.push(
        encodeClaim({
          resourceId,
          claim: role,
        })
      );
    }
  });
  // Finally, add the global admin role
  roles.push(COUCH_ADMIN_ROLE_NAME);
  return roles;
}
