# Database Migration System Documentation

## Overview

In `library/data-model/data-storage/migration` is a structured framework for managing database schema evolution across multiple PouchDB databases in our application. It provides a systematic way to apply incremental changes to database structures while maintaining data integrity and tracking migration history.

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
export type DATABASE_TYPE =
  | 'auth'
  | 'data'
  | 'directory'
  | 'invites'
  | 'metadata'
  | 'people'
  | 'projects'
  | 'templates';
```

### Versioning

Each database type has:

- A **default version**: The initial version for new databases
- A **target version**: The latest version that databases should be migrated to

### Migration Path

Migrations are defined as incremental steps from one version to the next (e.g., v1 to v2). The system ensures there are no gaps in migration paths.

### Migration Functions

Each migration is implemented as a function that:

1. Takes a document as input
2. Transforms it according to the new schema
3. Returns whether the document needs updating and the updated document if applicable

## Adding a New Migration

To add a new migration, follow these steps:

### 1. Update Target Versions

First, update the `DB_TARGET_VERSIONS` constant in `migrations.ts` to reflect the new target version:

```typescript
export const DB_TARGET_VERSIONS: {
  [key in DATABASE_TYPE]: {defaultVersion: number; targetVersion: number};
} = {
  // ...existing entries
  ['people']: {defaultVersion: 1, targetVersion: 3}, // Increment target version
  // ...
};
```

### 2. Create the Migration Function

Implement the migration function that will transform documents:

```typescript
const peopleV2toV3Migration = (
  record: PouchDB.Core.ExistingDocument<any>
): {
  writeNeeded: boolean;
  updatedRecord?: PouchDB.Core.ExistingDocument<any>;
} => {
  // Make a deep copy of the record to avoid modifying the original
  const updatedRecord = JSON.parse(JSON.stringify(record));

  // Perform your transformations
  // For example: add a new field, transform existing data, etc.
  updatedRecord.newField = 'default value';

  // If the record has a specific field, transform it
  if (updatedRecord.oldField) {
    updatedRecord.transformedField = processData(updatedRecord.oldField);
    // Optionally remove old fields no longer needed
    delete updatedRecord.oldField;
  }

  // Determine if the record needs to be written back to the database
  // Return false if no changes were made to avoid unnecessary writes
  const writeNeeded = !isEqual(record, updatedRecord);

  return {
    writeNeeded,
    updatedRecord: writeNeeded ? updatedRecord : undefined,
  };
};
```

Important guidelines for migration functions:

- Never modify the input record directly
- Always preserve document metadata (`_id` and `_rev`)
- Only return `writeNeeded: true` if the document actually changed
- Handle all edge cases (missing fields, null values, etc.)

### 3. Register the Migration

Add your migration to the `DB_MIGRATIONS` array in `migrations.ts`:

```typescript
export const DB_MIGRATIONS: MigrationDetails[] = [
  // ...existing migrations
  {
    dbType: 'people',
    from: 2,
    to: 3,
    description: 'Adds newField and transforms oldField into transformedField',
    migrationFunction: peopleV2toV3Migration,
  },
];
```

Ensure that:

- The `from` version matches the previous target version
- The `to` version matches the new target version
- The description clearly explains the purpose of the migration

### 4. Write Tests

Add test cases to verify your migration works correctly:

```typescript
// Add to MIGRATION_TEST_CASES array in the test file
{
  name: 'peopleV2toV3Migration - basic migration',
  dbType: 'people',
  from: 2,
  to: 3,
  inputDoc: {
    _id: 'user123',
    _rev: '1-abc123',
    name: 'John Doe',
    oldField: 'original value',
    // other v2 fields
  },
  expectedOutputDoc: {
    _id: 'user123',
    _rev: '1-abc123',
    name: 'John Doe',
    newField: 'default value',
    transformedField: 'processed original value',
    // other expected v3 fields
  },
  expectedResult: {
    writeNeeded: true,
    updatedRecord: {
      // Expected updated record (without _id and _rev)
      name: 'John Doe',
      newField: 'default value',
      transformedField: 'processed original value',
      // other expected v3 fields
    }
  }
},
// Add edge cases as needed
{
  name: 'peopleV2toV3Migration - no oldField',
  // ...details for testing a document without oldField
}
```

### 5. Run the Migration Script

```
# Migration Script Placeholder
# Instructions for running the migration script will go here
TODO
```
