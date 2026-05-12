import {DatabaseInterface} from '../../types';
import {
  MigrationLog,
  MIGRATIONS_BY_DB_TYPE_AND_NAME_INDEX,
  MigrationsDB,
  MigrationsDBDocument,
  MigrationsDBFields,
} from '../migrationsDB';
import {
  createGlobalMigrationRunContext,
  findApplicableGlobalMigration,
} from './globalMigrationResolver';
import {GLOBAL_MIGRATIONS} from './globalMigrations';
import {LoadedDbHandle} from './globalMigrationTypes';
import {DB_MIGRATIONS, DB_TARGET_VERSIONS} from './migrations';
import {
  DATABASE_TYPE,
  DatabaseType,
  IS_TESTING,
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
 * Returns the registered single-step individual migration (from → from+1), if any.
 */
export function findNextIndividualMigration(
  dbType: DatabaseType,
  fromVersion: number
): MigrationDetails | null {
  const next = DB_MIGRATIONS.find(
    m =>
      m.dbType === dbType &&
      m.from === fromVersion &&
      m.to === fromVersion + 1
  );
  return next ?? null;
}

async function getOrCreateMigrationDoc({
  dbType,
  dbName,
  migrationDb,
}: {
  dbType: DATABASE_TYPE;
  dbName: string;
  migrationDb: MigrationsDB;
}): Promise<MigrationsDBDocument> {
  const migrationDocs = await migrationDb.query<MigrationsDBFields>(
    MIGRATIONS_BY_DB_TYPE_AND_NAME_INDEX,
    {
      key: [dbType, dbName],
      include_docs: true,
    }
  );

  if (migrationDocs.rows.length === 0) {
    const defaultMigrationFields = buildDefaultMigrationDoc({
      dbType,
      dbName,
    });
    const response = await migrationDb.post(defaultMigrationFields);
    return await migrationDb.get(response.id);
  }

  return migrationDocs.rows[0].doc!;
}

/**
 * Applies zero or more consecutive individual (per-document) migrations until
 * the next version step is missing or the database reaches its target version.
 *
 * @returns true if the migration document version changed.
 */
async function applyIndividualMigrationChain({
  handle,
  migrationDb,
  userId,
}: {
  handle: LoadedDbHandle;
  migrationDb: MigrationsDB;
  userId: string;
}): Promise<boolean> {
  const {db, dbType, dbName, migrationDoc} = handle;

  if (isDbUpToDate({migrationDoc})) {
    return false;
  }

  const migrationStartTime = Date.now();
  const initialVersion = migrationDoc.version;
  let currentVersion = migrationDoc.version;
  const targetVersion = DB_TARGET_VERSIONS[dbType].targetVersion;

  const migrationLogEntry: MigrationLog = {
    from: initialVersion,
    to: targetVersion,
    startedAtTimestampMs: migrationStartTime,
    completedAtTimestampMs: 0,
    launchedBy: userId,
    status: 'success',
    issues: [],
    notes: `Migrating from v${initialVersion} to v${targetVersion}`,
  };

  let ranAtLeastOneMigrationStep = false;

  while (currentVersion < targetVersion) {
    const migrationDetail = findNextIndividualMigration(dbType, currentVersion);
    if (!migrationDetail) {
      break;
    }

    ranAtLeastOneMigrationStep = true;

    if (!IS_TESTING) {
      console.log(
        `Applying migration for ${dbType} from v${migrationDetail.from} to v${migrationDetail.to}: ${migrationDetail.description}`
      );
    }

    migrationLogEntry.notes += `\n- ${migrationDetail.description}`;

    const result = await performMigration({
      db,
      migrationFunc: migrationDetail.migrationFunction,
    });

    if (!IS_TESTING) {
      console.log(
        `Migration step completed. Processed ${result.processedCount} documents, updated ${result.writtenCount} documents.`
      );
    }

    if (result.issues.length > 0) {
      migrationLogEntry.issues = [
        ...(migrationLogEntry.issues || []),
        ...result.issues,
      ];
      migrationLogEntry.status = 'failure';
      break;
    }

    currentVersion = migrationDetail.to;
  }

  if (!ranAtLeastOneMigrationStep && currentVersion === initialVersion) {
    return false;
  }

  migrationLogEntry.completedAtTimestampMs = Date.now();
  migrationLogEntry.to = currentVersion;
  migrationDoc.version = currentVersion;
  migrationDoc.status =
    migrationLogEntry.status === 'success' ? 'healthy' : 'not-healthy';
  migrationDoc.migrationLog = [...migrationDoc.migrationLog, migrationLogEntry];

  await migrationDb.put(migrationDoc);

  if (migrationLogEntry.status === 'success') {
    if (!IS_TESTING) {
      console.log(
        `Successfully migrated database ${dbName} (${dbType}) from version ${migrationLogEntry.from} to ${migrationLogEntry.to}`
      );
    }
  } else if (!IS_TESTING) {
    console.error(
      `Migration of database ${dbName} (${dbType}) completed with issues. Check migration logs for details.`
    );
  }

  return true;
}

async function recordUnexpectedMigrationFailure({
  dbType,
  dbName,
  migrationDb,
  migrationStartTime,
  userId,
  error,
}: {
  dbType: DatabaseType;
  dbName: string;
  migrationDb: MigrationsDB;
  migrationStartTime: number;
  userId: string;
  error: unknown;
}): Promise<void> {
  try {
    const migrationDocs = await migrationDb.query<MigrationsDBFields>(
      MIGRATIONS_BY_DB_TYPE_AND_NAME_INDEX,
      {
        key: [dbType, dbName],
        include_docs: true,
      }
    );

    if (migrationDocs.rows.length > 0) {
      const migrationDoc = migrationDocs.rows[0].doc!;

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

      migrationDoc.status = 'not-healthy';
      migrationDoc.migrationLog = [...migrationDoc.migrationLog, failureLogEntry];

      await migrationDb.put(migrationDoc);
    }
  } catch (logError) {
    console.error(
      `Failed to log migration failure for ${dbName} (${dbType}):`,
      logError
    );
  }
}

async function runGlobalMigrationStep({
  match,
  allHandles,
  migrationDb,
  userId,
}: {
  match: NonNullable<ReturnType<typeof findApplicableGlobalMigration>>;
  allHandles: LoadedDbHandle[];
  migrationDb: MigrationsDB;
  userId: string;
}): Promise<'success' | 'failure'> {
  const {definition, matchedByDbType} = match;

  const ctx = createGlobalMigrationRunContext({
    definition,
    matchedByDbType,
    userId,
    migrationDb,
    allBatchHandles: allHandles,
  });

  const started = Date.now();

  if (!IS_TESTING) {
    console.log(`Applying global migration: ${definition.id} — ${definition.description}`);
  }

  const result = await definition.run(ctx);

  if (result.status === 'failure') {
    const issues = result.issues;
    for (const h of ctx.allHandles()) {
      const logEntry: MigrationLog = {
        from: h.migrationDoc.version,
        to: h.migrationDoc.version,
        startedAtTimestampMs: started,
        completedAtTimestampMs: Date.now(),
        launchedBy: userId,
        status: 'failure',
        issues,
        notes: `Global migration ${definition.id}`,
        globalMigrationId: definition.id,
      };
      h.migrationDoc.status = 'not-healthy';
      h.migrationDoc.migrationLog = [...h.migrationDoc.migrationLog, logEntry];
      await migrationDb.put(h.migrationDoc);
    }

    if (!IS_TESTING) {
      console.error(`Global migration ${definition.id} failed.`);
    }
    return 'failure';
  }

  for (const p of definition.participants) {
    const toVersion = p.to;
    for (const h of matchedByDbType.get(p.dbType) ?? []) {
      const fromV = h.migrationDoc.version;
      const logEntry: MigrationLog = {
        from: fromV,
        to: toVersion,
        startedAtTimestampMs: started,
        completedAtTimestampMs: Date.now(),
        launchedBy: userId,
        status: 'success',
        issues: [],
        notes: definition.description,
        globalMigrationId: definition.id,
      };
      h.migrationDoc.version = toVersion;
      h.migrationDoc.status = 'healthy';
      h.migrationDoc.migrationLog = [...h.migrationDoc.migrationLog, logEntry];
      await migrationDb.put(h.migrationDoc);
    }
  }

  if (!IS_TESTING) {
    console.log(`Global migration ${definition.id} completed successfully.`);
  }

  return 'success';
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
 * @returns {Object} - An object containing an array of issues encountered during migration.
 */
export async function performMigration({
  db,
  migrationFunc,
}: {
  db: DatabaseInterface;
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
 * 2. Repeatedly applies consecutive individual (per-document) migrations per
 *    database whenever the next single-step migration exists
 * 3. When no database can advance via an individual step but some are still
 *    behind their target version, applies the first matching **global**
 *    migration from {@link GLOBAL_MIGRATIONS} (cross-database, full-connection context)
 * 4. Updates migration logs with results
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
  dbs: {dbType: DatabaseType; dbName: string; db: DatabaseInterface}[];
  migrationDb: MigrationsDB;
  userId?: string;
}): Promise<void> {
  const handles: LoadedDbHandle[] = [];

  for (const {dbType, dbName, db} of dbs) {
    try {
      const migrationDoc = await getOrCreateMigrationDoc({
        dbType,
        dbName,
        migrationDb,
      });
      handles.push({dbType, dbName, db, migrationDoc});

      if (isDbUpToDate({migrationDoc}) && !IS_TESTING) {
        console.log(
          `Database ${dbName} (${dbType}) is already up to date at version ${migrationDoc.version}`
        );
      }
    } catch (error) {
      console.error(
        `Failed to load migration document for ${dbName} (${dbType}):`,
        error
      );
    }
  }

  while (handles.some(h => !isDbUpToDate({migrationDoc: h.migrationDoc}))) {
    let progressed = false;

    for (const handle of handles) {
      if (isDbUpToDate({migrationDoc: handle.migrationDoc})) {
        continue;
      }

      if (handle.migrationDoc.status === 'not-healthy') {
        continue;
      }

      const migrationStartTime = Date.now();

      try {
        const did = await applyIndividualMigrationChain({
          handle,
          migrationDb,
          userId,
        });
        if (did) {
          progressed = true;
        }
      } catch (error) {
        console.error(
          `Failed to migrate database ${handle.dbName} (${handle.dbType}):`,
          error
        );
        await recordUnexpectedMigrationFailure({
          dbType: handle.dbType,
          dbName: handle.dbName,
          migrationDb,
          migrationStartTime,
          userId,
          error,
        });
      }
    }

    if (progressed) {
      continue;
    }

    const globalMatch = findApplicableGlobalMigration(handles, GLOBAL_MIGRATIONS);
    if (globalMatch) {
      const globalOutcome = await runGlobalMigrationStep({
        match: globalMatch,
        allHandles: handles,
        migrationDb,
        userId,
      });
      if (globalOutcome === 'failure') {
        throw new Error(
          `Global migration "${globalMatch.definition.id}" failed. See migration logs on participating databases.`
        );
      }
      continue;
    }

    const stuckHealthy = handles.filter(
      h =>
        !isDbUpToDate({migrationDoc: h.migrationDoc}) &&
        h.migrationDoc.status === 'healthy'
    );
    if (stuckHealthy.length === 0) {
      break;
    }

    const detail = stuckHealthy
      .map(
        h =>
          `${h.dbName} (${h.dbType}) is at v${h.migrationDoc.version} but target is v${DB_TARGET_VERSIONS[h.dbType].targetVersion}; no individual step from v${h.migrationDoc.version} to v${h.migrationDoc.version + 1} and no applicable global migration.`
      )
      .join('\n');
    throw new Error(`Cannot complete database migrations:\n${detail}`);
  }
}
