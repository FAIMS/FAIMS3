/* eslint-disable n/no-process-exit */
/**
 * Validate (and optionally fix) couch-auth-proxy ACL overlays on every project
 * data DB.
 *
 * Normal migrate / Conductor startup already warms the proxy and patches
 * `dbacl` via `initialiseDataDb` → `ensureProjectDataDbAcl`. This script is an
 * ops **validation** tool: run `--check` first to confirm every `data-*` DB is
 * healthy. Use `--write` only when check reports drift (missing `_design/acl`,
 * mismatched `dbacl`) — e.g. after a permission-model token change, or after
 * enabling the proxy when prepare-migrate ran with the proxy off.
 *
 * Modes (exactly one required):
 *   --check   Inspect only. Exit 1 if any DB is missing `_design/acl` (when
 *             the proxy is enabled) or has mismatched `dbacl`.
 *   --write   Warm proxy (when enabled), patch FAIMS `dbacl`, ensure
 *             `_design/faims_acl_shape`.
 *
 * `--dry-run` is accepted as a deprecated alias for `--check`.
 *
 * Usage (from api/):
 *   pnpm run repair-data-db-acl -- --check
 *   pnpm run repair-data-db-acl -- --write
 */
import {
  buildDbAclOverlay,
  DATA_DB_NAME_PREFIX,
  projectIdFromDataDbName,
} from '@faims3/data-model';
import {config} from '../buildconfig';
import {
  getDataDb,
  listCouchDatabaseNames,
  verifyCouchDBConnection,
} from '../couchdb';
import {ensureProjectDataDbAcl} from '../couchdb/couchAuthProxyAcl';
import {getAllProjectsDirectory} from '../couchdb/notebooks';

type Mode = 'check' | 'write';

const printUsage = (): void => {
  console.error(`Usage: pnpm run repair-data-db-acl -- --check | --write

  --check   Validate only (no writes). Exit 1 on missing/mismatched ACL.
  --write   Warm proxy + patch dbacl / faims_acl_shape where needed.

  --dry-run is a deprecated alias for --check.`);
};

const parseMode = (argv: string[]): Mode | null => {
  const wantsCheck = argv.includes('--check') || argv.includes('--dry-run');
  const wantsWrite = argv.includes('--write');
  if (wantsCheck && wantsWrite) {
    console.error('Specify only one of --check or --write.');
    return null;
  }
  if (wantsCheck) {
    if (argv.includes('--dry-run') && !argv.includes('--check')) {
      console.warn(
        'Warning: --dry-run is deprecated; prefer --check (same behaviour).'
      );
    }
    return 'check';
  }
  if (wantsWrite) return 'write';
  return null;
};

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
      'Warning: could not read projects directory; validating from Couch DB name list only.',
      err instanceof Error ? err.message : err
    );
  }

  return [...byName.values()].sort((a, b) => a.dbName.localeCompare(b.dbName));
};

const main = async () => {
  const mode = parseMode(process.argv);
  if (!mode) {
    printUsage();
    process.exit(2);
  }

  await verifyCouchDBConnection();
  const candidates = await discoverDataDatabases();
  const proxyEnabled = config.couchAuthProxyEnabled;

  console.log(
    `Found ${candidates.length} data DB(s) to ${
      mode === 'check' ? 'check' : 'repair'
    } (proxy ${proxyEnabled ? 'enabled' : 'disabled'}).`
  );

  let ok = 0;
  let failed = 0;

  for (const {dbName, projectId, source} of candidates) {
    const expected = buildDbAclOverlay(projectId);
    try {
      if (mode === 'check') {
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
          if (listsMatch) {
            console.log(
              `[check] ${dbName} (${source}): OK _design/acl version=${
                existing.version ?? '?'
              }, dbacl._r=${existing.dbacl?._r?.length ?? 0}`
            );
            ok += 1;
          } else {
            console.error(
              `[check] ${dbName} (${source}): DBACL_MISMATCH _design/acl version=${
                existing.version ?? '?'
              }, dbacl._r=${existing.dbacl?._r?.length ?? 0} (expected ${
                expected._r.length
              }) — re-run with --write to patch`
            );
            failed += 1;
          }
        } catch {
          if (proxyEnabled) {
            console.error(
              `[check] ${dbName} (${source}): MISSING _design/acl ` +
                `(expected dbacl._r=${expected._r.length}) — ` +
                `re-run with --write to warm proxy + patch`
            );
            failed += 1;
          } else {
            console.log(
              `[check] ${dbName} (${source}): MISSING _design/acl ` +
                `(OK while COUCH_AUTH_PROXY_ENABLED=false; ` +
                `expected dbacl._r=${expected._r.length} after enable + --write)`
            );
            ok += 1;
          }
        }
        continue;
      }

      const db = await getDataDb(projectId);
      // requireProxyDdoc defaults from COUCH_AUTH_PROXY_ENABLED
      const result = await ensureProjectDataDbAcl({
        projectId,
        db: db as any,
      });
      console.log(`Wrote ${dbName} (${source}): ${result.status}`);
      ok += 1;
    } catch (err) {
      failed += 1;
      console.error(
        `Failed ${dbName}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  console.log(
    `Done. ok=${ok} failed=${failed}${mode === 'check' ? ' (check only)' : ' (write)'}`
  );
  process.exit(failed > 0 ? 1 : 0);
};

main().catch(err => {
  console.error('repair-data-db-acl failed:', err);
  process.exit(1);
});
