import {ResourceRole} from '..';
import {
  Action,
  Role,
  roleActions,
  getAllActionsForRole,
  actionRoles,
} from './model';

/**
 * Helper function to check if an action can be performed based on assigned roles
 * @param roles Array of roles that have been assigned
 * @param action The action to check
 * @returns Boolean indicating if the action is allowed
 */
export function canPerformAction({
  roles,
  action,
}: {
  roles: Role[];
  action: Action;
}): boolean {
  // Get roles that allow this action
  const sufficientRoles = actionRoles[action];
  // Check if any of the assigned roles allow this action
  return sufficientRoles.some(role => roles.includes(role));
}

// Cache for drilled-down roles
const roleDrillCache = new Map<Role, Role[]>();

/**
 * Given a role, drills into all roles that it grants. This includes both
 * direct roles and those granted through inheritance
 * @param role The role to analyze
 * @returns Array of all roles granted by this role (including itself)
 */
export function drillRoles({role}: {role: Role}): Role[] {
  // Check cache first
  if (roleDrillCache.has(role)) {
    return roleDrillCache.get(role)!;
  }

  // Set to track unique roles (avoid duplicates)
  const roleSet = new Set<Role>();

  // Always include the original role
  roleSet.add(role);

  // Helper function to recursively collect roles
  function collectRolesFromRole(
    currentRole: Role,
    visitedRoles: Set<Role> = new Set()
  ): void {
    // Prevent infinite recursion from circular role references
    if (visitedRoles.has(currentRole)) {
      return;
    }

    // Mark this role as visited
    visitedRoles.add(currentRole);

    // Skip if the role doesn't exist in our mapping
    if (!(currentRole in roleActions)) {
      return;
    }

    const {inheritedRoles} = roleActions[currentRole];

    // Recursively collect roles from inherited roles
    if (inheritedRoles) {
      inheritedRoles.forEach(grantedRole => {
        roleSet.add(grantedRole);
        collectRolesFromRole(grantedRole, visitedRoles);
      });
    }
  }

  // Start the collection process
  collectRolesFromRole(role);

  // Convert set back to array
  const roles = Array.from(roleSet);

  // Cache the result
  roleDrillCache.set(role, roles);

  return roles;
}

// Clear cache if needed
export function clearRoleDrillCache(): void {
  roleDrillCache.clear();
}

// Cache for drilled-down actions
const roleActionsCache = new Map<Role, Action[]>();

/**
 * Given a role, returns all actions that it can perform, including those
 * from inherited roles
 * @param role The role to analyze
 * @returns Array of all actions granted by this role
 */
export function drillRoleActions({role}: {role: Role}): Action[] {
  // Check cache first
  if (roleActionsCache.has(role)) {
    return roleActionsCache.get(role)!;
  }

  const actions = getAllActionsForRole(role);

  // Cache the result
  roleActionsCache.set(role, actions);

  return actions;
}

/**
 * Checks if any of the roles in the user's roles can perform the specified action
 * @param roles Array of roles the user has
 * @param action The action to check
 * @returns Boolean indicating if the action is allowed
 */
export function roleGrantsAction({
  roles,
  action,
}: {
  roles: Role[];
  action: Action;
}): boolean {
  for (const role of roles) {
    const actions = drillRoleActions({role});
    if (actions.includes(action)) {
      return true;
    }
  }
  return false;
}

export const resourceRolesEqual = (a: ResourceRole, b: ResourceRole): boolean =>
  a.resourceId === b.resourceId && a.role === b.role;

/**
 * Given a set of roles, returns all actions that can be performed
 * @param roles Array of roles to check
 * @returns Array of all actions granted by these roles
 */
export function getAllActionsForRoles(roles: Role[]): Action[] {
  const actionSet = new Set<Action>();

  roles.forEach(role => {
    drillRoleActions({role}).forEach(action => {
      actionSet.add(action);
    });
  });

  return Array.from(actionSet);
}
