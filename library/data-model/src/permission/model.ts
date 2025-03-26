// Define the resources in the system
export enum Resource {
  // Projects/surveys/notebooks in the system
  PROJECT = 'PROJECT',

  // Templates in the system
  TEMPLATE = 'TEMPLATE',

  // Users in the system
  USER = 'USER',

  // Other aspects of the system such as configuration
  SYSTEM = 'SYSTEM',
}

export enum Action {
  // ============================================================
  // PROJECT ACTIONS
  // ============================================================

  // View list of projects
  LIST_PROJECTS = 'LIST_PROJECTS',

  // Create a new project
  CREATE_PROJECT = 'CREATE_PROJECT',

  // Read the high details of a project (e.g. description, title etc)
  READ_PROJECT_METADATA = 'READ_PROJECT_METADATA',
  // Update the project high level details (e.g. description, title etc)
  UPDATE_PROJECT_DETAILS = 'UPDATE_PROJECT_DETAILS',
  // Update the UI specification (potential consistency risk)
  UPDATE_PROJECT_UISPEC = 'UPDATE_PROJECT_UISPEC',

  // Read responses for the project which are mine
  READ_MY_PROJECT_RECORDS = 'READ_MY_PROJECT_RECORDS',
  // Read responses for the project which are not mine
  READ_ALL_PROJECT_RECORDS = 'READ_ALL_PROJECT_RECORDS',

  // Write a new record
  CREATE_PROJECT_RECORD = 'CREATE_PROJECT_RECORD',

  // Edit one of my records
  EDIT_MY_PROJECT_RECORDS = 'EDIT_MY_PROJECT_RECORDS',
  // Edit someone elses records
  EDIT_ALL_PROJECT_RECORDS = 'EDIT_ALL_PROJECT_RECORDS',

  // Delete one of my records
  DELETE_MY_PROJECT_RECORDS = 'DELETE_MY_PROJECT_RECORDS',
  // Delete someone elses records
  DELETE_ALL_PROJECT_RECORDS = 'DELETE_ALL_PROJECT_RECORDS',

  // Change open/closed status
  CHANGE_PROJECT_STATUS = 'CHANGE_PROJECT_STATUS',

  // Delete the project
  DELETE_PROJECT = 'DELETE_PROJECT',

  // Data export
  EXPORT_PROJECT_DATA = 'EXPORT_PROJECT_DATA',

  GENERATE_RANDOM_PROJECT_RECORDS = 'GENERATE_RANDOM_PROJECT_RECORDS',

  // Invitations and sharing - note there is create, edit and delete for each
  // role level
  VIEW_PROJECT_INVITES = 'VIEW_PROJECT_INVITES',

  CREATE_GUEST_PROJECT_INVITE = 'CREATE_GUEST_PROJECT_INVITE',
  EDIT_GUEST_PROJECT_INVITE = 'EDIT_GUEST_PROJECT_INVITE',
  DELETE_GUEST_PROJECT_INVITE = 'DELETE_GUEST_PROJECT_INVITE',

  CREATE_CONTRIBUTOR_PROJECT_INVITE = 'CREATE_CONTRIBUTOR_PROJECT_INVITE',
  EDIT_CONTRIBUTOR_PROJECT_INVITE = 'EDIT_CONTRIBUTOR_PROJECT_INVITE',
  DELETE_CONTRIBUTOR_PROJECT_INVITE = 'DELETE_CONTRIBUTOR_PROJECT_INVITE',

  CREATE_MANAGER_PROJECT_INVITE = 'CREATE_MANAGER_PROJECT_INVITE',
  EDIT_MANAGER_PROJECT_INVITE = 'EDIT_MANAGER_PROJECT_INVITE',
  DELETE_MANAGER_PROJECT_INVITE = 'DELETE_MANAGER_PROJECT_INVITE',

  CREATE_ADMIN_PROJECT_INVITE = 'CREATE_ADMIN_PROJECT_INVITE',
  EDIT_ADMIN_PROJECT_INVITE = 'EDIT_ADMIN_PROJECT_INVITE',
  DELETE_ADMIN_PROJECT_INVITE = 'DELETE_ADMIN_PROJECT_INVITE',

  // Manage user roles directly
  VIEW_PROJECT_USERS = 'VIEW_PROJECT_USERS',
  ADD_ADMIN_TO_PROJECT = 'ADD_ADMIN_TO_PROJECT',
  REMOVE_ADMIN_FROM_PROJECT = 'REMOVE_ADMIN_FROM_PROJECT',
  ADD_MANAGER_TO_PROJECT = 'ADD_MANAGER_TO_PROJECT',
  REMOVE_MANAGER_FROM_PROJECT = 'REMOVE_MANAGER_FROM_PROJECT',
  ADD_CONTRIBUTOR_TO_PROJECT = 'ADD_CONTRIBUTOR_TO_PROJECT',
  REMOVE_CONTRIBUTOR_FROM_PROJECT = 'REMOVE_CONTRIBUTOR_FROM_PROJECT',
  ADD_GUEST_TO_PROJECT = 'ADD_GUEST_TO_PROJECT',
  REMOVE_GUEST_FROM_PROJECT = 'REMOVE_GUEST_FROM_PROJECT',

  // ============================================================
  // TEMPLATE ACTIONS
  // ============================================================

  // View templates
  VIEW_TEMPLATES = 'VIEW_TEMPLATES',

  // Create a new template
  CREATE_TEMPLATE = 'CREATE_TEMPLATE',

  // Update a template (the actual specification)
  UPDATE_TEMPLATE_CONTENT = 'UPDATE_TEMPLATE_CONTENT',

  // Update a template details/description etc
  UPDATE_TEMPLATE_DETAILS = 'UPDATE_TEMPLATE_DETAILS',

  // Change the status of a template
  CHANGE_TEMPLATE_STATUS = 'CHANGE_TEMPLATE_STATUS',

  // Delete a template
  DELETE_TEMPLATE = 'DELETE_TEMPLATE',

  // ============================================================
  // USER ACTIONS
  // ============================================================

  // View the list of users
  VIEW_USER_LIST = 'VIEW_USER_LIST',
  // View the list of users
  ADD_OR_REMOVE_GLOBAL_USER_ROLE = 'ADD_OR_REMOVE_GLOBAL_USER_ROLE',
  // Generate a password reset link
  RESET_USER_PASSWORD = 'RESET_USER_PASSWORD',
  // Delete a user
  DELETE_USER = 'DELETE_USER',

  // TODO managing user roles? E.g. remove role, add role

  // ============================================================
  // SYSTEM ACTIONS
  // ============================================================

  // API initialise action e.g. db migrations, initialisation, keys
  INITIALISE_SYSTEM_API = 'INITIALISE_SYSTEM_API',
  VALIDATE_DBS = 'VALIDATE_DBS',
  RESTORE_FROM_BACKUP = 'RESTORE_FROM_BACKUP',
}

/**
 * Describes an action with its metadata
 */
export interface ActionDetails {
  name: string;
  description: string;
  resourceSpecific: boolean;
  resource: Resource;
}

/**
 * Maps each action to its detailed description
 */
export const actionDetails: Record<Action, ActionDetails> = {
  // ============================================================
  // PROJECT ACTIONS
  // ============================================================
  [Action.LIST_PROJECTS]: {
    name: 'List Projects',
    description: 'Lists all high level details about projects in the system',
    resourceSpecific: false,
    resource: Resource.PROJECT,
  },
  [Action.CREATE_PROJECT]: {
    name: 'Create Project',
    description: 'Create a new project in the system',
    resourceSpecific: false,
    resource: Resource.PROJECT,
  },
  [Action.READ_PROJECT_METADATA]: {
    name: 'Read Project Metadata',
    description:
      'View the high-level details of a project (title, description, etc.)',
    resourceSpecific: true,
    resource: Resource.PROJECT,
  },
  [Action.UPDATE_PROJECT_DETAILS]: {
    name: 'Update Project Details',
    description:
      'Modify the high-level details of a project (title, description, etc.)',
    resourceSpecific: true,
    resource: Resource.PROJECT,
  },
  [Action.UPDATE_PROJECT_UISPEC]: {
    name: 'Update Project UI Specification',
    description:
      'Modify the UI specification of a project (potential consistency risk)',
    resourceSpecific: true,
    resource: Resource.PROJECT,
  },
  [Action.GENERATE_RANDOM_PROJECT_RECORDS]: {
    name: 'Generate random records for a project',
    description: 'Generates a collection of random debugging records',
    resourceSpecific: true,
    resource: Resource.PROJECT,
  },
  [Action.READ_MY_PROJECT_RECORDS]: {
    name: 'Read My Project Records',
    description:
      'View responses for a project which were created by the current user',
    resourceSpecific: true,
    resource: Resource.PROJECT,
  },
  [Action.READ_ALL_PROJECT_RECORDS]: {
    name: 'Read All Project Records',
    description:
      'View all responses for a project, including those created by other users',
    resourceSpecific: true,
    resource: Resource.PROJECT,
  },
  [Action.CREATE_PROJECT_RECORD]: {
    name: 'Create Project Record',
    description: 'Add a new record/response to a project',
    resourceSpecific: true,
    resource: Resource.PROJECT,
  },
  [Action.EDIT_MY_PROJECT_RECORDS]: {
    name: 'Edit My Project Records',
    description:
      'Modify records/responses in a project that were created by the current user',
    resourceSpecific: true,
    resource: Resource.PROJECT,
  },
  [Action.EDIT_ALL_PROJECT_RECORDS]: {
    name: 'Edit All Project Records',
    description:
      'Modify any records/responses in a project, including those created by other users',
    resourceSpecific: true,
    resource: Resource.PROJECT,
  },
  [Action.DELETE_MY_PROJECT_RECORDS]: {
    name: 'Delete My Project Records',
    description:
      'Remove records/responses from a project that were created by the current user',
    resourceSpecific: true,
    resource: Resource.PROJECT,
  },
  [Action.DELETE_ALL_PROJECT_RECORDS]: {
    name: 'Delete All Project Records',
    description:
      'Remove any records/responses from a project, including those created by other users',
    resourceSpecific: true,
    resource: Resource.PROJECT,
  },
  [Action.CHANGE_PROJECT_STATUS]: {
    name: 'Change Project Status',
    description: 'Modify the open/closed status of a project',
    resourceSpecific: true,
    resource: Resource.PROJECT,
  },
  [Action.DELETE_PROJECT]: {
    name: 'Delete Project',
    description: 'Permanently remove a project from the system',
    resourceSpecific: true,
    resource: Resource.PROJECT,
  },
  [Action.EXPORT_PROJECT_DATA]: {
    name: 'Export Project Data',
    description: 'Download or export all data associated with a project',
    resourceSpecific: true,
    resource: Resource.PROJECT,
  },
  [Action.VIEW_PROJECT_INVITES]: {
    name: 'View Project invitiations',
    description: 'View the list of existing invitations and their details',
    resourceSpecific: true,
    resource: Resource.PROJECT,
  },
  [Action.CREATE_GUEST_PROJECT_INVITE]: {
    name: 'Create Guest Project Invite',
    description: 'Generate an invitation with guest access to a project',
    resourceSpecific: true,
    resource: Resource.PROJECT,
  },
  [Action.EDIT_GUEST_PROJECT_INVITE]: {
    name: 'Edit Guest Project Invite',
    description: 'Modify an existing guest invitation to a project',
    resourceSpecific: true,
    resource: Resource.PROJECT,
  },
  [Action.DELETE_GUEST_PROJECT_INVITE]: {
    name: 'Delete Guest Project Invite',
    description: 'Remove an existing guest invitation to a project',
    resourceSpecific: true,
    resource: Resource.PROJECT,
  },
  [Action.CREATE_CONTRIBUTOR_PROJECT_INVITE]: {
    name: 'Create Contributor Project Invite',
    description: 'Generate an invitation with contributor access to a project',
    resourceSpecific: true,
    resource: Resource.PROJECT,
  },
  [Action.EDIT_CONTRIBUTOR_PROJECT_INVITE]: {
    name: 'Edit Contributor Project Invite',
    description: 'Modify an existing contributor invitation to a project',
    resourceSpecific: true,
    resource: Resource.PROJECT,
  },
  [Action.DELETE_CONTRIBUTOR_PROJECT_INVITE]: {
    name: 'Delete Contributor Project Invite',
    description: 'Remove an existing contributor invitation to a project',
    resourceSpecific: true,
    resource: Resource.PROJECT,
  },
  [Action.CREATE_MANAGER_PROJECT_INVITE]: {
    name: 'Create Manager Project Invite',
    description: 'Generate an invitation with manager access to a project',
    resourceSpecific: true,
    resource: Resource.PROJECT,
  },
  [Action.EDIT_MANAGER_PROJECT_INVITE]: {
    name: 'Edit Manager Project Invite',
    description: 'Modify an existing manager invitation to a project',
    resourceSpecific: true,
    resource: Resource.PROJECT,
  },
  [Action.DELETE_MANAGER_PROJECT_INVITE]: {
    name: 'Delete Manager Project Invite',
    description: 'Remove an existing manager invitation to a project',
    resourceSpecific: true,
    resource: Resource.PROJECT,
  },
  [Action.CREATE_ADMIN_PROJECT_INVITE]: {
    name: 'Create Admin Project Invite',
    description: 'Generate an invitation with admin access to a project',
    resourceSpecific: true,
    resource: Resource.PROJECT,
  },
  [Action.EDIT_ADMIN_PROJECT_INVITE]: {
    name: 'Edit Admin Project Invite',
    description: 'Modify an existing admin invitation to a project',
    resourceSpecific: true,
    resource: Resource.PROJECT,
  },
  [Action.DELETE_ADMIN_PROJECT_INVITE]: {
    name: 'Delete Admin Project Invite',
    description: 'Remove an existing admin invitation to a project',
    resourceSpecific: true,
    resource: Resource.PROJECT,
  },
  [Action.ADD_ADMIN_TO_PROJECT]: {
    name: 'Add Admin to Project',
    description: 'Grant a user administrator privileges for a specific project',
    resourceSpecific: true,
    resource: Resource.PROJECT,
  },
  [Action.REMOVE_ADMIN_FROM_PROJECT]: {
    name: 'Remove Admin from Project',
    description:
      'Revoke administrator privileges from a user for a specific project',
    resourceSpecific: true,
    resource: Resource.PROJECT,
  },
  [Action.ADD_MANAGER_TO_PROJECT]: {
    name: 'Add Manager to Project',
    description: 'Grant a user manager privileges for a specific project',
    resourceSpecific: true,
    resource: Resource.PROJECT,
  },
  [Action.REMOVE_MANAGER_FROM_PROJECT]: {
    name: 'Remove Manager from Project',
    description: 'Revoke manager privileges from a user for a specific project',
    resourceSpecific: true,
    resource: Resource.PROJECT,
  },
  [Action.ADD_CONTRIBUTOR_TO_PROJECT]: {
    name: 'Add Contributor to Project',
    description: 'Grant a user contributor access to a specific project',
    resourceSpecific: true,
    resource: Resource.PROJECT,
  },
  [Action.REMOVE_CONTRIBUTOR_FROM_PROJECT]: {
    name: 'Remove Contributor from Project',
    description: 'Revoke contributor access from a user for a specific project',
    resourceSpecific: true,
    resource: Resource.PROJECT,
  },
  [Action.ADD_GUEST_TO_PROJECT]: {
    name: 'Add Guest to Project',
    description: 'Grant a user guest access to a specific project',
    resourceSpecific: true,
    resource: Resource.PROJECT,
  },
  [Action.REMOVE_GUEST_FROM_PROJECT]: {
    name: 'Remove Guest from Project',
    description: 'Revoke guest access from a user for a specific project',
    resourceSpecific: true,
    resource: Resource.PROJECT,
  },
  [Action.VIEW_PROJECT_USERS]: {
    name: 'View Project Users',
    description:
      'Allows visibility of project users and their roles in the project',
    resourceSpecific: true,
    resource: Resource.PROJECT,
  },

  // ============================================================
  // TEMPLATE ACTIONS
  // ============================================================
  [Action.VIEW_TEMPLATES]: {
    name: 'View templates',
    description: 'View all templates in the system',
    resourceSpecific: false,
    resource: Resource.TEMPLATE,
  },
  [Action.CREATE_TEMPLATE]: {
    name: 'Create Template',
    description: 'Create a new template in the system',
    resourceSpecific: false,
    resource: Resource.TEMPLATE,
  },
  [Action.UPDATE_TEMPLATE_CONTENT]: {
    name: 'Update Template Content',
    description: 'Modify the content/specification of a template',
    resourceSpecific: true,
    resource: Resource.TEMPLATE,
  },
  [Action.UPDATE_TEMPLATE_DETAILS]: {
    name: 'Update Template Details',
    description: 'Modify the metadata of a template (name, description, etc.)',
    resourceSpecific: true,
    resource: Resource.TEMPLATE,
  },
  [Action.CHANGE_TEMPLATE_STATUS]: {
    name: 'Change Template Status',
    description: 'Modify the status of a template (draft, published, etc.)',
    resourceSpecific: true,
    resource: Resource.TEMPLATE,
  },
  [Action.DELETE_TEMPLATE]: {
    name: 'Delete Template',
    description: 'Permanently remove a template from the system',
    resourceSpecific: true,
    resource: Resource.TEMPLATE,
  },

  // ============================================================
  // USER ACTIONS
  // ============================================================
  [Action.VIEW_USER_LIST]: {
    name: 'View user list',
    description: 'List the users of the system',
    resourceSpecific: false,
    resource: Resource.USER,
  },
  [Action.ADD_OR_REMOVE_GLOBAL_USER_ROLE]: {
    name: 'Manage global user roles',
    description: 'Add or remove global user roles from a user',
    resourceSpecific: true,
    resource: Resource.USER,
  },
  [Action.RESET_USER_PASSWORD]: {
    name: 'Reset User Password',
    description: 'Generate a password reset link for a user',
    resourceSpecific: true,
    resource: Resource.USER,
  },
  [Action.DELETE_USER]: {
    name: 'Delete User',
    description: 'Permanently remove a user from the system',
    resourceSpecific: true,
    resource: Resource.USER,
  },

  // ============================================================
  // SYSTEM ACTIONS
  // ============================================================
  [Action.INITIALISE_SYSTEM_API]: {
    name: 'Initialize System API',
    description:
      'Perform system initialization tasks like database migrations and key setup',
    resourceSpecific: false,
    resource: Resource.SYSTEM,
  },
  [Action.RESTORE_FROM_BACKUP]: {
    name: 'Restore data from backup',
    description: 'System restore operation to restore DBs from backup',
    resourceSpecific: false,
    resource: Resource.SYSTEM,
  },
  [Action.VALIDATE_DBS]: {
    name: 'Validate system databases',
    description: 'Perform the DB validation process',
    resourceSpecific: false,
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
      .map(([action]) => action as Action);
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
export enum Permission {
  // PROJECT GENERAL
  // ===============
  PROJECT_LIST = 'PROJECT_LIST',
  PROJECT_CREATE = 'PROJECT_CREATE',

  // PROJECT SPECIFIC
  // ================

  // View basic details about project
  PROJECT_VIEW = 'PROJECT_VIEW',

  // Add and basic manage my data
  PROJECT_DATA_ADD = 'PROJECT_DATA_ADD',

  // Data reading levels (NOTE this is only client side implemented in couch)
  PROJECT_DATA_READ_MINE = 'PROJECT_DATA_READ_MINE',
  PROJECT_DATA_READ_ALL = 'PROJECT_DATA_READ_ALL',

  // Data editing levels (NOTE this is uniformly implemented)
  PROJECT_DATA_EDIT_ALL = 'PROJECT_DATA_EDIT_ALL',

  // Deletion
  PROJECT_DATA_DELETE_ALL = 'PROJECT_DATA_DELETE_ALL',

  // Manage the project
  PROJECT_MANAGE = 'PROJECT_MANAGE',

  // Administer the project
  PROJECT_ADMIN = 'PROJECT_ADMIN',

  // TEMPLATE GENERAL
  // ================
  TEMPLATE_VIEW = 'TEMPLATE_VIEW',

  TEMPLATE_CREATE = 'TEMPLATE_CREATE',

  // TEMPLATE SPECIFIC
  // =================

  // Right now we merge all editing rights into one permission
  TEMPLATE_EDIT = 'TEMPLATE_EDIT',

  // Deletion is a special permission
  TEMPLATE_DELETE = 'TEMPLATE_DELETE',

  // USER GENERAL
  // ================

  // Right now this is on a general basis
  USER_MANAGE = 'USER_MANAGE',

  // USER SPECIFIC
  // ================
  // None currently

  // SYSTEM GENERAL
  // ================

  // Right now this is on a general basis
  SYSTEM_MANAGE = 'SYSTEM_MANAGE',

  // SYSTEM SPECIFIC
  // ================
  // None currently
}

// Map permissions to the actions they allow on resources, along with
// heirarchical permissions
export const permissionActions: Record<
  Permission,
  {resource: Resource; actions: Action[]}
> = {
  // PROJECTS
  // ========
  [Permission.PROJECT_LIST]: {
    resource: Resource.PROJECT,
    actions: [Action.LIST_PROJECTS],
  },
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
      Action.VIEW_PROJECT_INVITES,
      Action.CREATE_GUEST_PROJECT_INVITE,
      Action.EDIT_GUEST_PROJECT_INVITE,
      Action.DELETE_GUEST_PROJECT_INVITE,
      Action.CREATE_CONTRIBUTOR_PROJECT_INVITE,
      Action.EDIT_CONTRIBUTOR_PROJECT_INVITE,
      Action.DELETE_CONTRIBUTOR_PROJECT_INVITE,
      Action.CREATE_MANAGER_PROJECT_INVITE,
      Action.EDIT_MANAGER_PROJECT_INVITE,
      Action.DELETE_MANAGER_PROJECT_INVITE,
      Action.VIEW_PROJECT_USERS,

      // guest, contributor, manager remove add
      Action.ADD_GUEST_TO_PROJECT,
      Action.REMOVE_GUEST_FROM_PROJECT,
      Action.ADD_CONTRIBUTOR_TO_PROJECT,
      Action.REMOVE_CONTRIBUTOR_FROM_PROJECT,
      Action.ADD_MANAGER_TO_PROJECT,
      Action.REMOVE_MANAGER_FROM_PROJECT,
    ],
  },
  [Permission.PROJECT_ADMIN]: {
    resource: Resource.PROJECT,
    actions: [
      Action.CREATE_ADMIN_PROJECT_INVITE,
      Action.EDIT_ADMIN_PROJECT_INVITE,
      Action.DELETE_ADMIN_PROJECT_INVITE,
      Action.DELETE_PROJECT,

      // admin remove/add
      Action.ADD_ADMIN_TO_PROJECT,
      Action.REMOVE_ADMIN_FROM_PROJECT,

      // Debugging
      Action.GENERATE_RANDOM_PROJECT_RECORDS,
    ],
  },

  // TEMPLATES
  // ========
  [Permission.TEMPLATE_VIEW]: {
    resource: Resource.TEMPLATE,
    actions: [Action.VIEW_TEMPLATES],
  },
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
    actions: [
      Action.RESET_USER_PASSWORD,
      // This is being granted globally
      Action.ADD_OR_REMOVE_GLOBAL_USER_ROLE,
      Action.DELETE_USER,
      Action.VIEW_USER_LIST,
    ],
  },

  // SYSTEM
  // ========
  [Permission.SYSTEM_MANAGE]: {
    resource: Resource.SYSTEM,
    actions: [
      Action.INITIALISE_SYSTEM_API,
      Action.RESTORE_FROM_BACKUP,
      Action.VALIDATE_DBS,
    ],
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
      if (typeof action === 'string') {
        acc[action] = [];
      }
      return acc;
    },
    {} as Record<Action, Permission[]>
  );

  // Populate the mapping by iterating through permissionActions
  Object.entries(permissionActions).forEach(([permissionKey, {actions}]) => {
    const permission = permissionKey as Permission;

    // Add this permission to each action it grants
    actions.forEach(action => {
      mapping[action].push(permission);
    });
  });

  return mapping;
})();

// =====================================
// ROLES
// =====================================

// Roles grant collections of permissions. These could be permissions for a
// given resource, or general permissions.
export enum Role {
  // GLOBAl ROLES
  // ================
  GENERAL_USER = 'GENERAL_USER',
  GENERAL_ADMIN = 'GENERAL_ADMIN',
  GENERAL_CREATOR = 'GENERAL_CREATOR',

  // PROJECT ROLES
  // ================
  PROJECT_GUEST = 'PROJECT_GUEST',
  PROJECT_CONTRIBUTOR = 'PROJECT_CONTRIBUTOR',
  PROJECT_MANAGER = 'PROJECT_MANAGER',
  PROJECT_ADMIN = 'PROJECT_ADMIN',

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
  GLOBAL = 'GLOBAL',
  // Must be assigned per resource
  RESOURCE_SPECIFIC = 'RESOURCE_SPECIFIC',
}

// Define role details type with metadata
export interface RoleDetails {
  name: string;
  description: string;
  scope: RoleScope;
  // If resource scoped - can specify this here
  resource?: Resource;
}

// Map each role to its details
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

// Maps resources into a list of role details + Role enum so you can ask the
// question 'what roles are available for this type of resource'
export const resourceRoles: Record<Resource, (RoleDetails & {role: Role})[]> =
  Object.entries(roleDetails).reduce(
    (acc, [role, details]) => {
      // Only process roles mapped specifically to resources
      if (details.resource) {
        // Initialize the array if this is the first role for this resource
        if (!acc[details.resource]) {
          acc[details.resource] = [];
        }

        // Add the role details with the role enum value included
        acc[details.resource].push({
          ...details,
          role: role as unknown as Role,
        });
      }
      return acc;
    },
    {} as Record<Resource, (RoleDetails & {role: Role})[]>
  );

// Map roles to the permissions they grant - roles can also grant child role(s)
export const rolePermissions: Record<
  Role,
  {permissions: Permission[]; alsoGrants?: Role[]}
> = {
  // PROJECT ROLES
  // =============
  [Role.PROJECT_GUEST]: {
    permissions: [
      Permission.PROJECT_DATA_ADD,
      Permission.PROJECT_DATA_READ_MINE,
      Permission.PROJECT_VIEW,
    ],
    alsoGrants: [],
  },
  [Role.PROJECT_CONTRIBUTOR]: {
    permissions: [
      Permission.PROJECT_DATA_READ_ALL,
      Permission.PROJECT_DATA_EDIT_ALL,
      Permission.PROJECT_DATA_DELETE_ALL,
    ],
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

  // GLOBAL ROLES
  // =============
  [Role.GENERAL_USER]: {
    permissions: [Permission.PROJECT_LIST, Permission.TEMPLATE_VIEW],
    alsoGrants: [],
  },
  [Role.GENERAL_ADMIN]: {
    permissions: [Permission.USER_MANAGE, Permission.SYSTEM_MANAGE],
    alsoGrants: [Role.GENERAL_CREATOR, Role.PROJECT_ADMIN],
  },
  [Role.GENERAL_CREATOR]: {
    permissions: [
      Permission.PROJECT_CREATE,
      Permission.TEMPLATE_CREATE,
      Permission.TEMPLATE_EDIT,
      Permission.TEMPLATE_DELETE,
    ],
    alsoGrants: [],
  },
};
