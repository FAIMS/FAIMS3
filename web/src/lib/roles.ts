export enum Role {
  GENERAL_USER = 'GENERAL_USER',
  GENERAL_ADMIN = 'GENERAL_ADMIN',
  GENERAL_CREATOR = 'GENERAL_CREATOR',
  PROJECT_GUEST = 'PROJECT_GUEST',
  PROJECT_CONTRIBUTOR = 'PROJECT_CONTRIBUTOR',
  PROJECT_MANAGER = 'PROJECT_MANAGER',
  PROJECT_ADMIN = 'PROJECT_ADMIN',
}

export enum RoleScope {
  GLOBAL = 'GLOBAL',
  RESOURCE_SPECIFIC = 'RESOURCE_SPECIFIC',
}

export enum Resource {
  PROJECT = 'PROJECT',
}

export interface RoleDetails {
  name: string;
  description: string;
  scope: RoleScope;
  resource?: string;
}

export const roleDetails: Record<Role, RoleDetails> = {
  // Global roles
  [Role.GENERAL_USER]: {
    name: 'General User',
    description:
      'Everyone registered in the system is a general user. This represents a default set of permissions.',
    scope: RoleScope.GLOBAL,
  },
  [Role.GENERAL_ADMIN]: {
    name: 'System Administrator',
    description:
      'Full access to all system resources and management capabilities',
    scope: RoleScope.GLOBAL,
  },
  [Role.GENERAL_CREATOR]: {
    name: 'Content Creator',
    description:
      'Ability to create and manage templates and surveys across the system',
    scope: RoleScope.GLOBAL,
  },

  // Project roles
  [Role.PROJECT_ADMIN]: {
    name: 'Project Administrator',
    description:
      'Full control over a specific project, including deletion and admin user management',
    scope: RoleScope.RESOURCE_SPECIFIC,
    resource: Resource.PROJECT,
  },
  [Role.PROJECT_MANAGER]: {
    name: 'Project Manager',
    description:
      'Can manage project settings, invitations and all data within a project',
    scope: RoleScope.RESOURCE_SPECIFIC,
    resource: Resource.PROJECT,
  },
  [Role.PROJECT_CONTRIBUTOR]: {
    name: 'Project Contributor',
    description: 'Can view all data within a project and contribute their own',
    scope: RoleScope.RESOURCE_SPECIFIC,
    resource: Resource.PROJECT,
  },
  [Role.PROJECT_GUEST]: {
    name: 'Project Guest',
    description: 'Can view only their own contributions to a project',
    scope: RoleScope.RESOURCE_SPECIFIC,
    resource: Resource.PROJECT,
  },
};
