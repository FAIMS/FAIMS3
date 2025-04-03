/**
 * Set of helper functions to check/interact with the user object
 * (PeopleDBDocument) in relation to roles and actions.
 */

import {generateVirtualResourceRoles, ResourceAssociation} from '..';
import {PeopleDBDocument} from '../data_storage';
import {Role} from './model';
import {encodeToken, ResourceRole, TokenPermissions} from './tokenEncoding';

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
  user: PeopleDBDocument;
  role: Role;
}): boolean {
  return user.globalRoles.includes(role);
}

/**
 * Checks if a user has a specific role for a specific project
 * @param user - User object to check
 * @param role - Role to check for
 * @param projectId - ID of the project to check
 * @returns True if the user has the specified project role
 */
export function userHasProjectRole({
  user,
  role,
  projectId,
}: {
  user: PeopleDBDocument;
  role: Role;
  projectId: string;
}): boolean {
  return user.projectRoles.some(
    r => r.resourceId === projectId && r.role === role
  );
}

/**
 * Checks if a user has a specific role for a specific team
 * @param user - User object to check
 * @param role - Role to check for
 * @param teamId - ID of the team to check
 * @returns True if the user has the specified team role
 */
export function userHasTeamRole({
  user,
  role,
  teamId,
}: {
  user: PeopleDBDocument;
  role: Role;
  teamId: string;
}): boolean {
  return user.teamRoles.some(r => r.resourceId === teamId && r.role === role);
}

export function userProjectRoles({
  user,
  projectId,
}: {
  user: PeopleDBDocument;
  projectId: string;
}): Role[] {
  return user.projectRoles
    .filter(r => r.resourceId === projectId)
    .map(r => r.role);
}

export function userTeamRoles({
  user,
  teamId,
}: {
  user: PeopleDBDocument;
  teamId: string;
}): Role[] {
  return user.teamRoles.filter(r => r.resourceId === teamId).map(r => r.role);
}

// ============
// ROLE UPDATES
// ============

/**
 * Adds a project role to a user
 * @param user - User object to modify
 * @param role - Role to add
 * @param projectId - ID of the project for the role
 */
export function addProjectRole({
  user,
  role,
  projectId,
}: {
  user: PeopleDBDocument;
  role: Role;
  projectId: string;
}): void {
  // Check if the user already has this role for this project
  const hasRole = userHasProjectRole({
    user,
    role,
    projectId,
  });

  // If the user already has this role, return
  if (hasRole) {
    return;
  }

  // Create a new project role and add it to the user
  const newProjectRole: ResourceRole = {
    resourceId: projectId,
    role,
  };

  user.projectRoles = [...user.projectRoles, newProjectRole];
}

/**
 * Removes a project role from a user
 * @param user - User object to modify
 * @param role - Role to remove
 * @param projectId - ID of the project for the role
 */
export function removeProjectRole({
  user,
  role,
  projectId,
}: {
  user: PeopleDBDocument;
  role: Role;
  projectId: string;
}): void {
  // Filter out the role we want to remove using resourceRolesEqual helper
  const roleToRemove: ResourceRole = {resourceId: projectId, role};
  user.projectRoles = user.projectRoles.filter(
    projectRole => !resourceRolesEqual(projectRole, roleToRemove)
  );
}

/**
 * Adds a team role to a user
 * @param user - User object to modify
 * @param role - Role to add
 * @param teamId - ID of the team for the role
 */
export function addTeamRole({
  user,
  role,
  teamId,
}: {
  user: PeopleDBDocument;
  role: Role;
  teamId: string;
}): void {
  // Check if the user already has this role for this team
  const hasRole = userHasTeamRole({
    user,
    role,
    teamId,
  });

  // If the user already has this role, return
  if (hasRole) {
    return;
  }

  // Create a new team role and add it to the user
  const newTeamRole: ResourceRole = {
    resourceId: teamId,
    role,
  };

  user.teamRoles = [...user.teamRoles, newTeamRole];
}

/**
 * Removes a team role from a user
 * @param user - User object to modify
 * @param role - Role to remove
 * @param teamId - ID of the team for the role
 */
export function removeTeamRole({
  user,
  role,
  teamId,
}: {
  user: PeopleDBDocument;
  role: Role;
  teamId: string;
}): void {
  // Filter out the role we want to remove using resourceRolesEqual helper
  const roleToRemove: ResourceRole = {resourceId: teamId, role};
  user.teamRoles = user.teamRoles.filter(
    teamRole => !resourceRolesEqual(teamRole, roleToRemove)
  );
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
  user: PeopleDBDocument;
  role: Role;
}): void {
  // Check if the user already has this global role
  if (userHasGlobalRole({user, role})) {
    // If so, return
    return;
  }

  // Add the global role to the user
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
  user: PeopleDBDocument;
  role: Role;
}): void {
  // Filter out the role we want to remove
  user.globalRoles = user.globalRoles.filter(globalRole => globalRole !== role);
}

// TEMPLATE ROLES
// ==============

/**
 * Checks if a user has a specific role for a specific template
 * @param user - User object to check
 * @param role - Role to check for
 * @param templateId - ID of the template to check
 * @returns True if the user has the specified template role
 */
export function userHasTemplateRole({
  user,
  role,
  templateId,
}: {
  user: PeopleDBDocument;
  role: Role;
  templateId: string;
}): boolean {
  return user.templateRoles.some(
    r => r.resourceId === templateId && r.role === role
  );
}

/**
 * Gets all roles a user has for a specific template
 * @param user - User object to check
 * @param templateId - ID of the template to check
 * @returns Array of roles the user has for the specified template
 */
export function userTemplateRoles({
  user,
  templateId,
}: {
  user: PeopleDBDocument;
  templateId: string;
}): Role[] {
  return user.templateRoles
    .filter(r => r.resourceId === templateId)
    .map(r => r.role);
}

/**
 * Adds a template role to a user
 * @param user - User object to modify
 * @param role - Role to add
 * @param templateId - ID of the template for the role
 */
export function addTemplateRole({
  user,
  role,
  templateId,
}: {
  user: PeopleDBDocument;
  role: Role;
  templateId: string;
}): void {
  // Check if the user already has this role for this template
  const hasRole = userHasTemplateRole({
    user,
    role,
    templateId,
  });

  // If the user already has this role, return
  if (hasRole) {
    return;
  }

  // Create a new template role and add it to the user
  const newTemplateRole: ResourceRole = {
    resourceId: templateId,
    role,
  };

  user.templateRoles = [...user.templateRoles, newTemplateRole];
}

/**
 * Removes a template role from a user
 * @param user - User object to modify
 * @param role - Role to remove
 * @param templateId - ID of the template for the role
 */
export function removeTemplateRole({
  user,
  role,
  templateId,
}: {
  user: PeopleDBDocument;
  role: Role;
  templateId: string;
}): void {
  // Filter out the role we want to remove using resourceRolesEqual helper
  const roleToRemove: ResourceRole = {resourceId: templateId, role};
  user.templateRoles = user.templateRoles.filter(
    templateRole => !resourceRolesEqual(templateRole, roleToRemove)
  );
}

// =============
// OTHER UPDATES
// =============

/**
 * Add emails to a user's emails array if they don't already exist
 * @param user - User object to modify
 * @param emails - Emails to add
 */
export function addEmails({
  user,
  emails,
}: {
  user: PeopleDBDocument;
  emails: string[];
}): void {
  // Filter out emails that already exist in the user's emails array
  const newEmails = emails.filter(email => !user.emails.includes(email));

  // If no new emails to add, return
  if (newEmails.length === 0) {
    return;
  }

  // Add new emails to user
  user.emails = [...user.emails, ...newEmails];
}

/**
 * Helper function for comparing resource roles
 */
export function resourceRolesEqual(a: ResourceRole, b: ResourceRole): boolean {
  return a.resourceId === b.resourceId && a.role === b.role;
}

// ===============
// ENCODING HELPER
// ===============

/**
 * Takes a couch user and associations (e.g. this team owns these projects) and
 * returns a compiled list of resource roles
 * @returns a compiled list of resource roles
 */
export function couchUserToResourceRoles({
  user: {projectRoles, teamRoles, templateRoles},
  relevantAssociations,
}: {
  user: PeopleDBDocument;
  relevantAssociations: ResourceAssociation[];
}): ResourceRole[] {
  // Collapse the project and team roles into one set
  const allResourceRoles = [...projectRoles, ...teamRoles, ...templateRoles];

  // Need to drill teams virtual roles
  const virtualRoles = generateVirtualResourceRoles({
    resourceRoles: allResourceRoles,
    resourceAssociations: relevantAssociations,
  });

  // And build it into resource roles list
  return allResourceRoles.concat(virtualRoles);
}

/**
 * Takes a couch user and builds an encoded token.
 *
 * This is achieved by first building a decoded token object from the couch
 * user, then using the encode token function to encode it.
 *
 * @returns encoded token object (to be signed/added other details)
 */
export function expressUserToTokenPermissions({
  user,
}: {
  user: PeopleDBDocument & {resourceRoles: ResourceRole[]};
}): TokenPermissions {
  // Now encode - this just propagates global roles -> resource roles and encodes resource roles nicely
  return encodeToken({
    globalRoles: user.globalRoles,
    resourceRoles: user.resourceRoles,
  });
}
