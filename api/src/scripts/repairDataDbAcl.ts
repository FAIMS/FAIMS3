/* eslint-disable n/no-process-exit */
/**
 * Idempotent ops tool: ensure every project data DB has a correct
 * `_design/acl` (map/VDU + `dbacl` from the permission model).
 *
 * Use after permission-model token changes, or to repair DBs before pointing
 * COUCHDB_PUBLIC_URL at couch-auth-proxy.
 *
 * Usage (from api/):
 *   pnpm run repair-data-db-acl
 *   pnpm run repair-data-db-acl -- --dry-run
 */
import {
  buildDbAclOverlay,
  DATA_DB_NAME_PREFIX,
  ensureDataDbAclDesignDoc,
  projectIdFromDataDbName,
} from '@faims3/data-model';
import {
  getDataDb,
  listCouchDatabaseNames,
  verifyCouchDBConnection,
} from '../couchdb';
import {getAllProjectsDirectory} from '../couchdb/notebooks';

const isDryRun = process.argv.includes('--dry-run');

type RepairCandidate = {
  dbName: string;
  projectId: string;
  source: 'projects' | 'couch-list';
};

const discoverDataDatabases = async (): Promise<RepairCandidate[]> => {
  const byName = new Map<string, RepairCandidate>();

  for (const dbName of await listCouchDatabaseNames()) {
    const projectId = projectIdFromDataDbName(dbName);
    if (!projectId) continue;
    byName.set(dbName, {dbName, projectId, source: 'couch-list'});
  }

  try {
    const projects = await getAllProjectsDirectory();
    for (const project of projects) {
      const projectId = project._id;
      if (!projectId) continue;
      const dbName = `${DATA_DB_NAME_PREFIX}${projectId}`;
      if (!byName.has(dbName)) {
        byName.set(dbName, {dbName, projectId, source: 'projects'});
      } else {
        byName.set(dbName, {
          ...byName.get(dbName)!,
          source: 'projects',
        });
      }
    }
  } catch (err) {
    console.warn(
      'Warning: could not read projects directory; repairing from Couch DB name list only.',
      err instanceof Error ? err.message : err
    );
  }

  return [...byName.values()].sort((a, b) => a.dbName.localeCompare(b.dbName));
};

const main = async () => {
  await verifyCouchDBConnection();
  const candidates = await discoverDataDatabases();

  console.log(
    `Found ${candidates.length} data DB(s) to ${isDryRun ? 'inspect' : 'repair'}.`
  );

  let ok = 0;
  let failed = 0;

  for (const {dbName, projectId, source} of candidates) {
    const expected = buildDbAclOverlay(projectId);
    try {
      if (isDryRun) {
        const db = await getDataDb(projectId);
        try {
          const existing = (await db.get('_design/acl')) as {
            dbacl?: {_r?: string[]};
            version?: string;
          };
          const rCount = existing.dbacl?._r?.length ?? 0;
          console.log(
            `[dry-run] ${dbName} (${source}): has _design/acl version=${
              existing.version ?? '?'
            }, dbacl._r=${rCount} (expected ${expected._r.length})`
          );
        } catch {
          console.log(
            `[dry-run] ${dbName} (${source}): MISSING _design/acl (would install; expected dbacl._r=${expected._r.length})`
          );
        }
        ok += 1;
        continue;
      }

      const db = await getDataDb(projectId);
      await ensureDataDbAclDesignDoc({db: db as any, projectId});
      console.log(`Repaired ${dbName} (${source})`);
      ok += 1;
    } catch (err) {
      failed += 1;
      console.error(
        `Failed ${dbName}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  console.log(`Done. ok=${ok} failed=${failed}${isDryRun ? ' (dry-run)' : ''}`);
  process.exit(failed > 0 ? 1 : 0);
};

main().catch(err => {
  console.error('repair-data-db-acl failed:', err);
  process.exit(1);
});
