/**
 * Set of helper functions to check/interact with the user object
 * (PeopleDBFields) in relation to permissions.
 */

import {PeopleDBFields} from '../data_storage';
import {Action, Role} from './model';
import {resourceRolesEqual} from './helpers';
import {roleGrantsAction} from './helpers';
import {ResourceRole} from './tokenEncoding';

// ======
// CHECKS
// ======

/**
 * Checks if a user has a specific global role
 * @param user - User object to check
 * @param role - Role to check for
 * @returns True if the user has the specified global role
 */
export function userHasGlobalRole({
  user,
  role,
}: {
  user: PeopleDBFields;
  role: Role;
}): boolean {
  // Check if the role exists in the user's global roles array
  return user.globalRoles.includes(role);
}

/**
 * Checks if a user has a specific role for a specific resource
 * @param user - User object to check
 * @param resourceRole - Role to check for
 * @param resourceId - ID of the resource to check
 * @returns True if the user has the specified role for the specified resource
 */
export function userHasResourceRole({
  user,
  resourceRole,
  resourceId,
}: {
  user: PeopleDBFields;
  resourceRole: Role;
  resourceId: string;
}): boolean {
  // Create the resource role object to check for
  const roleToCheck: ResourceRole = {
    resourceId,
    role: resourceRole,
  };

  // Check if any resource role matches the specified resource and role
  return user.resourceRoles.some(userRole =>
    resourceRolesEqual(userRole, roleToCheck)
  );
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
 * Gets all resource roles a user has for a specific resource
 * @param user - User object to check
 * @param resourceId - ID of the resource to check roles for
 * @returns Array of Role enums that the user has for the specified resource
 */
export function userResourceRoles({
  user,
  resourceId,
}: {
  user: PeopleDBFields;
  resourceId: string;
}): Role[] {
  // Filter for roles that match the provided resource ID
  // Then map to just the role enum values
  return user.resourceRoles
    .filter(resourceRole => resourceRole.resourceId === resourceId)
    .map(resourceRole => resourceRole.role);
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
  if (userHasGlobalRole({user, role})) {
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
