// Define the resources in the system
export enum Resource {
  // Projects/surveys/notebooks in the system
  PROJECT = 'project',

  // Templates in the system
  TEMPLATE = 'template',

  // Users in the system
  USER = 'user',

  // Other aspects of the system such as configuration
  SYSTEM = 'system',
}

export enum Action {
  // ============================================================
  // PROJECT ACTIONS
  // ============================================================

  // Create a new project
  CREATE_PROJECT,

  // Read the high details of a project (e.g. description, title etc)
  READ_PROJECT_METADATA,
  // Update the project high level details (e.g. description, title etc)
  UPDATE_PROJECT_DETAILS,
  // Update the UI specification (potential consistency risk)
  UPDATE_PROJECT_UISPEC,

  // Read responses for the project which are mine
  READ_MY_PROJECT_RECORDS,
  // Read responses for the project which are not mine
  READ_ALL_PROJECT_RECORDS,

  // Write a new record
  CREATE_PROJECT_RECORD,

  // Edit one of my records
  EDIT_MY_PROJECT_RECORDS,
  // Edit someone elses records
  EDIT_ALL_PROJECT_RECORDS,

  // Delete one of my records
  DELETE_MY_PROJECT_RECORDS,
  // Delete someone elses records
  DELETE_ALL_PROJECT_RECORDS,

  // Change open/closed status
  CHANGE_PROJECT_STATUS,

  // Delete the project
  DELETE_PROJECT,

  // Data export
  EXPORT_PROJECT_DATA,

  // Invitations and sharing - note there is create, edit and delete for each
  // role level
  CREATE_GUEST_PROJECT_INVITE,
  EDIT_GUEST_PROJECT_INVITE,
  DELETE_GUEST_PROJECT_INVITE,

  CREATE_CONTRIBUTOR_PROJECT_INVITE,
  EDIT_CONTRIBUTOR_PROJECT_INVITE,
  DELETE_CONTRIBUTOR_PROJECT_INVITE,

  CREATE_MANAGER_PROJECT_INVITE,
  EDIT_MANAGER_PROJECT_INVITE,
  DELETE_MANAGER_PROJECT_INVITE,

  CREATE_ADMIN_PROJECT_INVITE,
  EDIT_ADMIN_PROJECT_INVITE,
  DELETE_ADMIN_PROJECT_INVITE,

  // ============================================================
  // TEMPLATE ACTIONS
  // ============================================================

  // Create a new template
  CREATE_TEMPLATE,

  // Update a template (the actual specification)
  UPDATE_TEMPLATE_CONTENT,

  // Update a template details/description etc
  UPDATE_TEMPLATE_DETAILS,

  // Change the status of a template
  CHANGE_TEMPLATE_STATUS,

  // Delete a template
  DELETE_TEMPLATE,

  // ============================================================
  // USER ACTIONS
  // ============================================================

  // Generate a password reset link
  RESET_USER_PASSWORD,
  // Delete a user
  DELETE_USER,

  // TODO managing user roles?

  // ============================================================
  // SYSTEM ACTIONS
  // ============================================================

  // API initialise action e.g. db migrations, initialisation, keys
  INITIALISE_SYSTEM_API,
}

/**
 * Describes an action with its metadata
 */
export interface ActionDescription {
  name: string;
  description: string;
  requiresResourceId: boolean;
  resource: Resource;
}

/**
 * Maps each action to its detailed description
 */
export const actionDetails: Record<Action, ActionDescription> = {
  // ============================================================
  // PROJECT ACTIONS
  // ============================================================
  [Action.CREATE_PROJECT]: {
    name: 'Create Project',
    description: 'Create a new project in the system',
    requiresResourceId: false,
    resource: Resource.PROJECT,
  },
  [Action.READ_PROJECT_METADATA]: {
    name: 'Read Project Metadata',
    description:
      'View the high-level details of a project (title, description, etc.)',
    requiresResourceId: true,
    resource: Resource.PROJECT,
  },
  [Action.UPDATE_PROJECT_DETAILS]: {
    name: 'Update Project Details',
    description:
      'Modify the high-level details of a project (title, description, etc.)',
    requiresResourceId: true,
    resource: Resource.PROJECT,
  },
  [Action.UPDATE_PROJECT_UISPEC]: {
    name: 'Update Project UI Specification',
    description:
      'Modify the UI specification of a project (potential consistency risk)',
    requiresResourceId: true,
    resource: Resource.PROJECT,
  },
  [Action.READ_MY_PROJECT_RECORDS]: {
    name: 'Read My Project Records',
    description:
      'View responses for a project which were created by the current user',
    requiresResourceId: true,
    resource: Resource.PROJECT,
  },
  [Action.READ_ALL_PROJECT_RECORDS]: {
    name: 'Read All Project Records',
    description:
      'View all responses for a project, including those created by other users',
    requiresResourceId: true,
    resource: Resource.PROJECT,
  },
  [Action.CREATE_PROJECT_RECORD]: {
    name: 'Create Project Record',
    description: 'Add a new record/response to a project',
    requiresResourceId: true,
    resource: Resource.PROJECT,
  },
  [Action.EDIT_MY_PROJECT_RECORDS]: {
    name: 'Edit My Project Records',
    description:
      'Modify records/responses in a project that were created by the current user',
    requiresResourceId: true,
    resource: Resource.PROJECT,
  },
  [Action.EDIT_ALL_PROJECT_RECORDS]: {
    name: 'Edit All Project Records',
    description:
      'Modify any records/responses in a project, including those created by other users',
    requiresResourceId: true,
    resource: Resource.PROJECT,
  },
  [Action.DELETE_MY_PROJECT_RECORDS]: {
    name: 'Delete My Project Records',
    description:
      'Remove records/responses from a project that were created by the current user',
    requiresResourceId: true,
    resource: Resource.PROJECT,
  },
  [Action.DELETE_ALL_PROJECT_RECORDS]: {
    name: 'Delete All Project Records',
    description:
      'Remove any records/responses from a project, including those created by other users',
    requiresResourceId: true,
    resource: Resource.PROJECT,
  },
  [Action.CHANGE_PROJECT_STATUS]: {
    name: 'Change Project Status',
    description: 'Modify the open/closed status of a project',
    requiresResourceId: true,
    resource: Resource.PROJECT,
  },
  [Action.DELETE_PROJECT]: {
    name: 'Delete Project',
    description: 'Permanently remove a project from the system',
    requiresResourceId: true,
    resource: Resource.PROJECT,
  },
  [Action.EXPORT_PROJECT_DATA]: {
    name: 'Export Project Data',
    description: 'Download or export all data associated with a project',
    requiresResourceId: true,
    resource: Resource.PROJECT,
  },
  [Action.CREATE_GUEST_PROJECT_INVITE]: {
    name: 'Create Guest Project Invite',
    description: 'Generate an invitation with guest access to a project',
    requiresResourceId: true,
    resource: Resource.PROJECT,
  },
  [Action.EDIT_GUEST_PROJECT_INVITE]: {
    name: 'Edit Guest Project Invite',
    description: 'Modify an existing guest invitation to a project',
    requiresResourceId: true,
    resource: Resource.PROJECT,
  },
  [Action.DELETE_GUEST_PROJECT_INVITE]: {
    name: 'Delete Guest Project Invite',
    description: 'Remove an existing guest invitation to a project',
    requiresResourceId: true,
    resource: Resource.PROJECT,
  },
  [Action.CREATE_CONTRIBUTOR_PROJECT_INVITE]: {
    name: 'Create Contributor Project Invite',
    description: 'Generate an invitation with contributor access to a project',
    requiresResourceId: true,
    resource: Resource.PROJECT,
  },
  [Action.EDIT_CONTRIBUTOR_PROJECT_INVITE]: {
    name: 'Edit Contributor Project Invite',
    description: 'Modify an existing contributor invitation to a project',
    requiresResourceId: true,
    resource: Resource.PROJECT,
  },
  [Action.DELETE_CONTRIBUTOR_PROJECT_INVITE]: {
    name: 'Delete Contributor Project Invite',
    description: 'Remove an existing contributor invitation to a project',
    requiresResourceId: true,
    resource: Resource.PROJECT,
  },
  [Action.CREATE_MANAGER_PROJECT_INVITE]: {
    name: 'Create Manager Project Invite',
    description: 'Generate an invitation with manager access to a project',
    requiresResourceId: true,
    resource: Resource.PROJECT,
  },
  [Action.EDIT_MANAGER_PROJECT_INVITE]: {
    name: 'Edit Manager Project Invite',
    description: 'Modify an existing manager invitation to a project',
    requiresResourceId: true,
    resource: Resource.PROJECT,
  },
  [Action.DELETE_MANAGER_PROJECT_INVITE]: {
    name: 'Delete Manager Project Invite',
    description: 'Remove an existing manager invitation to a project',
    requiresResourceId: true,
    resource: Resource.PROJECT,
  },
  [Action.CREATE_ADMIN_PROJECT_INVITE]: {
    name: 'Create Admin Project Invite',
    description: 'Generate an invitation with admin access to a project',
    requiresResourceId: true,
    resource: Resource.PROJECT,
  },
  [Action.EDIT_ADMIN_PROJECT_INVITE]: {
    name: 'Edit Admin Project Invite',
    description: 'Modify an existing admin invitation to a project',
    requiresResourceId: true,
    resource: Resource.PROJECT,
  },
  [Action.DELETE_ADMIN_PROJECT_INVITE]: {
    name: 'Delete Admin Project Invite',
    description: 'Remove an existing admin invitation to a project',
    requiresResourceId: true,
    resource: Resource.PROJECT,
  },

  // ============================================================
  // TEMPLATE ACTIONS
  // ============================================================
  [Action.CREATE_TEMPLATE]: {
    name: 'Create Template',
    description: 'Create a new template in the system',
    requiresResourceId: false,
    resource: Resource.TEMPLATE,
  },
  [Action.UPDATE_TEMPLATE_CONTENT]: {
    name: 'Update Template Content',
    description: 'Modify the content/specification of a template',
    requiresResourceId: true,
    resource: Resource.TEMPLATE,
  },
  [Action.UPDATE_TEMPLATE_DETAILS]: {
    name: 'Update Template Details',
    description: 'Modify the metadata of a template (name, description, etc.)',
    requiresResourceId: true,
    resource: Resource.TEMPLATE,
  },
  [Action.CHANGE_TEMPLATE_STATUS]: {
    name: 'Change Template Status',
    description: 'Modify the status of a template (draft, published, etc.)',
    requiresResourceId: true,
    resource: Resource.TEMPLATE,
  },
  [Action.DELETE_TEMPLATE]: {
    name: 'Delete Template',
    description: 'Permanently remove a template from the system',
    requiresResourceId: true,
    resource: Resource.TEMPLATE,
  },

  // ============================================================
  // USER ACTIONS
  // ============================================================
  [Action.RESET_USER_PASSWORD]: {
    name: 'Reset User Password',
    description: 'Generate a password reset link for a user',
    requiresResourceId: true,
    resource: Resource.USER,
  },
  [Action.DELETE_USER]: {
    name: 'Delete User',
    description: 'Permanently remove a user from the system',
    requiresResourceId: true,
    resource: Resource.USER,
  },

  // ============================================================
  // SYSTEM ACTIONS
  // ============================================================
  [Action.INITIALISE_SYSTEM_API]: {
    name: 'Initialize System API',
    description:
      'Perform system initialization tasks like database migrations and key setup',
    requiresResourceId: false,
    resource: Resource.SYSTEM,
  },
};

/**
 * Generate the reverse mapping: resource to actions
 * This is automatically derived from the action descriptions
 */
export const resourceToActions: Record<Resource, Action[]> = Object.values(
  Resource
).reduce(
  (mapping, resource) => {
    mapping[resource] = Object.entries(actionDetails)
      .filter(([_, desc]) => desc.resource === resource)
      .map(([action]) => Number(action) as Action);
    return mapping;
  },
  {} as Record<Resource, Action[]>
);

// =====================================
// PERMISSIONS
// =====================================

// These are the set of permissions which apply on a per-resource basis.

// The token will only be 'expanded' to include resource specific permissions
// explicitly encoded so that couch can determine permissions (with no other
// context), otherwise resource specific roles will be used, which in
// combination with the data model, can provide equivalent description of
// permissions.

// The reason to include this is that not all clients know enough about the user
// to determine which projects/resources they have access to. For example, the
// project data is protected on a per project basis, so the token needs to not
// only have "data read" but also "data read for X project".

// Otherwise -
export enum Permission {
  // PROJECT GENERAL
  // ===============
  PROJECT_CREATE,

  // PROJECT SPECIFIC
  // ================

  // View basic details about project
  PROJECT_VIEW,

  // Add and basic manage my data
  PROJECT_DATA_ADD,

  // Data reading levels (NOTE this is only client side implemented in couch)
  PROJECT_DATA_READ_MINE,
  PROJECT_DATA_READ_ALL,

  // Data editing levels (NOTE this is uniformly implemented)
  PROJECT_DATA_EDIT_ALL,

  // Deletion
  PROJECT_DATA_DELETE_ALL,

  // Manage the project
  PROJECT_MANAGE,

  // Administer the project
  PROJECT_ADMIN,

  // TEMPLATE GENERAL
  // ================
  TEMPLATE_CREATE,

  // TEMPLATE SPECIFIC
  // =================

  // Right now we merge all editing rights into one permission
  TEMPLATE_EDIT,

  // Deletion is a special permission
  TEMPLATE_DELETE,

  // USER GENERAL
  // ================

  // Right now this is on a general basis
  USER_MANAGE,

  // USER SPECIFIC
  // ================
  // None currently

  // SYSTEM GENERAL
  // ================

  // Right now this is on a general basis
  SYSTEM_MANAGE,

  // SYSTEM SPECIFIC
  // ================
  // None currently
}

// =====================================
// ROLES
// =====================================

// Roles grant collections of permissions. These could be permissions for a
// given resource, or general permissions.
export enum Role {
  // GLOBAl ROLES
  // ================
  GENERAL_ADMIN,
  GENERAL_CREATOR,

  // PROJECT ROLES
  // ================
  PROJECT_GUEST,
  PROJECT_CONTRIBUTOR,
  PROJECT_MANAGER,
  PROJECT_ADMIN,

  // TEMPLATE ROLES
  // ================
  // None - globally managed

  // USER ROLES
  // ================
  // None - globally managed

  // SYSTEM ROLES
  // ================
  // None - globally managed
}

// Define role scope for clarity
export enum RoleScope {
  // Applies to all resources of a type
  GLOBAL = 'global',
  // Must be assigned per resource
  RESOURCE_SPECIFIC = 'specific',
}

// Define role details type with metadata
export interface RoleDetails {
  name: string;
  description: string;
  scope: RoleScope;
}

// Map each role to its details
export const roleDetails: Record<Role, RoleDetails> = {
  // Global roles
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
  },
  [Role.PROJECT_MANAGER]: {
    name: 'Project Manager',
    description:
      'Can manage project settings, invitations and all data within a project',
    scope: RoleScope.RESOURCE_SPECIFIC,
  },
  [Role.PROJECT_CONTRIBUTOR]: {
    name: 'Project Contributor',
    description: 'Can view all data within a project and contribute their own',
    scope: RoleScope.RESOURCE_SPECIFIC,
  },
  [Role.PROJECT_GUEST]: {
    name: 'Project Guest',
    description: 'Can view only their own contributions to a project',
    scope: RoleScope.RESOURCE_SPECIFIC,
  },
};

// Map resources to their available roles - these are roles which are scoped to
// a specific resource
export const resourceRoles: Record<Resource, Role[]> = {
  [Resource.PROJECT]: [
    Role.PROJECT_GUEST,
    Role.PROJECT_CONTRIBUTOR,
    Role.PROJECT_MANAGER,
    Role.PROJECT_ADMIN,
  ],
  [Resource.SYSTEM]: [],
  [Resource.USER]: [],
  [Resource.TEMPLATE]: [],
};

// Map permissions to the actions they allow on resources, along with
// heirarchical permissions
export const permissionActions: Record<
  Permission,
  {resource: Resource; actions: Action[]}
> = {
  // PROJECTS
  // ========
  [Permission.PROJECT_CREATE]: {
    resource: Resource.PROJECT,
    actions: [Action.CREATE_PROJECT],
  },
  [Permission.PROJECT_VIEW]: {
    resource: Resource.PROJECT,
    actions: [Action.READ_PROJECT_METADATA],
  },
  [Permission.PROJECT_DATA_ADD]: {
    resource: Resource.PROJECT,
    actions: [
      Action.CREATE_PROJECT_RECORD,
      Action.EDIT_MY_PROJECT_RECORDS,
      Action.DELETE_MY_PROJECT_RECORDS,
      Action.READ_MY_PROJECT_RECORDS,
    ],
  },
  [Permission.PROJECT_DATA_READ_MINE]: {
    resource: Resource.PROJECT,
    actions: [Action.READ_MY_PROJECT_RECORDS],
  },
  [Permission.PROJECT_DATA_READ_ALL]: {
    resource: Resource.PROJECT,
    actions: [Action.READ_MY_PROJECT_RECORDS, Action.READ_ALL_PROJECT_RECORDS],
  },
  [Permission.PROJECT_DATA_EDIT_ALL]: {
    resource: Resource.PROJECT,
    actions: [Action.EDIT_MY_PROJECT_RECORDS, Action.EDIT_ALL_PROJECT_RECORDS],
  },
  [Permission.PROJECT_DATA_DELETE_ALL]: {
    resource: Resource.PROJECT,
    actions: [
      Action.DELETE_MY_PROJECT_RECORDS,
      Action.DELETE_ALL_PROJECT_RECORDS,
    ],
  },
  [Permission.PROJECT_MANAGE]: {
    resource: Resource.PROJECT,
    actions: [
      Action.UPDATE_PROJECT_DETAILS,
      Action.UPDATE_PROJECT_UISPEC,
      Action.CHANGE_PROJECT_STATUS,
      Action.EXPORT_PROJECT_DATA,
      Action.CREATE_GUEST_PROJECT_INVITE,
      Action.EDIT_GUEST_PROJECT_INVITE,
      Action.DELETE_GUEST_PROJECT_INVITE,
      Action.CREATE_CONTRIBUTOR_PROJECT_INVITE,
      Action.EDIT_CONTRIBUTOR_PROJECT_INVITE,
      Action.DELETE_CONTRIBUTOR_PROJECT_INVITE,
      Action.CREATE_MANAGER_PROJECT_INVITE,
      Action.EDIT_MANAGER_PROJECT_INVITE,
      Action.DELETE_MANAGER_PROJECT_INVITE,
    ],
  },
  [Permission.PROJECT_ADMIN]: {
    resource: Resource.PROJECT,
    actions: [
      Action.CREATE_ADMIN_PROJECT_INVITE,
      Action.EDIT_ADMIN_PROJECT_INVITE,
      Action.DELETE_ADMIN_PROJECT_INVITE,
      Action.DELETE_PROJECT,
    ],
  },

  // TEMPLATES
  // ========
  [Permission.TEMPLATE_CREATE]: {
    resource: Resource.TEMPLATE,
    actions: [Action.CREATE_TEMPLATE],
  },
  [Permission.TEMPLATE_EDIT]: {
    resource: Resource.TEMPLATE,
    actions: [
      Action.UPDATE_TEMPLATE_CONTENT,
      Action.UPDATE_TEMPLATE_DETAILS,
      Action.CHANGE_TEMPLATE_STATUS,
    ],
  },
  [Permission.TEMPLATE_DELETE]: {
    resource: Resource.TEMPLATE,
    actions: [Action.DELETE_TEMPLATE],
  },

  // USER
  // ========
  [Permission.USER_MANAGE]: {
    resource: Resource.USER,
    actions: [Action.RESET_USER_PASSWORD, Action.DELETE_USER],
  },

  // SYSTEM
  // ========
  [Permission.SYSTEM_MANAGE]: {
    resource: Resource.SYSTEM,
    actions: [Action.INITIALISE_SYSTEM_API],
  },
};

/**
 * Maps each action to the permissions that grant it
 * This is automatically derived from the permissionActions map
 */
export const actionPermissions: Record<Action, Permission[]> = (() => {
  // Initialize an empty mapping for all actions
  const mapping = Object.values(Action).reduce(
    (acc, action) => {
      if (typeof action === 'number') {
        acc[action] = [];
      }
      return acc;
    },
    {} as Record<Action, Permission[]>
  );

  // Populate the mapping by iterating through permissionActions
  Object.entries(permissionActions).forEach(([permissionKey, {actions}]) => {
    const permission = Number(permissionKey) as Permission;

    // Add this permission to each action it grants
    actions.forEach(action => {
      mapping[action].push(permission);
    });
  });

  return mapping;
})();

// Map roles to the permissions they grant - roles can also grant child role(s)
export const rolePermissions: Record<
  Role,
  {permissions: Permission[]; alsoGrants?: Role[]}
> = {
  // PROJECT ROLES
  // =============
  [Role.PROJECT_ADMIN]: {
    permissions: [Permission.PROJECT_ADMIN],
    alsoGrants: [Role.PROJECT_MANAGER],
  },
  [Role.PROJECT_MANAGER]: {
    permissions: [
      Permission.PROJECT_DATA_EDIT_ALL,
      Permission.PROJECT_DATA_DELETE_ALL,
      Permission.PROJECT_MANAGE,
    ],
    alsoGrants: [Role.PROJECT_CONTRIBUTOR],
  },
  [Role.PROJECT_CONTRIBUTOR]: {
    permissions: [Permission.PROJECT_DATA_READ_ALL],
    alsoGrants: [Role.PROJECT_GUEST],
  },
  [Role.PROJECT_GUEST]: {
    permissions: [
      Permission.PROJECT_DATA_ADD,
      Permission.PROJECT_DATA_READ_MINE,
    ],
    alsoGrants: [],
  },

  // GENERAL ROLES
  // =============
  [Role.GENERAL_ADMIN]: {
    permissions: [Permission.USER_MANAGE, Permission.SYSTEM_MANAGE],
    alsoGrants: [Role.GENERAL_CREATOR, Role.PROJECT_ADMIN],
  },
  [Role.GENERAL_CREATOR]: {
    permissions: [
      Permission.TEMPLATE_CREATE,
      Permission.TEMPLATE_EDIT,
      Permission.TEMPLATE_DELETE,
    ],
    alsoGrants: [],
  },
};

// ==============
// TOKEN ENCODING
// ==============

export const ENCODING_SEPARATOR = '||';
export type DecodedResourcePermission = {
  resourceId: string;
  permissionString: string;
};

export const encodePerResourcePermission = ({
  resourceId,
  permissionString,
}: DecodedResourcePermission) => {
  return `${resourceId}${ENCODING_SEPARATOR}${permissionString}`;
};

export const decodePerResourcePermission = ({
  input,
}: {
  input: string;
}): DecodedResourcePermission => {
  const splitResult = input.split(ENCODING_SEPARATOR);
  if (
    splitResult.length !== 2 ||
    splitResult[0].length === 0 ||
    splitResult[1].length === 0
  ) {
    throw Error(
      'Invalid decoding of encoded resource specific role. After splitting on ' +
        ENCODING_SEPARATOR +
        ' there was not two distinct remaining sections of non zero length.'
    );
  }
  return {resourceId: splitResult[0], permissionString: splitResult[1]};
};

export interface TokenStructure {
  // These are roles which apply to specific resources (encoded as above)
  resourceRoles: string[];
  // These are resource specific permissions e.g. (encoded as above)
  resourcePermissions: string[];
  // These are roles that apply generally - not resource specific - they may
  // imply resources specific permissions but for all resources of that type.
  globalRoles: string[];
}
