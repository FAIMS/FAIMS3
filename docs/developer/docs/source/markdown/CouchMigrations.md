# Database Migration System Documentation

## Overview

In `library/data-model/src/data-storage/migration` is a structured framework for managing database schema evolution across multiple PouchDB databases in our application. It provides a systematic way to apply incremental changes to database structures while maintaining data integrity and tracking migration history.

Includes:

- Version-controlled database schemas
- Incremental, one-way migrations
- Comprehensive logging of migration activities
- Batch processing to handle large datasets efficiently
- Error handling with detailed issue reporting
- Health status tracking for each database

The system maintains a separate migration metadata database that tracks the version and migration history of each application database, ensuring that migrations are applied exactly once and in the correct sequence.

## Core Concepts

### Database Types

The system recognizes several database types, each with its own versioning:

```typescript
export enum DatabaseType {
  AUTH = 'AUTH',
  DATA = 'DATA',
  DIRECTORY = 'DIRECTORY',
  INVITES = 'INVITES',
  METADATA = 'METADATA',
  PEOPLE = 'PEOPLE',
  PROJECTS = 'PROJECTS',
  TEMPLATES = 'TEMPLATES',
}
```

### Versioning

Each database type has:

- A **default version**: The assumed starting point for new databases
- A **target version**: The latest version that databases should be migrated to

### Migration Path

Migrations are defined as incremental steps from one version to the next (e.g., v1 to v2). The system ensures there are no gaps in migration paths.

### Migration Functions

Each migration is implemented as a function that:

1. Takes a document as input
2. Transforms it according to the new schema
3. Returns an action ('none', 'update', or 'delete') and the updated document if applicable

```typescript
export type MigrationFuncReturn = {
  action: 'none' | 'update' | 'delete';
  updatedRecord?: PouchDB.Core.ExistingDocument<any>;
};
```

## Adding a New Migration

To add a new migration, follow these steps:

### 1. Update Target Versions

First, update the `DB_TARGET_VERSIONS` constant in `migrations.ts` to reflect the new target version:

```typescript
export const DB_TARGET_VERSIONS: {
  [key in DATABASE_TYPE]: {defaultVersion: number; targetVersion: number};
} = {
  // ...existing entries
  [DatabaseType.PEOPLE]: {defaultVersion: 1, targetVersion: 3}, // Increment target version
  // ...
};
```

### 2. Create the Migration Function

Implement the migration function that will transform documents:

```typescript
const peopleV2toV3Migration: MigrationFunc = doc => {
  // Cast the input document to the correct type
  const inputDoc = doc as PouchDB.Core.ExistingDocument<UserV2Document>;

  // Create a copy of the input document for modifications
  const outputDoc: PouchDB.Core.ExistingDocument<UserV3Document> = {
    ...inputDoc,
    // Add new fields or transform existing ones
    newField: 'default value',
  };

  // If the record has a specific field, transform it
  if (inputDoc.someField) {
    outputDoc.transformedField = processData(inputDoc.someField);
    // Optionally remove old fields no longer needed
    delete outputDoc.someField;
  }

  // Return the action and updated record
  return {
    action: 'update',
    updatedRecord: outputDoc,
  };
};
```

Important guidelines for migration functions:

- Always preserve document metadata (`_id` and `_rev`)
- Use the 'none' action if no changes are needed
- Use the 'delete' action to remove documents
- Handle all edge cases (missing fields, null values, etc.)

### 3. Register the Migration

Add your migration to the `DB_MIGRATIONS` array in `migrations.ts`:

```typescript
export const DB_MIGRATIONS: MigrationDetails[] = [
  // ...existing migrations
  {
    dbType: DatabaseType.PEOPLE,
    from: 2,
    to: 3,
    description: 'Adds newField and transforms someField into transformedField',
    migrationFunction: peopleV2toV3Migration,
  },
];
```

Ensure that:

- The `from` version matches the previous target version
- The `to` version matches the new target version
- The description clearly explains the purpose of the migration

### 4. Write Tests

Add test cases to verify your migration works correctly. Tests should be added in `migrations/migrations.test.ts` as cases with the following format:

```typescript
/**
 * Test structure for migration functions
 */
type MigrationTestCase = {
  // Name of the migration test (for descriptive purposes)
  name: string;
  // type of database
  dbType: DatabaseType;
  // Migrating from
  from: number;
  // Migrating to
  to: number;
  // Input document to feed into migration function
  inputDoc: PouchDB.Core.ExistingDocument<any>;
  // Expected output document
  expectedOutputDoc: PouchDB.Core.ExistingDocument<any>;
  // Expected result type
  expectedResult: MigrationFuncReturn;
  // Custom equality function to compare docs - recommend using areDocsEqual
  equalityFunction?: (
    inputDoc: PouchDB.Core.ExistingDocument<any>,
    expectedOutputDoc: PouchDB.Core.ExistingDocument<any>
  ) => boolean;
};
```

Add your examples to the `MIGRATION_TEST_CASES` e.g.

```typescript
  {
    name: 'peopleV1toV2Migration - basic migration',
    dbType: DatabaseType.PEOPLE,
    from: 1,
    to: 2,
    inputDoc: {
      _id: 'abcd123456',
      _rev: '1234',
      user_id: 'abcd123456',
      name: 'George Costanza',
      emails: ['george.costanza@gmail.com'],
      roles: [
        'survey1||admin',
        'survey2||user',
        'cluster-admin',
        'notebook-creator',
      ],
      project_roles: {
        survey1: ['admin'],
        survey2: ['admin', 'user'],
      },
      other_roles: ['cluster-admin', 'notebook-creator'],
      owned: [],
      profiles: {
        local: {
          password: '1234',
          salt: '123456',
        },
      },
    } satisfies UserV1Document,
    expectedOutputDoc: {
      _id: 'abcd123456',
      _rev: '1234',
      user_id: 'abcd123456',
      name: 'George Costanza',
      emails: ['george.costanza@gmail.com'],
      resourceRoles: [
        {resourceId: 'survey1', role: Role.PROJECT_ADMIN},
        {resourceId: 'survey2', role: Role.PROJECT_CONTRIBUTOR},
      ],
      globalRoles: [
        Role.GENERAL_ADMIN,
        Role.GENERAL_CREATOR,
        Role.GENERAL_USER,
      ],
      profiles: {
        local: {
          password: '1234',
          salt: '123456',
        },
      },
    } satisfies UserV2Document,
    expectedResult: {action: 'update'},
    equalityFunction: areDocsEqual,
  },
```

### 5. Run the Migration

To run migrations, you need to ensure your `.env` and other environment is setup to target your deployment properly. This will require having admin credentials in your `.env` so proceed with caution for production environments.

## Migration Examples

### Example 1: People Database V1 to V2 Migration

This migration updates the people database to use a new permissions model:

```typescript
export const peopleV1toV2Migration: MigrationFunc = doc => {
  // Cast input to v1 type
  const inputDoc = doc as unknown as UserV1Document;

  // Map deprecated roles to new role structure
  const globalRoles: Role[] = [];
  const resourceRoles: ResourceRole[] = [];

  // All users are general users
  globalRoles.push(Role.GENERAL_USER);

  // Map deprecated global roles
  for (const deprecatedRole of inputDoc.other_roles) {
    if (deprecatedRole === 'cluster-admin') {
      globalRoles.push(Role.GENERAL_ADMIN);
    }
    if (deprecatedRole === 'notebook-creator') {
      globalRoles.push(Role.GENERAL_CREATOR);
    }
  }

  // Map project roles to resource roles
  for (const [projectId, projectRoles] of Object.entries(
    inputDoc.project_roles
  )) {
    for (const projectRole of projectRoles) {
      if (projectRole === 'admin') {
        resourceRoles.push({role: Role.PROJECT_ADMIN, resourceId: projectId});
      } else if (['moderator', 'team', 'user'].includes(projectRole)) {
        resourceRoles.push({
          role: Role.PROJECT_CONTRIBUTOR,
          resourceId: projectId,
        });
      } else {
        console.warn(
          'The project role ' +
            projectRole +
            ' could not be mapped to a new role - ignoring...'
        );
      }
    }
  }

  // Create output document with new structure
  const outputDoc: UserV2Document = {
    _id: inputDoc._id,
    _rev: inputDoc._rev,
    emails: inputDoc.emails,
    name: inputDoc.name,
    user_id: inputDoc.user_id,
    profiles: inputDoc.profiles,
    globalRoles,
    resourceRoles,
  };

  return {action: 'update', updatedRecord: outputDoc};
};
```

### Example 2: Invites Database V1 to V2 Migration

This migration updates the invites database to use a new role-based permission system:

```typescript
export const invitesV1toV2Migration: MigrationFunc = doc => {
  // Cast input document to V1 type
  const inputDoc =
    doc as unknown as PouchDB.Core.ExistingDocument<V1InviteDBFields>;

  // Map the old string roles to the new Role enum values
  let newRole: Role | null = null;
  const oldRole = inputDoc.role;

  if (oldRole === 'admin') {
    newRole = Role.PROJECT_ADMIN;
  } else if (['moderator', 'team', 'user'].includes(oldRole)) {
    newRole = Role.PROJECT_CONTRIBUTOR;
  } else {
    console.warn(
      'The project role ' +
        oldRole +
        ' could not be mapped to a new role - ignoring...'
    );
  }

  if (newRole === null) {
    console.warn(
      'The invite contained a role that is not understood. Deleting.'
    );
    return {action: 'delete'};
  }

  // Create the new V2 document structure
  const outputDoc: PouchDB.Core.ExistingDocument<V2InviteDBFields> = {
    _id: inputDoc._id,
    _rev: inputDoc._rev,
    projectId: inputDoc.project_id, // Rename field from project_id to projectId
    role: newRole,
  };

  return {action: 'update', updatedRecord: outputDoc};
};
```

### Example 3: Projects Database V1 to V2 Migration

This migration adds a new field to store project analytics and converts existing tags:

```typescript
export const projectsV1toV2Migration: MigrationFunc = doc => {
  // Cast input to v1 type
  const inputDoc = doc as unknown as ProjectV1Document;

  // Initialize analytics field
  const analytics = {
    createdAt: inputDoc.created_at || Date.now(),
    lastModified: Date.now(),
    viewCount: 0,
    collaboratorCount: Object.keys(inputDoc.collaborators || {}).length,
  };

  // Convert string tags to structured tag objects
  const tags = (inputDoc.tags || []).map(tag => ({
    id: generateId(),
    name: tag,
    color: getDefaultColorForTag(tag),
  }));

  // Create output document with new structure
  const outputDoc: ProjectV2Document = {
    _id: inputDoc._id,
    _rev: inputDoc._rev,
    name: inputDoc.name,
    description: inputDoc.description,
    ownerId: inputDoc.owner_id,
    collaborators: inputDoc.collaborators,
    status: inputDoc.status,
    analytics,
    tags,
    settings: inputDoc.settings || {
      isPublic: false,
      allowComments: true,
    },
  };

  return {action: 'update', updatedRecord: outputDoc};
};
```

### Example 4: Data Database V2 to V3 Migration (with Document Deletion)

This migration restructures data records and removes deprecated document types:

```typescript
export const dataV2toV3Migration: MigrationFunc = doc => {
  // Cast input to v2 type
  const inputDoc = doc as unknown as DataV2Document;

  // Check if this is a deprecated document type that should be removed
  if (inputDoc.type === 'deprecated_record') {
    return {action: 'delete'};
  }

  // For documents that need restructuring
  if (inputDoc.type === 'data_record') {
    // Create new structure
    const outputDoc: DataV3Document = {
      _id: inputDoc._id,
      _rev: inputDoc._rev,
      type: 'data_record',
      projectId: inputDoc.project_id,
      createdBy: inputDoc.user_id,
      timestamp: inputDoc.created_at,
      metadata: {
        source: inputDoc.source || 'unknown',
        format: inputDoc.format || 'default',
        version: '3.0',
      },
      content: inputDoc.data,
    };

    return {action: 'update', updatedRecord: outputDoc};
  }

  // For documents that don't need changes
  return {action: 'none'};
};
```

## Migration Process Workflow

1. **Initialisation**: The system checks if migration documents exist for each database, creating them if needed
2. **Version Check**: Each database's current version is compared to its target version
3. **Migration Planning**: Required migration steps are identified in sequence
4. **Execution**: Migrations are applied one at a time, with detailed logging
5. **Completion**: Migration documents are updated with results and status

The migration system handles common challenges like:

- Batch processing for large databases
- Graceful error handling with detailed logging
- Preserving document metadata during transformation
- Tracking migration history and database health
