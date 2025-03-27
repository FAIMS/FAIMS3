# Permission Model

## Definitions

### User

The person or entity interacting with the system, attempting to perform 'actions' on 'resources'.

### Resource

A resource is an object/entity in the system which we want to protect. You require a 'permission', granted through your 'role' to take an 'action' on a 'resource'. E.g. `project`, `template`.

### Permission

A permission is a grant which provides the right for a user to undertake some action(s) on given resource(s). E.g. `write-project`.

### Role

A role is a label we grant to users which grants a set of permissions on a set of resources. E.g. `project-manager`.

### Action

An action is some task which a user wishes to undertake upon/involving some resource(s). E.g. `edit-project-specification`.

### Token

A token is a verifiable form of evidence presented by a user which proves that the user has certain permissions based on the user's roles.

## Permission system overview

Users are authorised to generate tokens which contain permissions. The system API knows everything about a user through the various system databases (e.g. their team membership, their relationship to various projects or templates), and generates on demand (when authenticated) a token which embeds all of the permissions that the user has at that time.

All other actors in the system then trust this token to provide evidence of user permissions.

When a user tries to take an action upon a resource, the permission model will perform the following check:

> Does the user have in their token a permission upon the targeted resource which authorises the requested action?

This will be checked through a centralised, configurable and complete permission model in the `data-model`.

This model is not replicated here, as it is best described/managed programmatically.

## Points of enforcement

The permission model needs to be enforced in these locations

### API

The system API needs to ensure that actions taken on resources are authorised. This is easy to achieve in the API as this is an always online service which has complete access to all resources relating to a user's permissions (e.g. databases, permission models) etc. The API also has the important responsibility of dispatching tokens which embed permissions on resources.

### CouchDB

The Couch DB needs to ensure that read/writes to the database(s) are authorised. This is achieved by looking only at **permissions** that the token includes. CouchDB has a primitive security model which only allows the following control points

1. The database has a security document which determines which roles must be present on a token in order to grant either a) member or b) admin access to a database. Member access = read, write and delete all documents. Admin access = everything.
2. `validate_doc_update` - this is a special method which can be embedded as a javascript function into the database which provides a runtime check of user's permissions before writing a document update. This allows fine grained document level control over **write operations**.

The overall approach for managing database permissions will be

1. For **all** system databases, only allow the `_admin` role to be a member or admin - this means only the API can interact with these databases at all
2. For **data** databases, only allow the `_admin` role to be admin, and allow **any read or write related permission for that project** to be a member
3. Restrict with `validate_doc_update` any write operations by checking that the user has the required write permission
4. Make use of replication filters to minimise data being made available where our permission model dictates it _shouldn't_ be, while acknowledging that a malicious actor can bypass this client side good behaviour by relying on other methods such as all doc or get requests.

#### Notable limitation

CouchDB cannot enforce per-document level read access checks, only write. There is no `validate_doc_read` - **any user with member access to the database can always fundamentally read any document in that database**. The only option we have to bypass this system limitation is to a) produce an intermediary service between the client and Couch or b) block certain routes/requests through some proxy service before it reaches Couch to only allow access to whitelisted sync points.

### Frontend clients

Front-end clients will optimistically enforce the permission model, not so much as a security measure, but as a UX measure, to ensure that actions are not presented on resources for which the frontend theoretically knows in advance will result in authorisation errors. For example, a 'create new project' button should not be presented unless the permission model dictates that the user can perform that action on the resource.

## Relevant source code references

TODO.


# Adding a new permission

## Overview of the Permission System

Our system uses a layered permission model:

1. **Resources** - Main entities in our system (PROJECT, TEMPLATE, USER, SYSTEM)
2. **Actions** - Specific operations that can be performed on resources
3. **Permissions** - Logical groupings of actions for easier management and reduction of redundancy in token claims
4. **Roles** - Collections of permissions assigned to users

## Step-by-Step Guide to Adding a New Permission

### 1. Define the New Action

First, add the new action to the `Action` enum. Actions represent the atomic operations that can be performed in the system.

```typescript
export enum Action {
  // Other actions...

  // Add your new action
  LIST_PROJECTS = 'LIST_PROJECTS',

  // Existing actions...
}
```

### 2. Add Action Details

For each action, we need to provide metadata in the `actionDetails` object:

```typescript
export const actionDetails: Record<Action, ActionDetails> = {
  // Other action details...

  // Add details for your new action
  [Action.LIST_PROJECTS]: {
    name: 'List Projects',
    description: 'Lists all high level details about projects in the system',
    resourceSpecific: false,
    resource: Resource.PROJECT,
  },

  // Existing action details...
};
```

The `resourceSpecific` flag indicates whether this action applies to a specific resource instance or to the resource type as a whole. For example, `LIST_PROJECTS` applies to all projects, so it's not resource-specific.

### 3. Define the New Permission or add to existing

Add your new permission to the `Permission` enum:

```typescript
export enum Permission {
  // Other permissions...

  // Add your new permission
  PROJECT_LIST = 'PROJECT_LIST',

  // Existing permissions...
}
```

Or if there is an existing permission you can group this action into, use that.

### 4. Map Permission to Actions

Define which actions this permission grants in the `permissionActions` object (either adding a new entry, or adding your action to the existing suitable permission)

```typescript
export const permissionActions: Record<
  Permission,
  {resource: Resource; actions: Action[]}
> = {
  // Other permission mappings...

  // Add mapping for your new permission
  [Permission.PROJECT_LIST]: {
    resource: Resource.PROJECT,
    actions: [Action.LIST_PROJECTS],
  },

  // Existing permission mappings...
};
```

Each permission maps to a specific resource type and grants one or more actions.

### 5. Update Role Permissions

Finally, assign the new permission to appropriate roles in the `rolePermissions` object:

```typescript
export const rolePermissions: Record<
  Role,
  {permissions: Permission[]; alsoGrants?: Role[]}
> = {
  // Other role mappings...

  // Update the appropriate role(s) to include the new permission
  [Role.GENERAL_USER]: {
    permissions: [Permission.PROJECT_VIEW, Permission.PROJECT_LIST],
    alsoGrants: [],
  },

  // Existing role mappings...
};
```

In this example, we added the `PROJECT_LIST` permission to the `GENERAL_USER` role, which means all users will be able to list projects.

## Understanding Permission Inheritance

Our system supports permission inheritance through roles:

- Roles can grant other roles via the `alsoGrants` property
- This creates a hierarchy of roles where higher roles implicitly have all permissions of lower roles
- For example, `PROJECT_ADMIN` grants the `PROJECT_MANAGER` role, which grants `PROJECT_CONTRIBUTOR`, which grants `PROJECT_GUEST`

### Action Naming Conventions

Actions typically follow a verb-noun pattern:

- `LIST_PROJECTS`
- `CREATE_PROJECT`
- `READ_PROJECT_METADATA`
- `UPDATE_PROJECT_DETAILS`

### Permission Grouping

Permissions often group related actions:

- `PROJECT_DATA_ADD` grants multiple related actions like `CREATE_PROJECT_RECORD`, `EDIT_MY_PROJECT_RECORDS`, etc.
- Consider what logical grouping makes sense for your new permission

### Resource-Specific vs. Global Permissions

- **Resource-Specific**: Applies to individual instances (e.g., a particular project)
- **Global**: Applies to all instances of a resource type (e.g., ability to list all projects)

## Automatic Mappings

The system automatically generates:

1. `resourceToActions`: Maps each resource to all actions that can be performed on it
2. `actionPermissions`: Maps each action to all permissions that grant it

These are derived from the mappings you define and don't need manual updates.

## Common Issues

1. **Permission Not Applied**: Ensure the permission is assigned to the appropriate roles
2. **Inheritance Issues**: Check the `alsoGrants` chain to ensure proper permission inheritance

By following this guide, you should be able to successfully add new permissions to the system and understand how they integrate with the existing role-based access control framework.
