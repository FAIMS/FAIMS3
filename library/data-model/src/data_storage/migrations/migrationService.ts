import {DatabaseInterface} from '../../types';
import {
  MigrationLog,
  MIGRATIONS_BY_DB_TYPE_AND_NAME_INDEX,
  MigrationsDB,
  MigrationsDBDocument,
  MigrationsDBFields,
} from '../migrationsDB';
import {buildMigrationContext, DEFAULT_MIGRATION_CREATED_BY} from './hooks';
import {DB_MIGRATIONS, DB_TARGET_VERSIONS} from './migrations';
import {
  DATABASE_TYPE,
  DatabaseType,
  GetDbById,
  IS_TESTING,
  MigrationContext,
  MigrationDetails,
  MigrationFunc,
} from './types';

function generateErrorLog({
  reason,
  migrationDoc,
}: {
  migrationDoc: MigrationsDBDocument;
  reason: string;
}): string {
  return `Issue with migration for db type: ${migrationDoc.dbType}, name: ${migrationDoc.dbName}. Reason: ${reason}. Database is at version: ${migrationDoc.version}.`;
}

function migrateAudit(message: string, details?: Record<string, unknown>) {
  if (IS_TESTING) {
    return;
  }
  if (details) {
    console.log(`[migrate] ${message}`, details);
  } else {
    console.log(`[migrate] ${message}`);
  }
}

/** Handle passed to {@link migrateDbs}. */
export type MigrationDbHandle = {
  dbType: DATABASE_TYPE;
  dbName: string;
  db: DatabaseInterface;
};

/**
 * Minimal project shape needed to name and open a per-project data DB.
 * Supports current `dataDb` and legacy `data_db`.
 */
export type ProjectDataDbRef = {
  _id: string;
  dataDb?: {db_name?: string};
  data_db?: {db_name?: string};
};

export type QueuedProjectDataDb = MigrationDbHandle & {projectId: string};

/**
 * Couch database name for a project's data DB.
 *
 * Prefer the project document's `db_name` over `db.name`: Pouch handles opened
 * with a full Couch URL expose the URL as `.name`, which would key the
 * migration document incorrectly.
 */
export function dataDbNameForProject({
  project,
  fallbackName,
}: {
  project: ProjectDataDbRef;
  fallbackName: string;
}): string {
  return project.dataDb?.db_name ?? project.data_db?.db_name ?? fallbackName;
}

/**
 * Build the DATA migration queue from project documents.
 *
 * Must accumulate with push/reassign. `Array.concat` without assignment
 * silently discards every database and `migrateDbs` becomes a no-op.
 */
export async function collectProjectDataDbs({
  projects,
  openDataDb,
}: {
  projects: ProjectDataDbRef[];
  openDataDb: (projectId: string) => Promise<DatabaseInterface>;
}): Promise<{
  queued: QueuedProjectDataDb[];
  skipped: {projectId: string; error: unknown}[];
}> {
  const queued: QueuedProjectDataDb[] = [];
  const skipped: {projectId: string; error: unknown}[] = [];

  for (const project of projects) {
    const projectId = project._id;
    try {
      const dataDb = await openDataDb(projectId);
      queued.push({
        projectId,
        db: dataDb,
        dbType: DatabaseType.DATA,
        dbName: dataDbNameForProject({
          project,
          fallbackName: dataDb.name,
        }),
      });
    } catch (error) {
      skipped.push({projectId, error});
    }
  }

  return {queued, skipped};
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
 * @param {DatabaseInterface} params.db - The PouchDB database to migrate.
 * @param {MigrationFunc} params.migrationFunc - The migration function to apply to each document.
 * @param {GetDbById} params.getDbById - Opens other databases by type and id for cross-db migrations.
 * @param {string} params.migrationCreatedBy - Username for migrated `createdBy` audit fields.
 * @returns {Object} - An object containing an array of issues encountered during migration.
 */
export async function performMigration({
  db,
  migrationFunc,
  getDbById,
  migrationCreatedBy = DEFAULT_MIGRATION_CREATED_BY,
}: {
  db: DatabaseInterface;
  migrationFunc: MigrationFunc;
  getDbById: GetDbById;
  migrationCreatedBy?: string;
}): Promise<{
  issues: string[];
  processedCount: number;
  writtenCount: number;
  deletedCount: number;
}> {
  const context: MigrationContext = buildMigrationContext({
    getDbById,
    migrationCreatedBy,
    db,
  });
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
          const result = await Promise.resolve(migrationFunc(doc, context));

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

  const processedCount = processedIds.size;
  migrateAudit('Document scan complete', {
    processedCount,
    writtenCount,
    deletedCount,
    skippedCount: processedCount - writtenCount - deletedCount,
    issueCount: issues.length,
  });

  return {
    issues,
    processedCount,
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
 * @param getDbById - Opens other databases by type and id for cross-db migrations
 * @param migrationCreatedBy - Username for migrated `createdBy` audit fields on project/template docs
 */
export async function migrateDbs({
  dbs,
  migrationDb,
  userId = 'system',
  getDbById,
  migrationCreatedBy = DEFAULT_MIGRATION_CREATED_BY,
}: {
  dbs: MigrationDbHandle[];
  migrationDb: MigrationsDB;
  userId?: string;
  getDbById: GetDbById;
  migrationCreatedBy?: string;
}): Promise<void> {
  const migrationContext: MigrationContext = buildMigrationContext({
    getDbById,
    migrationCreatedBy,
  });

  migrateAudit('Starting migrateDbs', {
    databaseCount: dbs.length,
    databases: dbs.map(d => `${d.dbType}:${d.dbName}`),
  });

  let skippedUpToDate = 0;
  let migratedOk = 0;
  let migratedFailed = 0;

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

        migrateAudit('No migration document; creating at defaultVersion', {
          dbType,
          dbName,
          defaultVersion: defaultMigrationFields.version,
          targetVersion: DB_TARGET_VERSIONS[dbType].targetVersion,
        });

        // Save the new migration document
        const response = await migrationDb.post(defaultMigrationFields);

        // Retrieve the created document with its _id and _rev
        migrationDoc = await migrationDb.get(response.id);
      } else {
        // Use the existing migration document
        migrationDoc = migrationDocs.rows[0].doc!;
        migrateAudit('Found existing migration document', {
          dbType,
          dbName,
          version: migrationDoc.version,
          status: migrationDoc.status,
          targetVersion: DB_TARGET_VERSIONS[dbType].targetVersion,
        });
      }

      // Check if the database is already up to date
      if (isDbUpToDate({migrationDoc})) {
        migrateAudit('Database already at target version; skipping', {
          dbType,
          dbName,
          version: migrationDoc.version,
        });
        skippedUpToDate++;
        continue; // Skip to the next database
      }

      // Database needs migration - identify required migration details
      const migrationsToApply = identifyMigrations({migrationDoc});

      // If no migrations are needed (this should not happen due to isDbUpToDate check, but as a safeguard)
      if (migrationsToApply.length === 0) {
        migrateAudit(
          'No migration steps despite version mismatch; skipping',
          {
            dbType,
            dbName,
            version: migrationDoc.version,
            targetVersion: DB_TARGET_VERSIONS[dbType].targetVersion,
          }
        );
        skippedUpToDate++;
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
        migrateAudit('Applying migration step', {
          dbType,
          dbName,
          from: migrationDetail.from,
          to: migrationDetail.to,
          description: migrationDetail.description,
        });

        // Add the migration description to the notes
        if (!migrationLogEntry.notes) {
          migrationLogEntry.notes = '';
        }
        migrationLogEntry.notes += `\n- ${migrationDetail.description}`;

        // Perform the migration
        const result = await performMigration({
          db,
          migrationFunc: migrationDetail.migrationFunction,
          getDbById: migrationContext.getDbById,
          migrationCreatedBy: migrationContext.migrationCreatedBy,
        });

        migrateAudit('Migration step finished', {
          dbType,
          dbName,
          from: migrationDetail.from,
          to: migrationDetail.to,
          processedCount: result.processedCount,
          writtenCount: result.writtenCount,
          deletedCount: result.deletedCount,
          issueCount: result.issues.length,
        });
        if (result.issues.length > 0 && !IS_TESTING) {
          console.warn(
            `[migrate] Issues during ${dbType}:${dbName} v${migrationDetail.from}→v${migrationDetail.to}:`,
            result.issues
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

      if (migrationLogEntry.status === 'success') {
        migratedOk++;
        migrateAudit('Database migration succeeded', {
          dbType,
          dbName,
          from: migrationLogEntry.from,
          to: currentVersion,
        });
      } else {
        migratedFailed++;
        if (!IS_TESTING) {
          console.error(
            `[migrate] Database ${dbName} (${dbType}) completed with issues (now at v${currentVersion}; target v${DB_TARGET_VERSIONS[dbType].targetVersion})`
          );
        }
      }
    } catch (error) {
      migratedFailed++;
      // Handle any unexpected errors in the migration process
      console.error(
        `[migrate] Failed to migrate database ${dbName} (${dbType}):`,
        error
      );

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
          `[migrate] Failed to log migration failure for ${dbName} (${dbType}):`,
          logError
        );
      }
    }
  }

  migrateAudit('migrateDbs finished', {
    queued: dbs.length,
    skippedUpToDate,
    migratedOk,
    migratedFailed,
  });
}
