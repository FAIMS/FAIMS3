# Database Migration System Documentation

## Overview

The Couch / Pouch migration framework lives under:

`library/data-model/src/data_storage/migrations/`

It manages **schema evolution** across the many CouchDB databases FAIMS uses (people, projects, per-project data and metadata, etc.). It tracks a **numeric version per physical database** in a dedicated **migrations** database, applies **per-document** transforms, and supports **global** steps that need several DB connections in one atomic operation.

Includes:

- Version-controlled database schemas (`DB_TARGET_VERSIONS` per `DatabaseType`)
- **Individual** migrations: one step per physical DB (`DB_MIGRATIONS`, always `from → from+1`)
- **Global** migrations: coordinated jumps across types (`GLOBAL_MIGRATIONS` in `globalMigrations.ts`)
- Comprehensive logging (`migrationLog` on each DB’s migration document; globals may set `globalMigrationId`)
- Batch processing inside each DB for large `allDocs` scans
- Error handling with detailed issue reporting; `not-healthy` status when a DB’s migration fails
- Static **network invariants** (`migrationNetworkInvariants.ts`) so there is a unique path from default to target version and globals cannot overlap individuals in conflicting ways

The migrations **metadata** database stores one document per `(DatabaseType, dbName)` pair, recording `version`, `status`, and `migrationLog` history.

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
  TEAMS = 'TEAMS',
}
```

### Versioning

Each database type has:

- A **default version**: The assumed starting point for new databases
- A **target version**: The latest version that databases should be migrated to

### Migration path (individual vs global)

**Individual** migrations in `DB_MIGRATIONS` are always a **single version increment** (`to === from + 1`). For each database type, the path from `defaultVersion` to `targetVersion` may consist only of those steps, or include **global** jumps registered in `GLOBAL_MIGRATIONS`.

**Global** migrations declare one or more **participants** (`dbType`, `from`, `to`, `multiplicity`). Each `dbType` appears at most once per global so matching is deterministic. Each participant is a version jump for that type (not limited to `+1`). A global’s `run(ctx)` receives matched handles via `GlobalMigrationRunContext.handles(dbType)` / `getUnique(dbType)`, and every physical DB in the batch by type via `allHandlesForType(dbType)` (see `globalMigrationTypes.ts` and `globalMigrationResolver.ts`).

**`multiplicity`**

- **`single`**: In the `migrateDbs` batch there must be exactly one physical DB of that type still behind target and at `from`. Use for server-wide singletons (directory, projects list, people, …) when the batch contains one handle of that type.
- **`all-of-type`**: Every physical DB of that type in the **same batch** that is still behind target must be at `from`, and all are upgraded together. Use when the batch lists many `METADATA` or `DATA` DBs (one per project) and the step must apply to **all** of them in that call, not a subset.

At runtime, `migrateDbs` (in `migrationService.ts`) **repeatedly**:

1. Runs **consecutive individual** steps for each DB that still needs work (while a `DB_MIGRATIONS` row exists for `currentVersion → currentVersion+1`).
2. If no individual progress is possible anywhere, tries the first matching **global** from `GLOBAL_MIGRATIONS` (see `findApplicableGlobalMigration`). Globals are rejected if they would only touch a **subset** of same-type DBs still needing work in the batch.

### Static network checks

`validateConfiguredMigrationNetwork()` in `migrationNetworkInvariants.ts` is used from tests (and should be kept green in CI): it checks duplicate individual edges, overlap between globals and individuals inside a global’s span, duplicate global ids, duplicate `dbType` rows within one global’s `participants`, and that each `DatabaseType` has a **unique** route from default to target using only allowed edges. See `tests/migrationNetworkInvariants.test.ts`.

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

First, update the `DB_TARGET_VERSIONS` constant in `library/data-model/src/data_storage/migrations/migrations.ts` to reflect the new target version:

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

Add your migration to the `DB_MIGRATIONS` array in the same `migrations.ts` file:

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

- `from` and `to` are consecutive (`to === from + 1`) for individual migrations
- The chain from `defaultVersion` to `targetVersion` remains valid (run `validateConfiguredMigrationNetwork()` or the Jest suite)
- The description clearly explains the purpose of the migration

### 4. Write Tests

Add test cases to verify your migration works correctly:

- Per-function examples: `library/data-model/tests/migrations.test.ts` (`MIGRATION_TEST_CASES` pattern described below)
- Service / `migrateDbs` behaviour: `library/data-model/tests/migrationService.test.ts`
- Migration graph invariants: `library/data-model/tests/migrationNetworkInvariants.test.ts`

Example structure for document-level migration tests:

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

## Adding a global (cross-database) migration

Use this when a change **cannot** be expressed as “read one doc from one DB, return update/delete” (e.g. copying fields from a per-project `METADATA` DB into a row in `PROJECTS`).

1. Add an entry to `GLOBAL_MIGRATIONS` in `library/data-model/src/data_storage/migrations/globalMigrations.ts` with a stable `id`, `description`, `participants`, and async `run(ctx)`.
2. Implement `run` using `GlobalMigrationRunContext`: **`ctx.handles(DatabaseType.X)`** / **`ctx.getUnique(DatabaseType.X)`** for **participant** types; **`ctx.allHandlesForType(DatabaseType.X)`** for every physical DB of that type in the **`migrateDbs`** batch (including non-participants such as `PEOPLE`, or all `DATA` / `METADATA` notebook DBs when you are not matching them as participants). **`ctx.allBatchHandles()`** is still the full raw list if you need it. Each `dbType` may appear **at most once** in `participants`, so matched lookup is deterministic.
3. Ensure **no** individual `DB_MIGRATIONS` row exists for any version **inside** a participant’s `[from, to)` for that `dbType` (enforced by `validateGlobalMigrationsAgainstIndividuals`).
4. Choose `single` vs `all-of-type` per participant row (see **Migration path** above).

After editing globals or targets, run the data-model tests so `validateConfiguredMigrationNetwork()` stays valid.

## Migration process workflow (`migrateDbs`)

1. **Load or create** migration documents for each `{ dbType, dbName }` in the `dbs` array (`migrationService.ts` / `getOrCreateMigrationDoc`).
2. **Loop** until every handle is at its `DB_TARGET_VERSIONS[dbType].targetVersion` (or a DB is left `not-healthy` after a failed attempt):
   - For each healthy DB behind target, apply **as many consecutive individual steps** as exist (`applyIndividualMigrationChain`).
   - If nothing progressed, try the first **global** whose participants all match current versions; `run` then bumps each participant’s migration `version` and appends log lines (with `globalMigrationId` when present).
3. **Logging**: Individual chains append one log entry per attempted chain; globals append one entry per participant DB.

The system also:

- Processes documents in batches per DB (`performMigration`)
- Preserves `_id` / `_rev` on updates unless deliberately removing a doc
- Records failures on the migration document and skips further automatic work on `not-healthy` DBs in the same run

## Related documentation

- **Notebook JSON migrations** (schema inside project/template payloads): `NotebookMigrations.md` — separate from Couch per-DB version numbers.
- **Couch database layout** (what each DB stores): `api/doc/DATABASE.md` (includes a short note on migration metadata).

---

## Walkthrough: simple individual vs complex global

The examples below are **illustrative** (version numbers and field names are made up). They show the shape of work you would do in `migrations.ts`, `globalMigrations.ts`, and the API that calls `migrateDbs`. Always align with real types in `projectsDB`, `templatesDB`, `peopleDB`, etc.

### A. Simple change — individual migration (new field from an old one)

**Goal:** On every document in the `templates` database, add a derived `slug` string from the existing `name` field when moving **v4 → v5** (illustrative next step after today’s `TemplateV4` wire shape in `templatesDB/types.ts`).

Follow the same stacking pattern as existing `TemplateV1Schema` … `TemplateV4Schema`: each Couch version gets an explicit type; the **current** exported `TemplateDBFieldsSchema` / `TemplateDBFields` should match the latest version consumers expect **after** the migration has run everywhere.

**1. Add the new wire type** in `library/data-model/src/data_storage/templatesDB/types.ts`:

```typescript
// V5 — URL-safe slug for listings (illustrative)
export const TemplateV5Schema = TemplateV4Schema.extend({
  slug: z.string().min(1),
});
export type TemplateV5Fields = z.infer<typeof TemplateV5Schema>;
export type TemplateV5Document = PouchDB.Core.Document<TemplateV5Fields>;

// Current (V5) — point “live” schema exports at the new version
export const TemplateDBFieldsSchema = TemplateV5Schema;
export type TemplateDBFields = z.infer<typeof TemplateDBFieldsSchema>;
// …update TemplateDocumentSchema / ExistingTemplateDocumentSchema to extend
// TemplateDBFieldsSchema.shape, same as for V4
```

Until production has caught up, some codebases keep the public `TemplateDBFields` on V4 and only switch after deploy; the important part is that the **migration function’s** input type is the **pre**-migration version (V4) and the written document matches V5.

**2. Bump the Couch migration target** in `library/data-model/src/data_storage/migrations/migrations.ts`:

```typescript
[DatabaseType.TEMPLATES]: {defaultVersion: 1, targetVersion: 5}, // was 4 → now 5
```

**3. Implement the migration function** in `migrations.ts` (or imported from a small module), following `MigrationFunc`. Import the **previous** wire type from `templatesDB/types.ts` (e.g. `TemplateV4Fields`) and cast each `doc` to that shape so TypeScript matches what is still on disk **before** the step runs:

```typescript
import type {TemplateV4Fields} from '../templatesDB/types'; // adjust path

const templatesV4toV5Migration: MigrationFunc = doc => {
  const input = doc as unknown as TemplateV4Fields & PouchDB.Core.ExistingDocument<unknown>;

  const slug = String(input.name ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');

  return {
    action: 'update',
    updatedRecord: {
      ...input,
      slug,
    },
  };
};
```

**4. Register the single-step edge** in `DB_MIGRATIONS` (must be exactly `from+1`):

```typescript
{
  dbType: DatabaseType.TEMPLATES,
  from: 4,
  to: 5,
  description: 'Adds slug derived from name',
  migrationFunction: templatesV4toV5Migration,
},
```

**5. Test** — add a row to `MIGRATION_TEST_CASES` in `library/data-model/tests/migrations.test.ts` (input v4-shaped doc, expected v5 doc with `slug`).

**6. Run** — `migrateDbs` receives the templates Pouch handle; it runs `performMigration` so **each non-design document** is passed through the function. No other DB is involved.

---

### B. Complex change — global migration (projects + templates, read people for context)

**Goal:** In **one** coordinated step, normalize audit fields on **both** the single `projects` Couch DB and the single `templates` Couch DB. Values such as `createdByUserId` / `createdAt` should be filled from a **conductor admin** id and timestamp **unless** the document already has a `last_updated_by_user_id` that matches a real person — in that case, copy display metadata from the **people** DB (read-only lookups). After the step, bump **projects** v10→v11 and **templates** v7→v8.

This cannot be done as two independent per-document migrations if the rules depend on **cross-checking both DBs and people in one pass** (and you want one atomic migration log step per DB).

The numbers below are **fictional**; in the real tree today projects are at **v3** and templates at **v4**—adapt the same steps to your actual `from` / `to`.

**1. Add new document types for the post-migration wire shape**

- **`library/data-model/src/data_storage/projectsDB/types.ts`** — Introduce the next version type the same way `ProjectV2Fields` / `ProjectV3Fields` are layered (manual `type` aliases today). Example:

```typescript
/** Projects DB v10 (before this global) — illustrative */
export type ProjectV10Fields = ProjectV3Fields; // …or your real prior shape

/** Projects DB v11 — adds audit fields written by the global */
export type ProjectV11Fields = ProjectV10Fields & {
  createdByUserId?: string;
  createdAt?: string;
  migratedAuditDisplayName?: string;
};
export type ProjectV11Document = PouchDB.Core.Document<ProjectV11Fields>;

/** Current stored shape after rollout */
export type ProjectDBFields = ProjectV11Fields;
export type ProjectDocument = PouchDB.Core.Document<ProjectDBFields>;
export type ExistingProjectDocument =
  PouchDB.Core.ExistingDocument<ProjectDBFields>;
```

- **`library/data-model/src/data_storage/templatesDB/types.ts`** — Mirror the `TemplateV4Schema.extend` pattern:

```typescript
export const TemplateV8Schema = TemplateV7Schema.extend({
  createdByUserId: z.string().optional(),
  createdAt: z.string().optional(),
  migratedAuditDisplayName: z.string().optional(),
});
export type TemplateV8Fields = z.infer<typeof TemplateV8Schema>;
// Repoint current exports: TemplateDBFieldsSchema = TemplateV8Schema, etc.
```

Use **`ProjectV10Fields` / `TemplateV7Fields`** (whatever is *currently* last on disk) as the **input** shape when reading rows inside `run`; `put` payloads should satisfy **`ProjectV11Fields` / `TemplateV8Fields`**. After the global succeeds, the migration service bumps each participant’s **Couch migration** `version` (`10→11`, `7→8`)—that is separate from any per-document `version` counter your template schema may already define.

**2. Bump Couch migration targets** in `migrations.ts` for **both** types (and do **not** add individual `DB_MIGRATIONS` rows for `10→11` or `7→8`—the **global** owns those spans; see `validateGlobalMigrationsAgainstIndividuals`).

```typescript
[DatabaseType.PROJECTS]: {defaultVersion: 1, targetVersion: 11},
[DatabaseType.TEMPLATES]: {defaultVersion: 1, targetVersion: 8},
```

**3. Register a global migration** in `globalMigrations.ts`:

**How matched handles relate to `participants`**

- Each row in `definition.participants` uses a distinct `dbType` (validated at startup).
- After a match, `ctx.matchedByDbType` maps each participant `dbType` to the `LoadedDbHandle[]` that satisfied that row (`from`, `multiplicity`). Use **`ctx.handles(DatabaseType.PROJECTS)`** or **`ctx.getUnique(DatabaseType.PROJECTS)`** when `multiplicity` is `single` (exactly one handle). For DB types that are **only** in the batch for context (e.g. `PEOPLE`), or when you want **every** notebook `DATA` handle regardless of participant matching, use **`ctx.allHandlesForType(DatabaseType.…)`** instead of manually filtering **`allBatchHandles()`**.
- Each `LoadedDbHandle` carries **`db`** (the Pouch/Couch interface), **`dbName`**, **`dbType`**, and **`migrationDoc`** (the migration-tracking document for *that* physical DB). `run` uses `.db` to read and write documents. In TypeScript, **`db` is `DatabaseInterface`** (same type each `migrateDbs` `dbs` entry passes). Document payloads inside `allDocs` rows are still **per-DB shapes**—you normally cast or narrow those (e.g. to your `ProjectV10Fields`) rather than expecting a single global doc type.

```typescript
{
  id: 'audit-fields-from-people-2026',
  description:
    'Fill audit fields on project and template docs using people DB lookups',
  participants: [
    {
      dbType: DatabaseType.PROJECTS,
      from: 10,
      to: 11,
      multiplicity: 'single',
    },
    {
      dbType: DatabaseType.TEMPLATES,
      from: 7,
      to: 8,
      multiplicity: 'single',
    },
  ],
  run: async ctx => {
    const projectsParticipant = ctx.getUnique(DatabaseType.PROJECTS);
    const templatesParticipant = ctx.getUnique(DatabaseType.TEMPLATES);

    const peopleInBatch = ctx.allHandlesForType(DatabaseType.PEOPLE);
    if (peopleInBatch.length === 0) {
      return {
        status: 'failure',
        issues: ['This global requires PEOPLE in the migrateDbs batch for lookups'],
      };
    }
    const peopleDb = peopleInBatch[0].db;
    const adminId = ctx.userId; // or resolve from env / config

    type DocRow = PouchDB.Core.ExistingDocument<Record<string, unknown>>;
    const enrich = async (
      db: DatabaseInterface,
      pickUserId: (doc: DocRow) => string | undefined
    ) => {
      const res = await db.allDocs({include_docs: true});
      for (const row of res.rows) {
        if (!row.doc || row.id.startsWith('_design/')) continue;
        const doc = row.doc as DocRow;
        const uid = pickUserId(doc);
        let displayName = 'Unknown';
        if (uid) {
          try {
            const person = (await peopleDb.get(uid)) as {name?: string};
            displayName = person.name ?? displayName;
          } catch {
            /* missing person doc */
          }
        }
        await db.put({
          ...doc,
          createdByUserId: doc.createdByUserId ?? adminId,
          createdAt: doc.createdAt ?? new Date().toISOString(),
          migratedAuditDisplayName: displayName,
        });
      }
    };

    try {
      await enrich(projectsParticipant.db, d =>
        typeof d.last_updated_by_user_id === 'string'
          ? d.last_updated_by_user_id
          : undefined
      );
      await enrich(templatesParticipant.db, d =>
        typeof d.last_updated_by_user_id === 'string'
          ? d.last_updated_by_user_id
          : undefined
      );
      return {status: 'success'};
    } catch (e: unknown) {
      return {
        status: 'failure',
        issues: [e instanceof Error ? e.message : String(e)],
      };
    }
  },
},
```

In this example, **PEOPLE** is not listed under `participants`, so its migration version does **not** change when this global runs; it is only present so `run` can query it via `ctx.allHandlesForType(DatabaseType.PEOPLE)` (typically one handle). **PROJECTS** and **TEMPLATES** must each be the only healthy, not-yet-at-target DB of that type in this batch (`multiplicity: 'single'`), and both must sit exactly at `from` when the global fires.

**5. Invariants** — after editing:

- Run `pnpm test` in `library/data-model` so `validateConfiguredMigrationNetwork()` passes (unique path, no overlapping individuals inside global spans, no ambiguous edges).
- Ensure the production `migrateDbs` invocation that should run this global actually includes **projects**, **templates**, and **people** in the same `dbs` array for that pass (subset checks apply only to **participant** types; you still must pass people if `run` reads it).

This pattern — **participants = DBs whose migration version advances**, **other handles in the batch = read-only context** — is the usual way to “use people while upgrading projects and templates in one go.”
