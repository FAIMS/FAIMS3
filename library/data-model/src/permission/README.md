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
