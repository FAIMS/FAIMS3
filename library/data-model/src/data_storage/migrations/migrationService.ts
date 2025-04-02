import {
  MigrationLog,
  MIGRATIONS_BY_DB_TYPE_AND_NAME_INDEX,
  MigrationsDB,
  MigrationsDBDocument,
  MigrationsDBFields,
} from '../migrationsDB';
import {DB_MIGRATIONS, DB_TARGET_VERSIONS} from './migrations';

// Check if we are testing
export const IS_TESTING = process.env.NODE_ENV === 'test';

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
export const DATABASE_TYPES = [
  DatabaseType.AUTH,
  DatabaseType.DATA,
  DatabaseType.DIRECTORY,
  DatabaseType.INVITES,
  DatabaseType.METADATA,
  DatabaseType.PEOPLE,
  DatabaseType.PROJECTS,
  DatabaseType.TEMPLATES,
  DatabaseType.TEAMS,
] as const;
export type DATABASE_TYPE = (typeof DATABASE_TYPES)[number];

export type DBTargetVersions = {
  [key in DatabaseType]: {defaultVersion: number; targetVersion: number};
};

export type MigrationFuncReturn = {
  action: 'none' | 'update' | 'delete';
  updatedRecord?: PouchDB.Core.ExistingDocument<any>;
};
export type MigrationFuncRecordInput = PouchDB.Core.ExistingDocument<any>;

export type MigrationFunc = (
  record: MigrationFuncRecordInput
) => MigrationFuncReturn;

export type MigrationDetails = {
  dbType: DATABASE_TYPE;
  from: number;
  description: string;
  to: number;
  migrationFunction: MigrationFunc;
};

function generateErrorLog({
  reason,
  migrationDoc,
}: {
  migrationDoc: MigrationsDBDocument;
  reason: string;
}): string {
  return `Issue with migration for db type: ${migrationDoc.dbType}, name: ${migrationDoc.dbName}. Reason: ${reason}. Database is at version: ${migrationDoc.version}.`;
}

/**
 * Builds a default migration document for a given database type and name.
 * This is used when initializing a database for the first time.
 *
 * @param {Object} params - The parameters object.
 * @param {DATABASE_TYPE} params.dbType - The type of database to create a migration document for.
 * @param {string} params.dbName - The fully qualified database name.
 * @returns {MigrationsDBFields} - A default migration document with initial values.
 */
export function buildDefaultMigrationDoc({
  dbType,
  dbName,
}: {
  dbType: DATABASE_TYPE;
  dbName: string;
}): MigrationsDBFields {
  const version = DB_TARGET_VERSIONS[dbType].defaultVersion;
  return {
    dbType: dbType,
    dbName: dbName,
    version,
    status: 'healthy',
    migrationLog: [
      {
        from: 0,
        to: version,
        startedAtTimestampMs: Date.now(),
        completedAtTimestampMs: Date.now(),
        launchedBy: 'system',
        status: 'success',
        notes:
          'Initial automatic DB migration. No operation performed - this assumes the default version.',
      },
    ],
  };
}

/**
 * Determines if the database is up to date based on the migration doc.
 * @returns True iff current version === target version
 */
export function isDbUpToDate({
  migrationDoc,
}: {
  migrationDoc: MigrationsDBDocument;
}): boolean {
  // Up to date defined to mean target version === current version
  return (
    DB_TARGET_VERSIONS[migrationDoc.dbType].targetVersion ===
    migrationDoc.version
  );
}

/**
 * Identifies the migration functions needed to migrate a database from its current version to the target version.
 *
 * @param {Object} params - The parameters object.
 * @param {MigrationsDBDocument} params.migrationDoc - The migration document containing database metadata.
 * @returns {MigrationFunc[]} - An ordered array of migration functions to be applied, from current to target version.
 * @throws {Error} - If the current version is greater than the target version, or if there are missing migrations.
 */
export function identifyMigrations({
  migrationDoc,
}: {
  migrationDoc: MigrationsDBDocument;
}): MigrationDetails[] {
  // get the target version
  const targetVersion = DB_TARGET_VERSIONS[migrationDoc.dbType].targetVersion;
  const currentVersion = migrationDoc.version;

  // if the current version > target version - throw error we can't handle this at the moment
  if (currentVersion > targetVersion) {
    throw Error(
      generateErrorLog({
        reason: `Cannot downgrade databases. The DB is at version ${currentVersion} and the target version is ${targetVersion}.`,
        migrationDoc,
      })
    );
  }

  // Equal - return no functions to run
  if (currentVersion === targetVersion) return [];

  // Find all appropriate migrations that need to be applied
  const migrationsToApply: MigrationDetails[] = [];

  // Iterate from current version to target version
  let version = currentVersion;

  while (version < targetVersion) {
    // Find the next migration
    const nextMigration = DB_MIGRATIONS.find(
      migration =>
        migration.dbType === migrationDoc.dbType &&
        migration.from === version &&
        migration.to === version + 1
    );

    // If no migration is found, throw an error
    if (!nextMigration) {
      throw Error(
        generateErrorLog({
          reason: `Missing migration from version ${version} to ${version + 1}.`,
          migrationDoc,
        })
      );
    }

    // Add the migration function to the list
    migrationsToApply.push(nextMigration);

    // Move to the next version
    version++;
  }

  return migrationsToApply;
}

/**
 * Performs a migration on all non-design documents in a PouchDB database.
 *
 * This function:
 * 1. Iterates through all non-design documents
 * 2. Applies the migration function to each document
 * 3. Updates documents that need changes
 * 4. Preserves the original _id and _rev fields
 * 5. Tracks and returns any issues encountered
 *
 * @param {Object} params - The parameters object.
 * @param {PouchDB.Database} params.db - The PouchDB database to migrate.
 * @param {MigrationFunc} params.migrationFunc - The migration function to apply to each document.
 * @returns {Object} - An object containing an array of issues encountered during migration.
 */
export async function performMigration({
  db,
  migrationFunc,
}: {
  db: PouchDB.Database;
  migrationFunc: MigrationFunc;
}): Promise<{
  issues: string[];
  processedCount: number;
  writtenCount: number;
  deletedCount: number;
}> {
  const issues: string[] = [];
  const processedIds = new Set<string>(); // Track IDs of processed documents
  let writtenCount = 0; // Track number of documents that were actually updated
  let deletedCount = 0; // Track number of documents that were deleted
  const batchSize = 100; // Number of documents to process in each batch
  let startKey = null;
  let hasMoreDocs = true;

  // Process documents in batches to avoid memory issues with large databases
  while (hasMoreDocs) {
    try {
      // Query for a batch of documents, excluding design documents
      const response: PouchDB.Core.AllDocsResponse<any> = await db.allDocs({
        include_docs: true,
        limit: batchSize,
        startkey: startKey ? startKey : undefined,
        skip: startKey ? 1 : 0, // Skip the last doc from previous batch if we have a startKey
      });

      // Exit the loop if no more documents
      if (response.rows.length === 0) {
        hasMoreDocs = false;
        continue;
      }

      // Update the startKey for the next batch
      startKey = response.rows[response.rows.length - 1].id;

      // Process each document in the batch
      for (const row of response.rows) {
        // Skip design documents and already processed documents
        if (row.id.startsWith('_design/') || processedIds.has(row.id)) {
          continue;
        }

        const doc = row.doc;
        if (!doc) continue;

        // Add the document ID to the set of processed IDs
        processedIds.add(row.id);

        try {
          // Apply the migration function to the document
          const result = migrationFunc(doc);

          // If the migration indicates a write is needed, update the document
          if (result.action === 'update' && result.updatedRecord) {
            // Preserve the original _id and _rev
            const updatedRecord = {
              ...result.updatedRecord,
              _id: doc._id,
              _rev: doc._rev,
            };

            // Put the updated document back to the database
            await db.put(updatedRecord);
            writtenCount++;
          }

          // If the migration indicates a write is needed, update the document
          if (result.action === 'delete') {
            // Put the updated document back to the database deleted
            await db.remove(doc);
            deletedCount++;
          }
        } catch (error) {
          // Capture any issues with this specific document
          issues.push(
            `Error migrating document ${doc._id}: ${error instanceof Error ? error.message : String(error)}.`
          );
        }
      }
    } catch (error) {
      // Capture any batch-level issues
      issues.push(
        `Error processing batch: ${error instanceof Error ? error.message : String(error)}`
      );
      hasMoreDocs = false; // Stop processing on batch-level errors
    }
  }

  return {
    issues,
    processedCount: processedIds.size,
    writtenCount,
    deletedCount,
  };
}

/**
 * Migrates multiple databases to their target versions.
 *
 * This function handles the entire migration process for multiple databases:
 * 1. Retrieves or creates migration documents for each database
 * 2. Checks if each database is up to date
 * 3. Identifies required migrations
 * 4. Executes migrations in the correct order
 * 5. Updates migration logs with results
 * 6. Updates the migration documents in the migration database
 *
 * @param dbs - Array of database objects to migrate.
 * @param migrationDb - The database that stores migration documents.
 * @param userId - The user ID to record for the migration log
 */
export async function migrateDbs({
  dbs,
  migrationDb,
  userId = 'system',
}: {
  dbs: {dbType: DatabaseType; dbName: string; db: PouchDB.Database}[];
  migrationDb: MigrationsDB;
  userId?: string;
}): Promise<void> {
  // Process each database one by one
  for (const {dbType, dbName, db} of dbs) {
    // Track migration start time
    const migrationStartTime = Date.now();

    try {
      // Try to find an existing migration document for this database
      const migrationDocs = await migrationDb.query<MigrationsDBFields>(
        MIGRATIONS_BY_DB_TYPE_AND_NAME_INDEX,
        {
          key: [dbType, dbName],
          include_docs: true,
        }
      );

      // Determine if we have an existing migration document or need to create one
      let migrationDoc: MigrationsDBDocument;

      if (migrationDocs.rows.length === 0) {
        // No existing migration document found, create a new one
        const defaultMigrationFields = buildDefaultMigrationDoc({
          dbType,
          dbName,
        });

        // Save the new migration document
        const response = await migrationDb.post(defaultMigrationFields);

        // Retrieve the created document with its _id and _rev
        migrationDoc = await migrationDb.get(response.id);
      } else {
        // Use the existing migration document
        migrationDoc = migrationDocs.rows[0].doc!;
      }

      // Check if the database is already up to date
      if (isDbUpToDate({migrationDoc})) {
        if (!IS_TESTING) {
          console.log(
            `Database ${dbName} (${dbType}) is already up to date at version ${migrationDoc.version}`
          );
        }
        continue; // Skip to the next database
      }

      // Database needs migration - identify required migration details
      const migrationsToApply = identifyMigrations({migrationDoc});

      // If no migrations are needed (this should not happen due to isDbUpToDate check, but as a safeguard)
      if (migrationsToApply.length === 0) {
        continue;
      }

      // Create a migration log entry to track this migration process
      const migrationLogEntry: MigrationLog = {
        from: migrationDoc.version,
        to: DB_TARGET_VERSIONS[dbType].targetVersion,
        startedAtTimestampMs: migrationStartTime,
        completedAtTimestampMs: 0, // Will be updated when migration completes
        launchedBy: userId,
        status: 'success', // Optimistic, will be updated if there are issues
        issues: [],
        notes: `Migrating from v${migrationDoc.version} to v${DB_TARGET_VERSIONS[dbType].targetVersion}`,
      };

      // Apply each migration in sequence
      let currentVersion = migrationDoc.version;

      for (const migrationDetail of migrationsToApply) {
        // Start migration for this step
        if (!IS_TESTING) {
          console.log(
            `Applying migration for ${dbType} from v${migrationDetail.from} to v${migrationDetail.to}: ${migrationDetail.description}`
          );
        }

        // Add the migration description to the notes
        if (!migrationLogEntry.notes) {
          migrationLogEntry.notes = '';
        }
        migrationLogEntry.notes += `\n- ${migrationDetail.description}`;

        // Perform the migration
        const result = await performMigration({
          db,
          migrationFunc: migrationDetail.migrationFunction,
        });

        // Log stats about this migration step
        if (!IS_TESTING) {
          console.log(
            `Migration step completed. Processed ${result.processedCount} documents, updated ${result.writtenCount} documents.`
          );
        }

        // Check for issues during migration
        if (result.issues.length > 0) {
          // Add these issues to the migration log
          migrationLogEntry.issues = [
            ...(migrationLogEntry.issues || []),
            ...result.issues,
          ];

          // If we have issues, mark the migration as failed
          migrationLogEntry.status = 'failure';

          // Don't continue running subsequent migrations if there were issues!
          break;
        } else {
          // Update the current version
          currentVersion = migrationDetail.to;
        }
      }

      // Complete the migration log entry
      migrationLogEntry.completedAtTimestampMs = Date.now();

      // Update the migration document (only to successful spot)
      migrationDoc.version = currentVersion;
      migrationDoc.status =
        migrationLogEntry.status === 'success' ? 'healthy' : 'not-healthy';
      migrationDoc.migrationLog = [
        ...migrationDoc.migrationLog,
        migrationLogEntry,
      ];

      // Save the updated migration document
      await migrationDb.put(migrationDoc);

      // Log completion status
      if (migrationLogEntry.status === 'success') {
        if (!IS_TESTING) {
          console.log(
            `Successfully migrated database ${dbName} (${dbType}) from version ${migrationLogEntry.from} to ${migrationLogEntry.to}`
          );
        }
      } else {
        if (!IS_TESTING) {
          console.error(
            `Migration of database ${dbName} (${dbType}) completed with issues. Check migration logs for details.`
          );
        }
      }
    } catch (error) {
      // Handle any unexpected errors in the migration process
      console.error(`Failed to migrate database ${dbName} (${dbType}):`, error);

      // Try to update the migration document to reflect the failure if possible
      try {
        // Try to find the migration document
        const migrationDocs = await migrationDb.query<MigrationsDBFields>(
          MIGRATIONS_BY_DB_TYPE_AND_NAME_INDEX,
          {
            key: [dbType, dbName],
            include_docs: true,
          }
        );

        if (migrationDocs.rows.length > 0) {
          const migrationDoc = migrationDocs.rows[0].doc!;

          // Create a failure log entry
          const failureLogEntry: MigrationLog = {
            from: migrationDoc.version,
            to: DB_TARGET_VERSIONS[dbType].targetVersion,
            startedAtTimestampMs: migrationStartTime,
            completedAtTimestampMs: Date.now(),
            launchedBy: userId,
            status: 'failure',
            notes: 'Migration failed due to an unexpected error',
            issues: [error instanceof Error ? error.message : String(error)],
          };

          // Update the migration document
          migrationDoc.status = 'not-healthy';
          migrationDoc.migrationLog = [
            ...migrationDoc.migrationLog,
            failureLogEntry,
          ];

          // Save the updated migration document
          await migrationDb.put(migrationDoc);
        }
      } catch (logError) {
        // At this point, we've failed to migrate and also failed to log the failure
        console.error(
          `Failed to log migration failure for ${dbName} (${dbType}):`,
          logError
        );
      }
    }
  }
}
