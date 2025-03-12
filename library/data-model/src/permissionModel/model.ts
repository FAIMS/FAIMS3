// Define the resources in the system
export enum Resource {
  // Projects/surveys/notebooks in the system
  PROJECT = 'project',
  // Templates in the system
  // TEMPLATE = 'template',
  // Users in the system
  // USER = 'user',
  // Other aspects of the system such as configuration
  // SYSTEM = 'system',
}

export enum Action {
  // PROJECT ACTIONS
  // ===============

  // Read the high details of a project (e.g. description, title etc)
  READ_PROJECT_METADATA,
  // Update the project high level details (e.g. description, title etc)
  UPDATE_PROJECT_DETAILS,
  // Update the UI specification (potential consistency risk)
  UPDATE_PROJECT_UISPEC,
  // Read responses for the project which are mine
  READ_MY_PROJECT_DATA,
  // Read responses for the project which are not mine
  READ_ALL_PROJECT_DATA,
  // Write a new record
  CREATE_PROJECT_DATA,
  // Edit one of my records
  EDIT_MY_PROJECT_DATA,
  // Edit someone elses records
  EDIT_ALL_PROJECT_DATA,
  // Delete one of my records
  DELETE_MY_PROJECT_DATA,
  // Delete someone elses records
  DELETE_ALL_PROJECT_DATA,
  // Change open/closed status
  CHANGE_PROJECT_STATUS,
  // Delete the project
  DELETE_PROJECT,
  // Data export
  EXPORT_PROJECT_DATA,
  // Invitations and sharing
  CREATE_GUEST_PROJECT_INVITE,
  DELETE_GUEST_PROJECT_INVITE,
  CREATE_CONTRIBUTOR_PROJECT_INVITE,
  DELETE_CONTRIBUTOR_PROJECT_INVITE,
  CREATE_MANAGER_PROJECT_INVITE,
  DELETE_MANAGER_PROJECT_INVITE,
  CREATE_ADMIN_PROJECT_INVITE,
  DELETE_ADMIN_PROJECT_INVITE,
}

// Define all permissions in the system
export enum Permission {
  // Project permissions
  PROJECT_METADATA_READ,
  PROJECT_GUEST_CONTRIBUTE,
  PROJECT_CONTRIBUTE,
  PROJECT_MANAGE,
  PROJECT_ADMIN,
}

export enum Role {
  // Global roles
  SYSTEM_ADMIN,

  // Project roles
  PROJECT_GUEST,
  PROJECT_CONTRIBUTOR,
  PROJECT_MANAGER,
  PROJECT_ADMIN,
}

// Map resources to their available actions
export const resourceActions: Record<Resource, Action[]> = {
  [Resource.PROJECT]: [
    Action.READ_PROJECT_METADATA,
    Action.UPDATE_PROJECT_DETAILS,
    Action.UPDATE_PROJECT_UISPEC,
    Action.READ_MY_PROJECT_DATA,
    Action.READ_ALL_PROJECT_DATA,
    Action.CREATE_PROJECT_DATA,
    Action.EDIT_MY_PROJECT_DATA,
    Action.EDIT_ALL_PROJECT_DATA,
    Action.DELETE_MY_PROJECT_DATA,
    Action.DELETE_ALL_PROJECT_DATA,
    Action.CHANGE_PROJECT_STATUS,
    Action.DELETE_PROJECT,
    Action.EXPORT_PROJECT_DATA,
    Action.CREATE_GUEST_PROJECT_INVITE,
    Action.DELETE_GUEST_PROJECT_INVITE,
    Action.CREATE_CONTRIBUTOR_PROJECT_INVITE,
    Action.DELETE_CONTRIBUTOR_PROJECT_INVITE,
    Action.CREATE_ADMIN_PROJECT_INVITE,
    Action.DELETE_ADMIN_PROJECT_INVITE,
  ],
};

// Define global roles (roles not tied to a specific resource)
export const globalRoles: Role[] = [Role.SYSTEM_ADMIN];

// Map resources to their available roles - these are roles which are scoped to
// a specific resource
export const resourceRoles: Record<Resource, Role[]> = {
  [Resource.PROJECT]: [
    Role.PROJECT_GUEST,
    Role.PROJECT_CONTRIBUTOR,
    Role.PROJECT_MANAGER,
    Role.PROJECT_ADMIN,
  ],
};

// Map permissions to the actions they allow on resources, along with
// heirarchical permissions
export const permissionActions: Record<
  Permission,
  {resource: Resource; actions: Action[]; alsoGrants: Permission[]}
> = {
  [Permission.PROJECT_ADMIN]: {
    resource: Resource.PROJECT,
    actions: [
      Action.DELETE_PROJECT,
      Action.CREATE_ADMIN_PROJECT_INVITE,
      Action.DELETE_ADMIN_PROJECT_INVITE,
    ],
    alsoGrants: [Permission.PROJECT_MANAGE],
  },
  [Permission.PROJECT_MANAGE]: {
    resource: Resource.PROJECT,
    actions: [
      // All other invites
      Action.CREATE_MANAGER_PROJECT_INVITE,
      Action.DELETE_MANAGER_PROJECT_INVITE,
      Action.CREATE_CONTRIBUTOR_PROJECT_INVITE,
      Action.DELETE_CONTRIBUTOR_PROJECT_INVITE,
      Action.CREATE_GUEST_PROJECT_INVITE,
      Action.DELETE_GUEST_PROJECT_INVITE,

      // Exporting
      Action.EXPORT_PROJECT_DATA,

      // Project management
      Action.CHANGE_PROJECT_STATUS,
      Action.DELETE_ALL_PROJECT_DATA,
      Action.EDIT_ALL_PROJECT_DATA,
      Action.UPDATE_PROJECT_UISPEC,
      Action.UPDATE_PROJECT_DETAILS,
    ],
    alsoGrants: [Permission.PROJECT_CONTRIBUTE],
  },
  [Permission.PROJECT_CONTRIBUTE]: {
    resource: Resource.PROJECT,
    actions: [
      // Adds reading of all data
      Action.READ_ALL_PROJECT_DATA,
    ],
    alsoGrants: [Permission.PROJECT_GUEST_CONTRIBUTE],
  },
  [Permission.PROJECT_GUEST_CONTRIBUTE]: {
    resource: Resource.PROJECT,
    actions: [
      Action.READ_MY_PROJECT_DATA,
      Action.CREATE_PROJECT_DATA,
      Action.EDIT_MY_PROJECT_DATA,
      Action.DELETE_MY_PROJECT_DATA,
    ],
    alsoGrants: [Permission.PROJECT_METADATA_READ],
  },
  [Permission.PROJECT_METADATA_READ]: {
    resource: Resource.PROJECT,
    actions: [Action.READ_PROJECT_METADATA],
    alsoGrants: [],
  },
};

// Map roles to the permissions they grant
export const rolePermissions: Record<
  Role,
  {permissions: Permission[]; alsoGrants?: Role[]}
> = {
  // Global roles
  [Role.SYSTEM_ADMIN]: {permissions: []},
  [Role.PROJECT_GUEST]: {
    permissions: [
      Permission.PROJECT_METADATA_READ,
      Permission.PROJECT_GUEST_CONTRIBUTE,
    ],
  },
  [Role.PROJECT_CONTRIBUTOR]: {
    permissions: [Permission.PROJECT_CONTRIBUTE],
    alsoGrants: [Role.PROJECT_GUEST],
  },
  [Role.PROJECT_MANAGER]: {
    permissions: [Permission.PROJECT_MANAGE],
    alsoGrants: [Role.PROJECT_CONTRIBUTOR],
  },
  [Role.PROJECT_ADMIN]: {
    permissions: [Permission.PROJECT_ADMIN],
    alsoGrants: [Role.PROJECT_MANAGER],
  },
};

// Define user type with roles (as an example)
// STUB
export interface User {
  id: string;
  globalPermissions: Permission[];
  resourcePermissions: {
    resource: Resource;
    resourceId: string;
    roles: Role[];
  }[];
}

// Create an authorization function
export function isAuthorized(
  user: User,
  action: Action,
  resource: Resource,
  resourceId?: string
): boolean {
  // TODO destub
  return true;
}