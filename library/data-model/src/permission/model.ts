// Define the resources in the system
export enum Resource {
  // Projects/surveys/notebooks in the system
  PROJECT = 'PROJECT',

  // Templates in the system
  TEMPLATE = 'TEMPLATE',

  // Users in the system
  USER = 'USER',

  // Teams in the system
  TEAM = 'TEAM',

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
  CREATE_PROJECT = 'CREATE_PROJECT', // global

  // Read the high details of a project (e.g. description, title etc)
  READ_PROJECT_METADATA = 'READ_PROJECT_METADATA',
  // Update the project high level details (e.g. description, title etc)
  UPDATE_PROJECT_DETAILS = 'UPDATE_PROJECT_DETAILS',
  // Update the UI specification (we specify this as a separate action because
  // changing the ui spec of a project with existing records could mean that
  // records exist which are invalid/have extra/are missing data)
  UPDATE_PROJECT_UISPEC = 'UPDATE_PROJECT_UISPEC',

  // Read records hor the project which are mine
  READ_MY_PROJECT_RECORDS = 'READ_MY_PROJECT_RECORDS',
  // Read records for the project which are not mine
  READ_ALL_PROJECT_RECORDS = 'READ_ALL_PROJECT_RECORDS',

  // Create checksums of records for sync audit
  AUDIT_ALL_PROJECT_RECORDS = 'AUDIT_ALL_PROJECT_RECORDS',

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

  // Change team of a project
  CHANGE_PROJECT_TEAM = 'CHANGE_PROJECT_TEAM',

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

  // View list of projects
  LIST_TEMPLATES = 'LIST_TEMPLATES', // global

  // Create a new project
  CREATE_TEMPLATE = 'CREATE_TEMPLATE', // global

  // Read the high details of a template (e.g. description, title etc)
  READ_TEMPLATE_DETAILS = 'READ_TEMPLATE_DETAILS',

  // Update the template high level details (e.g. description, title etc)
  UPDATE_TEMPLATE_DETAILS = 'UPDATE_TEMPLATE_DETAILS',

  // Update the UI specification
  UPDATE_TEMPLATE_UISPEC = 'UPDATE_TEMPLATE_UISPEC',

  // Change open/closed status
  CHANGE_TEMPLATE_STATUS = 'CHANGE_TEMPLATE_STATUS',

  // Delete the project
  DELETE_TEMPLATE = 'DELETE_TEMPLATE',

  // ============================================================
  // TEAM ACTIONS
  // ============================================================

  // CRUD (global)
  CREATE_TEAM = 'CREATE_TEAM',

  // CRUD (resource specific)
  CREATE_PROJECT_IN_TEAM = 'CREATE_PROJECT_IN_TEAM',
  CREATE_TEMPLATE_IN_TEAM = 'CREATE_TEMPLATE_IN_TEAM',
  DELETE_TEAM = 'DELETE_TEAM',
  UPDATE_TEAM_DETAILS = 'UPDATE_TEAM_DETAILS',
  VIEW_TEAM_DETAILS = 'VIEW_TEAM_DETAILS',
  VIEW_TEAM_MEMBERS = 'VIEW_TEAM_MEMBERS',

  // Direct management
  ADD_ADMIN_TO_TEAM = 'ADD_ADMIN_TO_TEAM',
  ADD_MANAGER_TO_TEAM = 'ADD_MANAGER_TO_TEAM',
  ADD_MEMBER_TO_TEAM = 'ADD_MEMBER_TO_TEAM',

  REMOVE_ADMIN_FROM_TEAM = 'REMOVE_ADMIN_FROM_TEAM',
  REMOVE_MANAGER_FROM_TEAM = 'REMOVE_MANAGER_FROM_TEAM',
  REMOVE_MEMBER_FROM_TEAM = 'REMOVE_MEMBER_FROM_TEAM',

  // Invitations and sharing - note there is create, edit and delete for each
  // role level
  VIEW_TEAM_INVITES = 'VIEW_TEAM_INVITES',

  CREATE_MEMBER_TEAM_INVITE = 'CREATE_MEMBER_TEAM_INVITE',
  EDIT_MEMBER_TEAM_INVITE = 'EDIT_MEMBER_TEAM_INVITE',
  DELETE_MEMBER_TEAM_INVITE = 'DELETE_MEMBER_TEAM_INVITE',

  CREATE_MANAGER_TEAM_INVITE = 'CREATE_MANAGER_TEAM_INVITE',
  EDIT_MANAGER_TEAM_INVITE = 'EDIT_MANAGER_TEAM_INVITE',
  DELETE_MANAGER_TEAM_INVITE = 'DELETE_MANAGER_TEAM_INVITE',

  CREATE_ADMIN_TEAM_INVITE = 'CREATE_ADMIN_TEAM_INVITE',
  EDIT_ADMIN_TEAM_INVITE = 'EDIT_ADMIN_TEAM_INVITE',
  DELETE_ADMIN_TEAM_INVITE = 'DELETE_ADMIN_TEAM_INVITE',

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

  // ============================================================
  // LONG LIVED TOKEN ACTIONS
  // ============================================================

  // Create a new long-lived token for yourself
  CREATE_LONG_LIVED_TOKEN = 'CREATE_LONG_LIVED_TOKEN',

  // Read your own long-lived tokens
  READ_MY_LONG_LIVED_TOKENS = 'READ_MY_LONG_LIVED_TOKENS',

  // Read all long-lived tokens in the system (admin)
  READ_ANY_LONG_LIVED_TOKENS = 'READ_ANY_LONG_LIVED_TOKENS',

  // Edit your own long-lived tokens (metadata only)
  EDIT_MY_LONG_LIVED_TOKEN = 'EDIT_MY_LONG_LIVED_TOKEN',

  // Edit any long-lived token in the system (admin)
  EDIT_ANY_LONG_LIVED_TOKEN = 'EDIT_ANY_LONG_LIVED_TOKEN',

  // Revoke your own long-lived tokens
  REVOKE_MY_LONG_LIVED_TOKEN = 'REVOKE_MY_LONG_LIVED_TOKEN',

  // Revoke any long-lived token in the system (admin)
  REVOKE_ANY_LONG_LIVED_TOKEN = 'REVOKE_ANY_LONG_LIVED_TOKEN',

  // ============================================================
  // SYSTEM ACTIONS
  // ============================================================

  // API initialise action e.g. db migrations, initialisation, keys
  INITIALISE_SYSTEM_API = 'INITIALISE_SYSTEM_API',
  VALIDATE_DBS = 'VALIDATE_DBS',
  RESTORE_FROM_BACKUP = 'RESTORE_FROM_BACKUP',
  SEND_TEST_EMAIL = 'SEND_TEST_EMAIL',
  VERIFY_EMAIL = 'VERIFY_EMAIL',
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
  [Action.CREATE_PROJECT_IN_TEAM]: {
    name: 'Create Project (In team)',
    description: 'Create a new project inside a given team',
    resourceSpecific: true,
    resource: Resource.TEAM,
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
      'View records for a project which were created by the current user',
    resourceSpecific: true,
    resource: Resource.PROJECT,
  },
  [Action.AUDIT_ALL_PROJECT_RECORDS]: {
    name: 'Audit All Project Records',
    description: 'Create an audit record of all records for a project',
    resourceSpecific: true,
    resource: Resource.PROJECT,
  },
  [Action.READ_ALL_PROJECT_RECORDS]: {
    name: 'Read All Project Records',
    description:
      'View all records for a project, including those created by other users',
    resourceSpecific: true,
    resource: Resource.PROJECT,
  },
  [Action.CREATE_PROJECT_RECORD]: {
    name: 'Create Project Record',
    description: 'Add a new record/records to a project',
    resourceSpecific: true,
    resource: Resource.PROJECT,
  },
  [Action.EDIT_MY_PROJECT_RECORDS]: {
    name: 'Edit My Project Records',
    description:
      'Modify records in a project that were created by the current user',
    resourceSpecific: true,
    resource: Resource.PROJECT,
  },
  [Action.EDIT_ALL_PROJECT_RECORDS]: {
    name: 'Edit All Project Records',
    description:
      'Modify any records in a project, including those created by other users',
    resourceSpecific: true,
    resource: Resource.PROJECT,
  },
  [Action.DELETE_MY_PROJECT_RECORDS]: {
    name: 'Delete My Project Records',
    description:
      'Remove records from a project that were created by the current user',
    resourceSpecific: true,
    resource: Resource.PROJECT,
  },
  [Action.DELETE_ALL_PROJECT_RECORDS]: {
    name: 'Delete All Project Records',
    description:
      'Remove any records from a project, including those created by other users',
    resourceSpecific: true,
    resource: Resource.PROJECT,
  },
  [Action.CHANGE_PROJECT_STATUS]: {
    name: 'Change Project Status',
    description: 'Modify the open/closed status of a project',
    resourceSpecific: true,
    resource: Resource.PROJECT,
  },
  [Action.CHANGE_PROJECT_TEAM]: {
    name: 'Change Project Team',
    description: 'Change the team associated with a project',
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

  // =====================================
  // TEAMS
  // =====================================

  // Global actions
  [Action.CREATE_TEAM]: {
    name: 'Create Team',
    description: 'Create a new team',
    resourceSpecific: false,
    resource: Resource.TEAM,
  },

  // Resource specific actions
  [Action.DELETE_TEAM]: {
    name: 'Delete Team',
    description: 'Permanently remove a team from the system',
    resourceSpecific: true,
    resource: Resource.TEAM,
  },
  [Action.UPDATE_TEAM_DETAILS]: {
    name: 'Update Team Details',
    description: 'Modify the details of a team (name, description, etc.)',
    resourceSpecific: true,
    resource: Resource.TEAM,
  },
  [Action.VIEW_TEAM_DETAILS]: {
    name: 'View Team Details',
    description: 'View the details of a specific team',
    resourceSpecific: true,
    resource: Resource.TEAM,
  },
  [Action.VIEW_TEAM_MEMBERS]: {
    name: 'View Team Members',
    description: 'View the list of members in a team and their roles',
    resourceSpecific: true,
    resource: Resource.TEAM,
  },

  [Action.ADD_ADMIN_TO_TEAM]: {
    name: 'Add Admin to Team',
    description: 'Grant a user administrator privileges for a specific team',
    resourceSpecific: true,
    resource: Resource.TEAM,
  },
  [Action.ADD_MANAGER_TO_TEAM]: {
    name: 'Add Manager to Team',
    description: 'Grant a user manager privileges for a specific team',
    resourceSpecific: true,
    resource: Resource.TEAM,
  },
  [Action.ADD_MEMBER_TO_TEAM]: {
    name: 'Add Member to Team',
    description: 'Add a user as a regular member to a specific team',
    resourceSpecific: true,
    resource: Resource.TEAM,
  },
  [Action.REMOVE_ADMIN_FROM_TEAM]: {
    name: 'Remove Admin from Team',
    description:
      'Revoke administrator privileges from a user for a specific team',
    resourceSpecific: true,
    resource: Resource.TEAM,
  },
  [Action.REMOVE_MANAGER_FROM_TEAM]: {
    name: 'Remove Manager from Team',
    description: 'Revoke manager privileges from a user for a specific team',
    resourceSpecific: true,
    resource: Resource.TEAM,
  },
  [Action.REMOVE_MEMBER_FROM_TEAM]: {
    name: 'Remove Member from Team',
    description: 'Remove a user from a specific team',
    resourceSpecific: true,
    resource: Resource.TEAM,
  },

  [Action.VIEW_TEAM_INVITES]: {
    name: 'View Team invitiations',
    description: 'View the list of existing invitations and their details',
    resourceSpecific: true,
    resource: Resource.TEAM,
  },
  [Action.CREATE_MEMBER_TEAM_INVITE]: {
    name: 'Create Member Team Invite',
    description: 'Generate an invitation with member access to a team',
    resourceSpecific: true,
    resource: Resource.TEAM,
  },
  [Action.EDIT_MEMBER_TEAM_INVITE]: {
    name: 'Edit Member Team Invite',
    description: 'Modify an existing member invitation to a team',
    resourceSpecific: true,
    resource: Resource.TEAM,
  },
  [Action.DELETE_MEMBER_TEAM_INVITE]: {
    name: 'Delete Member Team Invite',
    description: 'Remove an existing member invitation to a team',
    resourceSpecific: true,
    resource: Resource.TEAM,
  },
  [Action.CREATE_MANAGER_TEAM_INVITE]: {
    name: 'Create Manager Team Invite',
    description: 'Generate an invitation with manager access to a team',
    resourceSpecific: true,
    resource: Resource.TEAM,
  },
  [Action.EDIT_MANAGER_TEAM_INVITE]: {
    name: 'Edit Manager Team Invite',
    description: 'Modify an existing manager invitation to a team',
    resourceSpecific: true,
    resource: Resource.TEAM,
  },
  [Action.DELETE_MANAGER_TEAM_INVITE]: {
    name: 'Delete Manager Team Invite',
    description: 'Remove an existing manager invitation to a team',
    resourceSpecific: true,
    resource: Resource.TEAM,
  },
  [Action.CREATE_ADMIN_TEAM_INVITE]: {
    name: 'Create Admin Team Invite',
    description: 'Generate an invitation with admin access to a team',
    resourceSpecific: true,
    resource: Resource.TEAM,
  },
  [Action.EDIT_ADMIN_TEAM_INVITE]: {
    name: 'Edit Admin Team Invite',
    description: 'Modify an existing admin invitation to a team',
    resourceSpecific: true,
    resource: Resource.TEAM,
  },
  [Action.DELETE_ADMIN_TEAM_INVITE]: {
    name: 'Delete Admin Team Invite',
    description: 'Remove an existing admin invitation to a team',
    resourceSpecific: true,
    resource: Resource.TEAM,
  },

  // ============================================================
  // TEMPLATE ACTIONS
  // ============================================================
  [Action.LIST_TEMPLATES]: {
    name: 'List templates',
    description: 'View all templates in the system (which you can see)',
    resourceSpecific: false,
    resource: Resource.TEMPLATE,
  },
  [Action.CREATE_TEMPLATE]: {
    name: 'Create Template',
    description: 'Create a new template in the system',
    resourceSpecific: false,
    resource: Resource.TEMPLATE,
  },
  [Action.CREATE_TEMPLATE_IN_TEAM]: {
    name: 'Create Template (In team)',
    description: 'Create a new template inside a given team',
    resourceSpecific: true,
    resource: Resource.TEAM,
  },
  [Action.READ_TEMPLATE_DETAILS]: {
    name: 'View template',
    description:
      'View details of templates in the system you are authorised to see',
    resourceSpecific: true,
    resource: Resource.TEMPLATE,
  },
  [Action.UPDATE_TEMPLATE_UISPEC]: {
    name: 'Update Template UI Specification',
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
    name: 'Initialise System API',
    description:
      'Perform system initialisation tasks like database migrations and key setup',
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
  [Action.SEND_TEST_EMAIL]: {
    name: 'Send test email',
    description: 'Send test email in the API email service',
    resourceSpecific: false,
    resource: Resource.SYSTEM,
  },
  [Action.VERIFY_EMAIL]: {
    name: 'Verify an email address',
    description: 'Allows the user to generate a verification challenge email.',
    resourceSpecific: false,
    resource: Resource.SYSTEM,
  },

  // ============================================================
  // LONG LIVED TOKEN ACTIONS
  // ============================================================
  [Action.CREATE_LONG_LIVED_TOKEN]: {
    name: 'Create Long-Lived Token',
    description: 'Create a new long-lived token for API usage',
    resourceSpecific: false,
    resource: Resource.SYSTEM,
  },
  [Action.READ_MY_LONG_LIVED_TOKENS]: {
    name: 'Read My Long-Lived Tokens',
    description: 'View your own long-lived API tokens',
    resourceSpecific: false,
    resource: Resource.SYSTEM,
  },
  [Action.EDIT_MY_LONG_LIVED_TOKEN]: {
    name: 'Edit My Long-Lived Token',
    description: 'Modify the metadata of your own long-lived API tokens',
    resourceSpecific: false,
    resource: Resource.SYSTEM,
  },
  [Action.REVOKE_MY_LONG_LIVED_TOKEN]: {
    name: 'Revoke My Long-Lived Token',
    description: 'Revoke/disable your own long-lived API tokens',
    resourceSpecific: false,
    resource: Resource.SYSTEM,
  },
  [Action.READ_ANY_LONG_LIVED_TOKENS]: {
    name: 'Read Any Long-Lived Tokens',
    description: 'View all long-lived API tokens in the system',
    resourceSpecific: false,
    resource: Resource.SYSTEM,
  },
  [Action.EDIT_ANY_LONG_LIVED_TOKEN]: {
    name: 'Edit Any Long-Lived Token',
    description:
      'Modify the metadata of any long-lived API token in the system',
    resourceSpecific: false,
    resource: Resource.SYSTEM,
  },
  [Action.REVOKE_ANY_LONG_LIVED_TOKEN]: {
    name: 'Revoke Any Long-Lived Token',
    description: 'Revoke/disable any long-lived API token in the system',
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
      .filter(([, desc]) => desc.resource === resource)
      .map(([action]) => action as Action);
    return mapping;
  },
  {} as Record<Resource, Action[]>
);

// =====================================
// ROLES
// =====================================

// Roles grant collections of actions
export enum Role {
  // GLOBAL ROLES
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
  TEMPLATE_ADMIN = 'TEMPLATE_ADMIN',
  TEMPLATE_GUEST = 'TEMPLATE_GUEST',

  // TEAM ROLES
  // ================
  TEAM_MEMBER = 'TEAM_MEMBER',
  TEAM_MANAGER = 'TEAM_MANAGER',
  TEAM_ADMIN = 'TEAM_ADMIN',
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

  // Template roles
  [Role.TEMPLATE_ADMIN]: {
    name: 'Template Administrator',
    description: 'Full control over a template.',
    scope: RoleScope.RESOURCE_SPECIFIC,
    resource: Resource.TEMPLATE,
  },
  [Role.TEMPLATE_GUEST]: {
    name: 'Template Manager',
    description: 'Guest access to a template.',
    scope: RoleScope.RESOURCE_SPECIFIC,
    resource: Resource.TEMPLATE,
  },

  // Team roles
  [Role.TEAM_ADMIN]: {
    name: 'Team Administrator',
    description:
      'Full control over a specific team, including deletion and admin user management',
    scope: RoleScope.RESOURCE_SPECIFIC,
    resource: Resource.TEAM,
  },
  [Role.TEAM_MANAGER]: {
    name: 'Team Manager',
    description:
      'Can manage team settings and member permissions within a team',
    scope: RoleScope.RESOURCE_SPECIFIC,
    resource: Resource.TEAM,
  },
  [Role.TEAM_MEMBER]: {
    name: 'Team Member',
    description: 'Basic membership in a team with standard access privileges',
    scope: RoleScope.RESOURCE_SPECIFIC,
    resource: Resource.TEAM,
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

// Map roles directly to the actions they grant
export const roleActions: Record<
  Role,
  {
    actions: Action[];
    inheritedRoles?: Role[];
    virtualRoles?: Map<Resource, Role[]>;
  }
> = {
  // PROJECT ROLES
  [Role.PROJECT_GUEST]: {
    actions: [
      Action.READ_PROJECT_METADATA,
      Action.CREATE_PROJECT_RECORD,
      Action.READ_MY_PROJECT_RECORDS,
      Action.EDIT_MY_PROJECT_RECORDS,
      Action.DELETE_MY_PROJECT_RECORDS,
      Action.AUDIT_ALL_PROJECT_RECORDS,
    ],
  },
  [Role.PROJECT_CONTRIBUTOR]: {
    actions: [
      Action.READ_ALL_PROJECT_RECORDS,
      Action.EDIT_ALL_PROJECT_RECORDS,
      Action.DELETE_ALL_PROJECT_RECORDS,
    ],
    inheritedRoles: [Role.PROJECT_GUEST],
  },
  [Role.PROJECT_MANAGER]: {
    actions: [
      Action.UPDATE_PROJECT_DETAILS,
      Action.UPDATE_PROJECT_UISPEC,
      Action.CHANGE_PROJECT_STATUS,
      Action.CHANGE_PROJECT_TEAM,
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
      Action.ADD_GUEST_TO_PROJECT,
      Action.REMOVE_GUEST_FROM_PROJECT,
      Action.ADD_CONTRIBUTOR_TO_PROJECT,
      Action.REMOVE_CONTRIBUTOR_FROM_PROJECT,
      Action.ADD_MANAGER_TO_PROJECT,
      Action.REMOVE_MANAGER_FROM_PROJECT,
    ],
    inheritedRoles: [Role.PROJECT_CONTRIBUTOR],
  },
  [Role.PROJECT_ADMIN]: {
    actions: [
      Action.CREATE_ADMIN_PROJECT_INVITE,
      Action.EDIT_ADMIN_PROJECT_INVITE,
      Action.DELETE_ADMIN_PROJECT_INVITE,
      Action.DELETE_PROJECT,
      Action.ADD_ADMIN_TO_PROJECT,
      Action.REMOVE_ADMIN_FROM_PROJECT,
      Action.GENERATE_RANDOM_PROJECT_RECORDS,
    ],
    inheritedRoles: [Role.PROJECT_MANAGER],
  },

  // TEMPLATE ROLES
  [Role.TEMPLATE_GUEST]: {
    actions: [Action.READ_TEMPLATE_DETAILS],
  },
  [Role.TEMPLATE_ADMIN]: {
    actions: [
      Action.UPDATE_TEMPLATE_DETAILS,
      Action.UPDATE_TEMPLATE_UISPEC,
      Action.CHANGE_TEMPLATE_STATUS,
      Action.DELETE_TEMPLATE,
    ],
    inheritedRoles: [Role.TEMPLATE_GUEST],
  },

  // GLOBAL ROLES
  [Role.GENERAL_USER]: {
    actions: [
      Action.LIST_PROJECTS,
      Action.LIST_TEMPLATES,
      Action.VERIFY_EMAIL,

      // Long-lived token actions for own tokens (CRUD)
      Action.CREATE_LONG_LIVED_TOKEN,
      Action.READ_MY_LONG_LIVED_TOKENS,
      Action.EDIT_MY_LONG_LIVED_TOKEN,
      Action.REVOKE_MY_LONG_LIVED_TOKEN,
    ],
  },
  [Role.GENERAL_CREATOR]: {
    actions: [Action.CREATE_PROJECT, Action.CREATE_TEMPLATE],
  },
  [Role.GENERAL_ADMIN]: {
    actions: [
      Action.VIEW_USER_LIST,
      Action.ADD_OR_REMOVE_GLOBAL_USER_ROLE,
      Action.RESET_USER_PASSWORD,
      Action.DELETE_USER,
      Action.INITIALISE_SYSTEM_API,
      Action.RESTORE_FROM_BACKUP,
      Action.VALIDATE_DBS,
      Action.CREATE_TEAM,
      Action.SEND_TEST_EMAIL,

      // These are special permissions!
      Action.ADD_ADMIN_TO_TEAM,
      Action.REMOVE_ADMIN_FROM_TEAM,

      // admin team invites CRUD
      Action.CREATE_ADMIN_TEAM_INVITE,
      Action.EDIT_ADMIN_TEAM_INVITE,
      Action.DELETE_ADMIN_TEAM_INVITE,

      // Long-lived token admin actions
      Action.READ_ANY_LONG_LIVED_TOKENS,
      Action.EDIT_ANY_LONG_LIVED_TOKEN,
      Action.REVOKE_ANY_LONG_LIVED_TOKEN,
    ],
    inheritedRoles: [
      // God role
      Role.GENERAL_CREATOR,
      Role.PROJECT_ADMIN,
      Role.TEAM_ADMIN,
      Role.TEMPLATE_ADMIN,
    ],
  },

  // TEAM ROLES
  [Role.TEAM_MEMBER]: {
    actions: [Action.VIEW_TEAM_DETAILS, Action.VIEW_TEAM_MEMBERS],
    virtualRoles: new Map([
      // Projects owned by team -> contributor
      [Resource.PROJECT, [Role.PROJECT_CONTRIBUTOR]],
      // Template owned by team -> guest
      [Resource.TEMPLATE, [Role.TEMPLATE_GUEST]],
    ]),
  },

  [Role.TEAM_MANAGER]: {
    actions: [
      // Other team based things
      Action.UPDATE_TEAM_DETAILS, // resource
      Action.ADD_MEMBER_TO_TEAM, // resource
      Action.REMOVE_MEMBER_FROM_TEAM, // resource

      // Being a manager of a team also gives you the ability to create new key
      // resources in that team
      Action.CREATE_PROJECT_IN_TEAM, // resource
      Action.CREATE_TEMPLATE_IN_TEAM, // resource

      // invites
      Action.VIEW_TEAM_INVITES,
      // member invites CRUD
      Action.CREATE_MEMBER_TEAM_INVITE,
      Action.EDIT_MEMBER_TEAM_INVITE,
      Action.DELETE_MEMBER_TEAM_INVITE,

      // manager invites CRUD
      Action.CREATE_MANAGER_TEAM_INVITE,
      Action.EDIT_MANAGER_TEAM_INVITE,
      Action.DELETE_MANAGER_TEAM_INVITE,
    ],
    // TODO make templates managed with their own roles/ownership model so that
    // we can do virtualRoles over templates owned by the team
    // NOTE this is a bit of a permission leak here re: general creator
    inheritedRoles: [Role.TEAM_MEMBER],
    // Projects owned by team -> manager
    virtualRoles: new Map([[Resource.PROJECT, [Role.PROJECT_MANAGER]]]),
  },

  [Role.TEAM_ADMIN]: {
    actions: [
      Action.DELETE_TEAM,
      Action.ADD_MANAGER_TO_TEAM,
      Action.REMOVE_MANAGER_FROM_TEAM,

      // These are special permissions!
      // -> moved to general admin only
      // Action.ADD_ADMIN_TO_TEAM,
      // Action.REMOVE_ADMIN_FROM_TEAM,
    ],
    inheritedRoles: [Role.TEAM_MANAGER],
    virtualRoles: new Map([
      // Projects owned by team -> manager
      [Resource.PROJECT, [Role.PROJECT_ADMIN]],
      // Template owned by team -> admin
      [Resource.TEMPLATE, [Role.TEMPLATE_ADMIN]],
    ]),
  },
};

/**
 * Utility function to get all actions for a role, including those from inherited roles
 */
export function getAllActionsForRole(role: Role): Action[] {
  const roleConfig = roleActions[role];
  const actions = [...roleConfig.actions];

  // Add actions from inherited roles
  if (roleConfig.inheritedRoles) {
    for (const inheritedRole of roleConfig.inheritedRoles) {
      actions.push(...getAllActionsForRole(inheritedRole));
    }
  }

  // Remove duplicates
  return [...new Set(actions)];
}

/**
 * Maps each action to the roles that grant it
 * This is automatically derived from the roleActions map
 */
export const actionRoles: Record<Action, Role[]> = (() => {
  // Initialize an empty mapping for all actions
  const mapping = Object.values(Action).reduce(
    (acc, action) => {
      if (typeof action === 'string') {
        acc[action] = [];
      }
      return acc;
    },
    {} as Record<Action, Role[]>
  );

  // For each role, determine all of its actions (including inherited ones)
  // and add this role to each action's list
  Object.entries(roleActions).forEach(([roleKey]) => {
    const role = roleKey as Role;
    const allActions = getAllActionsForRole(role);

    allActions.forEach(action => {
      if (!mapping[action].includes(role)) {
        mapping[action].push(role);
      }
    });
  });

  return mapping;
})();
