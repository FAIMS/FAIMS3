/**
 * Set of helper functions to check/interact with the user object
 * (PeopleDBFields) in relation to roles and actions.
 */

import {PeopleDBFields} from '../data_storage';
import {Action, Resource, Role, roleDetails, RoleScope} from './model';
import {drillRoles, roleGrantsAction} from './helpers';
import {ResourceRole} from './tokenEncoding';

// ======
// CHECKS
// ======

/**
 * Checks if a user has a specific global role, considering role inheritance
 * @param user - User object to check
 * @param role - Role to check for
 * @returns True if the user has the specified global role or any role that grants it
 */
export function userHasGlobalRole({
  user,
  role,
  drill = true,
}: {
  user: PeopleDBFields;
  role: Role;
  drill?: boolean;
}): boolean {
  // Check each of the user's global roles
  for (const userRole of user.globalRoles) {
    // Get all roles granted by this user role (including the role itself)
    const grantedRoles = drill ? drillRoles({role: userRole}) : [userRole];
    // If the target role is in the granted roles, return true
    if (grantedRoles.includes(role)) {
      return true;
    }
  }

  // If we get here, none of the user's roles grant the target role
  return false;
}

/**
 * Checks if a user has a specific role for a specific resource, considering role inheritance
 * @param user - User object to check
 * @param resourceRole - Role to check for
 * @param resourceId - ID of the resource to check
 * @returns True if the user has the specified role or any role that grants it for the specified resource
 */
export function userHasResourceRole({
  user,
  resourceRole,
  resourceId,
  drill = true,
}: {
  user: PeopleDBFields;
  resourceRole: Role;
  resourceId: string;
  drill?: boolean;
}): boolean {
  // First check if any global role grants this resource role
  if (userHasGlobalRole({user, role: resourceRole, drill})) {
    return true;
  }

  // Check each of the user's resource roles for this specific resource
  for (const userResourceRole of user.resourceRoles) {
    // Skip roles for different resources
    if (userResourceRole.resourceId !== resourceId) {
      continue;
    }

    // Get all roles granted by this user resource role
    const grantedRoles = drill
      ? drillRoles({role: userResourceRole.role})
      : [userResourceRole.role];

    // If the target role is in the granted roles, return true
    if (grantedRoles.includes(resourceRole)) {
      return true;
    }
  }

  // If we get here, none of the user's roles grant the target role for this resource
  return false;
}

/**
 * Determines if a user can perform a specific action, optionally on a specific resource
 * @param user - User object to check
 * @param action - Action to check permission for
 * @param resourceId - Optional ID of the resource for resource-specific actions
 * @returns True if the user can perform the specified action
 */
export function userCanDo({
  user,
  action,
  resourceId,
}: {
  user: PeopleDBFields;
  action: Action;
  resourceId?: string;
}): boolean {
  // First check if any global role grants this action
  if (roleGrantsAction({roles: user.globalRoles, action})) {
    return true;
  }

  // If this is a resource-specific action and we have a resource ID
  if (resourceId) {
    // Filter for roles specific to this resource
    const relevantResourceRoles = user.resourceRoles
      .filter(role => role.resourceId === resourceId)
      .map(resourceRole => resourceRole.role);

    // Check if any of these resource-specific roles grant the action
    if (roleGrantsAction({roles: relevantResourceRoles, action})) {
      return true;
    }
  }

  // If we get here, the user cannot perform the action
  return false;
}

/**
 * Gets all resource roles a user has for a specific resource, including roles
 * granted through inheritance
 * @param user - User object to check
 * @param resourceId - ID of the resource to check roles for
 * @param resource - Specify the resource type so that global roles can be
 * properly handled
 * @returns Array of Role enums that the user has for the specified resource
 */
export function userResourceRoles({
  user,
  resourceId,
  resource,
}: {
  user: PeopleDBFields;
  resourceId: string;
  resource: Resource;
}): Role[] {
  // Set to track all granted roles without duplicates
  const allRolesSet = new Set<Role>();

  // Process explicitly granted resource roles
  const explicitlyGranted = user.resourceRoles
    .filter(resourceRole => resourceRole.resourceId === resourceId)
    .map(resourceRole => resourceRole.role);

  // Add each explicitly granted role and all roles it grants
  for (const role of explicitlyGranted) {
    drillRoles({role}).forEach(grantedRole => allRolesSet.add(grantedRole));
  }

  // Process global roles that apply to this resource type
  const applicableGlobalRoles = user.globalRoles.filter(r => {
    const details = roleDetails[r];
    return (
      (details.scope === RoleScope.RESOURCE_SPECIFIC &&
        details.resource === resource) ||
      // Include roles that might grant applicable resource-specific roles
      details.scope === RoleScope.GLOBAL
    );
  });

  // Add each applicable global role and all roles it grants
  for (const role of applicableGlobalRoles) {
    drillRoles({role})
      .filter(grantedRole => {
        // Only include resource-specific roles for this resource type
        const details = roleDetails[grantedRole];
        return (
          details.scope === RoleScope.RESOURCE_SPECIFIC &&
          details.resource === resource
        );
      })
      .forEach(grantedRole => allRolesSet.add(grantedRole));
  }

  return Array.from(allRolesSet);
}

// =======
// CHANGES
// =======

/**
 * Adds a resource role to a user
 * @param user - User object to modify
 * @param role - Role to add
 * @param resourceId - ID of the resource for the role
 */
export function addResourceRole({
  user,
  role,
  resourceId,
}: {
  user: PeopleDBFields;
  role: Role;
  resourceId: string;
}) {
  // Check if the user already has this role for this resource
  const hasRole = userHasResourceRole({
    user,
    resourceRole: role,
    resourceId,
    drill: false,
  });

  // If the user already has this role, return the unchanged user object
  if (hasRole) {
    return;
  }

  // Create a new resource role
  const newResourceRole: ResourceRole = {
    resourceId,
    role,
  };

  user.resourceRoles = [...user.resourceRoles, newResourceRole];
}

/**
 * Removes a resource role from a user
 * @param user - User object to modify
 * @param role - Role to remove
 * @param resourceId - ID of the resource for the role
 */
export function removeResourceRole({
  user,
  role,
  resourceId,
}: {
  user: PeopleDBFields;
  role: Role;
  resourceId: string;
}) {
  // Create the resource role object to remove
  const roleToRemove: ResourceRole = {
    resourceId,
    role,
  };

  // Filter out the role we want to remove
  const updatedResourceRoles = user.resourceRoles.filter(
    userRole => !resourceRolesEqual(userRole, roleToRemove)
  );

  // Return a new user object with the updated resource roles
  user.resourceRoles = updatedResourceRoles;
}

/**
 * Adds a global role to a user
 * @param user - User object to modify
 * @param role - Global role to add
 */
export function addGlobalRole({
  user,
  role,
}: {
  user: PeopleDBFields;
  role: Role;
}) {
  // Check if the user already has this global role
  if (userHasGlobalRole({user, role, drill: false})) {
    // If so, return the unchanged user object
    return;
  }

  user.globalRoles = [...user.globalRoles, role];
}

/**
 * Removes a global role from a user
 * @param user - User object to modify
 * @param role - Global role to remove
 */
export function removeGlobalRole({
  user,
  role,
}: {
  user: PeopleDBFields;
  role: Role;
}) {
  // Filter out the role we want to remove
  const updatedGlobalRoles = user.globalRoles.filter(
    globalRole => globalRole !== role
  );

  user.globalRoles = updatedGlobalRoles;
}

/**
 * Add emails to a user's emails array if they don't already exist
 * @param user - User object to modify
 * @param emails - Emails to add
 */
export function addEmails({
  user,
  emails,
}: {
  user: PeopleDBFields;
  emails: string[];
}) {
  // Filter out emails that already exist in the user's emails array
  const newEmails = emails.filter(email => !user.emails.includes(email));

  // If no new emails to add, return user unchanged
  if (newEmails.length === 0) {
    return;
  }

  // Return updated user with new emails added
  user.emails = [...user.emails, ...newEmails];
}

/**
 * Helper function for comparing resource roles
 */
export function resourceRolesEqual(a: ResourceRole, b: ResourceRole): boolean {
  return a.resourceId === b.resourceId && a.role === b.role;
}
