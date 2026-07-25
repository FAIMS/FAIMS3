/* eslint-disable n/no-process-exit */
/**
 * Idempotent ops tool: warm couch-auth-proxy `_design/acl` on every project
 * data DB, patch FAIMS `dbacl` from the permission model, and ensure
 * `_design/faims_acl_shape`.
 *
 * Use after permission-model token changes, or after cutover when proxy
 * auto-install may not have run yet for idle DBs.
 *
 * Usage (from api/):
 *   pnpm run repair-data-db-acl
 *   pnpm run repair-data-db-acl -- --dry-run
 */
import {
  buildDbAclOverlay,
  DATA_DB_NAME_PREFIX,
  projectIdFromDataDbName,
} from '@faims3/data-model';
import {
  getDataDb,
  listCouchDatabaseNames,
  verifyCouchDBConnection,
} from '../couchdb';
import {ensureProjectDataDbAcl} from '../couchdb/couchAuthProxyAcl';
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
            dbacl?: {_r?: string[]; _w?: string[]; _d?: string[]};
            version?: string;
          };
          const listsMatch =
            JSON.stringify(existing.dbacl?._r ?? []) ===
              JSON.stringify(expected._r) &&
            JSON.stringify(existing.dbacl?._w ?? []) ===
              JSON.stringify(expected._w) &&
            JSON.stringify(existing.dbacl?._d ?? []) ===
              JSON.stringify(expected._d);
          console.log(
            `[dry-run] ${dbName} (${source}): has _design/acl version=${
              existing.version ?? '?'
            }, dbacl._r=${existing.dbacl?._r?.length ?? 0} (expected ${
              expected._r.length
            }), ${listsMatch ? 'DBACL_OK' : 'WOULD_PATCH_DBACL'}`
          );
        } catch {
          console.log(
            `[dry-run] ${dbName} (${source}): MISSING _design/acl (would warm proxy + patch dbacl; expected dbacl._r=${expected._r.length})`
          );
        }
        ok += 1;
        continue;
      }

      const db = await getDataDb(projectId);
      const result = await ensureProjectDataDbAcl({
        projectId,
        db: db as any,
        requireProxyDdoc: true,
      });
      console.log(`Repaired ${dbName} (${source}): ${result.status}`);
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
