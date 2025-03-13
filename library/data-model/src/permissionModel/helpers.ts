import {
  Action,
  actionPermissions,
  Permission,
  Role,
  rolePermissions,
} from './model';

/**
 * Helper function to check if an action can be performed based on granted permissions
 * @param permissions Array of permissions that have been granted
 * @param action The action to check
 * @returns Boolean indicating if the action is allowed
 */
export function canPerformAction({
  permissions,
  action,
}: {
  permissions: Permission[];
  action: Action;
}): boolean {
  // Get permissions that allow this action
  const sufficientPermissions = actionPermissions[action];
  // Check if any of the granted permissions allow this action
  return sufficientPermissions.some(permission =>
    permissions.includes(permission)
  );
}

/**
 * Given a role, drills into all permissions that it grants. This includes both
 * direct permissions and those granted through inherited roles
 * @param role The role to analyze
 * @returns Array of all permissions granted by this role
 */
export function drillRolePermissions({role}: {role: Role}): Permission[] {
  // Set to track unique permissions (avoid duplicates)
  const permissionSet = new Set<Permission>();
  // Helper function to recursively collect permissions from roles
  function collectPermissionsFromRole(
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
    if (!(currentRole in rolePermissions)) {
      return;
    }
    const {permissions, alsoGrants} = rolePermissions[currentRole];
    // Add direct permissions from this role
    permissions.forEach(permission => {
      permissionSet.add(permission);
    });
    // Recursively collect permissions from inherited roles
    if (alsoGrants) {
      alsoGrants.forEach(role => {
        // Only follow global role grants when collecting global permissions
        collectPermissionsFromRole(role, visitedRoles);
      });
    }
  }
  // Start the collection process
  collectPermissionsFromRole(role);
  // Convert set back to array
  return Array.from(permissionSet);
}

/**
 * Checks if any of the permissions in the 'has' array match any permissions
 * in the 'sufficient' array
 * @param sufficient Array of permissions that would be sufficient to grant access
 * @param has Array of permissions that the user/role has
 * @returns Boolean indicating if there's at least one matching permission
 */
export function hasSuitablePermission({
  sufficient,
  has,
}: {
  sufficient: Permission[];
  has: Permission[];
}): boolean {
  return has.some(p => sufficient.includes(p));
}

/**
 * Given a role - determines if this role grants the action.
 *
 * If the role is global in scope, then this refers to all resources.
 *
 * If the role is resource specific, then this refers to the resource for which
 * this role was assigned.
 *
 * @param roles Array of roles to check
 * @param action The action to verify against the roles
 * @returns True iff granted
 */
export function roleGrantsAction({
  roles,
  action,
}: {
  roles: Role[];
  action: Action;
}): boolean {
  const suitablePermissions = actionPermissions[action];
  for (const role of roles) {
    // Find what permissions this role grants
    if (
      hasSuitablePermission({
        has: drillRolePermissions({role}),
        sufficient: suitablePermissions,
      })
    ) {
      return true;
    }
  }
  return false;
}
