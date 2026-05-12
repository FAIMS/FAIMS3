import {
  GlobalMigrationDefinition,
  GlobalMigrationMatchedHandles,
  GlobalMigrationRunContext,
  LoadedDbHandle,
} from './globalMigrationTypes';
import {DB_TARGET_VERSIONS} from './migrations';
import {DatabaseType} from './types';

/**
 * Determines if a migration document for a given database is up to date with its target version.
 *
 * @param doc - An object representing the migration document, containing the database type and its current version.
 * @returns True if the document's version matches the target version for its database type; otherwise, false.
 */
function isMigrationDocUpToDate(doc: {
  dbType: DatabaseType;
  version: number;
}): boolean {
  return doc.version === DB_TARGET_VERSIONS[doc.dbType].targetVersion;
}

/**
 * Ensures a matched global migration is not applied to only some databases of
 * a participant type when other healthy, not-yet-at-target databases of that
 * type exist in the same batch (non-idempotent / ambiguous runs).
 */
export function assertGlobalMigrationCoversEveryStaleParticipantDbInBatch(
  handles: LoadedDbHandle[],
  definition: GlobalMigrationDefinition,
  matchedByDbType: GlobalMigrationMatchedHandles
): void {
  const handleKey = (h: LoadedDbHandle) => `${h.dbType}:${h.dbName}`;

  for (const p of definition.participants) {
    const matched = [...(matchedByDbType.get(p.dbType) ?? [])];

    const staleHealthy = handles.filter(
      h =>
        h.dbType === p.dbType &&
        h.migrationDoc.status === 'healthy' &&
        !isMigrationDocUpToDate(h.migrationDoc)
    );

    if (p.multiplicity === 'single') {
      if (staleHealthy.length !== 1) {
        throw new Error(
          `Global migration "${definition.id}" participant ${p.dbType} (single) requires exactly one healthy, not-up-to-date database in this batch; found ${staleHealthy.length}. ` +
            `Refusing to run on a subset of databases for this type.`
        );
      }
      if (staleHealthy[0].migrationDoc.version !== p.from) {
        throw new Error(
          `Global migration "${definition.id}" participant ${p.dbType} (single) requires that database at v${p.from}; found v${staleHealthy[0].migrationDoc.version} on ${staleHealthy[0].dbName}.`
        );
      }
      if (
        matched.length !== 1 ||
        handleKey(matched[0]) !== handleKey(staleHealthy[0])
      ) {
        throw new Error(
          `Global migration "${definition.id}" participant ${p.dbType} (single) internal match mismatch; refusing to run.`
        );
      }
      continue;
    }

    // all-of-type
    if (staleHealthy.length < 1) {
      throw new Error(
        `Global migration "${definition.id}" participant ${p.dbType} (all-of-type) expected at least one stale healthy database.`
      );
    }

    for (const h of staleHealthy) {
      if (h.migrationDoc.version !== p.from) {
        throw new Error(
          `Global migration "${definition.id}" participant ${p.dbType} (all-of-type) requires every not-up-to-date healthy database of this type in the batch to be at v${p.from}; ` +
            `${h.dbName} is at v${h.migrationDoc.version}. Refusing to run on a subset.`
        );
      }
    }

    const matchedKeys = new Set(matched.map(handleKey));
    const staleKeys = new Set(staleHealthy.map(handleKey));
    if (matchedKeys.size !== staleKeys.size) {
      throw new Error(
        `Global migration "${definition.id}" participant ${p.dbType} (all-of-type): matched count (${matched.length}) differs from stale healthy count (${staleHealthy.length}).`
      );
    }
    for (const k of staleKeys) {
      if (!matchedKeys.has(k)) {
        throw new Error(
          `Global migration "${definition.id}" participant ${p.dbType} (all-of-type) must include every stale healthy database of this type in the batch. Refusing partial application.`
        );
      }
    }
  }
}

/**
 * Removes duplicate LoadedDbHandles, keeping only the first instance of each unique (dbType, dbName) pair.
 * Relies on the deduplication property of JavaScript Sets by stringifying keys.
 * @param handles - Array of LoadedDbHandle objects (possibly with duplicates).
 * @returns Array of unique LoadedDbHandle objects, preserving first occurrences.
 */
function dedupeHandles(handles: LoadedDbHandle[]): LoadedDbHandle[] {
  const uniqueMap = new Map<string, LoadedDbHandle>();
  for (const h of handles) {
    const key = `${h.dbType}:${h.dbName}`;
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, h);
    }
  }
  return Array.from(uniqueMap.values());
}

/**
 * Builds the {@link GlobalMigrationRunContext} passed into
 * {@link GlobalMigrationDefinition.run} after a global migration has been
 * matched against the current batch.
 *
 * @param definition - The global migration being executed.
 * @param matchedByDbType - Map from each participant `dbType` to the Couch
 *   handle(s) that satisfied that participant row at match time.
 * @param userId - Actor recorded on migration logs.
 * @param migrationDb - Migrations Couch DB (same as `migrateDbs`).
 * @param allBatchHandles - Every `{ dbType, dbName, db, migrationDoc }` from
 *   the current `migrateDbs` call, including DBs not in this global step.
 */
export function createGlobalMigrationRunContext({
  definition,
  matchedByDbType,
  userId,
  migrationDb,
  allBatchHandles,
}: {
  definition: GlobalMigrationDefinition;
  matchedByDbType: GlobalMigrationMatchedHandles;
  userId: string;
  migrationDb: GlobalMigrationRunContext['migrationDb'];
  allBatchHandles: LoadedDbHandle[];
}): GlobalMigrationRunContext {
  const flatMatched = dedupeHandles([...matchedByDbType.values()].flat());

  return {
    userId,
    migrationDb,
    definition,
    matchedByDbType,

    handles(dbType: DatabaseType) {
      return matchedByDbType.get(dbType) ?? [];
    },

    allHandles() {
      return flatMatched;
    },

    allBatchHandles() {
      return allBatchHandles;
    },

    allHandlesForType(dbType: DatabaseType) {
      return allBatchHandles.filter(h => h.dbType === dbType);
    },

    listByType(dbType: DatabaseType) {
      return [...(matchedByDbType.get(dbType) ?? [])];
    },

    firstOfType(dbType: DatabaseType) {
      const list = matchedByDbType.get(dbType);
      return list?.[0];
    },

    getUnique(dbType: DatabaseType) {
      const arr = matchedByDbType.get(dbType) ?? [];
      if (arr.length !== 1) {
        throw new Error(
          `Global migration "${definition.id}" expected exactly one ${dbType} among matched handles, found ${arr.length}.`
        );
      }
      return arr[0];
    },
  };
}

/**
 * Returns the first global migration definition that matches the current batch,
 * or null. Matching is order-dependent: earlier definitions win.
 */
export function findApplicableGlobalMigration(
  handles: LoadedDbHandle[],
  globalDefs: GlobalMigrationDefinition[]
): {
  definition: GlobalMigrationDefinition;
  matchedByDbType: GlobalMigrationMatchedHandles;
} | null {
  for (const definition of globalDefs) {
    const matchedByDbType = new Map<DatabaseType, LoadedDbHandle[]>();
    let ok = true;

    for (const p of definition.participants) {
      const pool = handles.filter(
        h => h.dbType === p.dbType && h.migrationDoc.version === p.from
      );

      if (p.multiplicity === 'single') {
        if (pool.length !== 1) {
          ok = false;
          break;
        }
        matchedByDbType.set(p.dbType, [pool[0]]);
      } else {
        if (pool.length < 1) {
          ok = false;
          break;
        }
        matchedByDbType.set(p.dbType, pool);
      }
    }

    if (ok) {
      assertGlobalMigrationCoversEveryStaleParticipantDbInBatch(
        handles,
        definition,
        matchedByDbType
      );
      return {definition, matchedByDbType};
    }
  }

  return null;
}
