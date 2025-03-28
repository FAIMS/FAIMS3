# Permissions Model Documentation

## Overview

This permissions system is built around Resources, Actions, and Roles. It provides a flexible way to manage user access across different parts of the application.

- **Resources**: Represent entities in the system (Projects, Templates, Users, System)
- **Actions**: Operations that can be performed on resources
- **Roles**: Collections of actions that can be assigned to users

There are two types of roles:

- **Global Roles**: Apply system-wide (General User, General Admin, General Creator)
- **Resource-Specific Roles**: Apply only to specific resources (Project Guest, Project Contributor, etc.)

## Core Concepts

### Resources and Actions

Each resource has a set of associated actions. Actions can be:

- **Resource-specific**: Require a specific resource ID (e.g., `READ_PROJECT_METADATA`)
- **Non-resource-specific**: Apply to all resources of a type (e.g., `LIST_PROJECTS`)

### Role Inheritance

Roles can inherit actions from other roles. For example, `PROJECT_CONTRIBUTOR` inherits all actions from `PROJECT_GUEST`.

### Token-Based Authorization

Authorization is managed through tokens that encode:

- Global roles
- Resource-specific roles with resource IDs
- `_couchdb.roles` which is a flattened representation of a) global roles e.g. `GENERAL_ADMIN` b) resource specific roles applied globally as granted from global roles e.g. `PROJECT_ADMIN` c) resource specific roles e.g. `survey123||PROJECT_GUEST`

CouchDB uses these roles in the `validate_doc_update` design document function and `member` array of the security document to enforce permissions.

## Usage Examples

### Checking User Permissions

```typescript
// Check if a user can perform an action on a specific resource
const canEdit = userCanDo({
  user,
  action: Action.EDIT_PROJECT_DETAILS,
  resourceId: 'project-123',
});

// Check if a user has a specific role for a resource
const isAdmin = userHasResourceRole({
  user,
  resourceRole: Role.PROJECT_ADMIN,
  resourceId: 'project-123',
});
```

The `app` code also provides a custom hook `useIsAuthorisedTo` which can be used to check the active user's right to perform a specific action:

```typescript
// Check user has the right role
const canCreateProject = useIsAuthorisedTo({action: Action.CREATE_PROJECT});
```

### Managing User Roles

```typescript
// Add a resource-specific role to a user
addResourceRole({
  user,
  role: Role.PROJECT_CONTRIBUTOR,
  resourceId: 'project-123',
});

// Remove a global role from a user
removeGlobalRole({
  user,
  role: Role.GENERAL_CREATOR,
});
```

### Token Authorization

```typescript
// Check if a token authorizes an action
const isAuthorized = isTokenAuthorized({
  token,
  action: Action.UPDATE_PROJECT_DETAILS,
  resourceId: 'project-123',
});
```

## Developer Guide

### Adding a New Resource

1. Add the resource to the `Resource` enum:

```typescript
export enum Resource {
  // Existing resources
  PROJECT = 'PROJECT',
  // New resource
  ORGANIZATION = 'ORGANIZATION',
}
```

2. Create actions for the new resource in the `Action` enum.
3. Add action details in the `actionDetails` record.
4. Determine which roles should grant this action in the `roleActions` map.

### Adding a New Action

1. Add the action to the `Action` enum in the appropriate section:

```typescript
export enum Action {
  // PROJECT ACTIONS
  // ...

  // New action
  ARCHIVE_PROJECT = 'ARCHIVE_PROJECT',
}
```

2. Add action details to the `actionDetails` record:

```typescript
[Action.ARCHIVE_PROJECT]: {
  name: 'Archive Project',
  description: 'Move a project to archived status',
  resourceSpecific: true,
  resource: Resource.PROJECT
}
```

3. Assign the action to appropriate roles in the `roleActions` mapping.

### Adding a New Role

1. Add the role to the `Role` enum:

```typescript
export enum Role {
  // Existing roles
  // ...

  // New role
  PROJECT_REVIEWER = 'PROJECT_REVIEWER',
}
```

2. Add role details to the `roleDetails` record:

```typescript
[Role.PROJECT_REVIEWER]: {
  name: 'Project Reviewer',
  description: 'Can review but not modify project data',
  scope: RoleScope.RESOURCE_SPECIFIC,
  resource: Resource.PROJECT
}
```

3. Define which actions the role grants in the `roleActions` mapping:

```typescript
[Role.PROJECT_REVIEWER]: {
  actions: [
    Action.READ_PROJECT_METADATA,
    Action.READ_ALL_PROJECT_RECORDS
  ],
  inheritedRoles: [Role.PROJECT_GUEST]
}
```

### Changing Role Actions

Modify the `roleActions` mapping to adjust which actions are granted by a role:

```typescript
[Role.PROJECT_CONTRIBUTOR]: {
  actions: [
    // Existing actions
    Action.READ_ALL_PROJECT_RECORDS,
    // New action
    Action.EXPORT_PROJECT_DATA
  ],
  inheritedRoles: [Role.PROJECT_GUEST]
}
```

## Best Practices

1. Use role inheritance to maintain a clean hierarchy.
2. Create resource-specific roles for granular control where necessary.
3. Always check actions (`userCanDo`) over roles when authorizing operations. This means that we can centrally update the permission model in the `data-model` rather than having to synchronise enforcement against multiple clients.
4. When adding new features, define the required actions first, then update roles.
