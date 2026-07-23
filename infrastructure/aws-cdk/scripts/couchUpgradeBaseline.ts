/**
 * CouchDB upgrade baseline — version + marker DB stats.
 *
 *   cp scripts/.env.dist scripts/.env   # fill in values
 *   pnpm run couch-upgrade-baseline
 */
import * as fs from 'fs';
import * as path from 'path';

function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Missing ${filePath}. Copy scripts/.env.dist to scripts/.env and fill in values.`
    );
  }
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

async function couchGet(
  url: string,
  auth?: {user: string; password: string}
): Promise<unknown> {
  const headers: Record<string, string> = {Accept: 'application/json'};
  if (auth) {
    headers.Authorization =
      'Basic ' +
      Buffer.from(`${auth.user}:${auth.password}`, 'utf8').toString('base64');
  }
  const res = await fetch(url, {headers});
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} for ${url}`);
  }
  return res.json();
}

async function main(): Promise<void> {
  loadEnvFile(path.resolve(__dirname, '.env'));

  const couchUrl = (process.env.COUCH_URL ?? '').replace(/\/$/, '');
  const user = process.env.COUCHDB_USER || 'admin';
  const password = process.env.COUCHDB_PASSWORD ?? '';
  const markerDbs = (process.env.MARKER_DBS ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  if (!couchUrl) {
    throw new Error('COUCH_URL is required in scripts/.env');
  }
  if (!password) {
    throw new Error('COUCHDB_PASSWORD is required in scripts/.env');
  }

  const auth = {user, password};
  const welcome = (await couchGet(`${couchUrl}/`)) as {
    couchdb?: string;
    version?: string;
  };
  const allDbs = (await couchGet(`${couchUrl}/_all_dbs`, auth)) as string[];

  const markers: Record<
    string,
    {db_name?: string; doc_count?: number; update_seq?: unknown}
  > = {};
  for (const db of markerDbs) {
    const info = (await couchGet(
      `${couchUrl}/${encodeURIComponent(db)}`,
      auth
    )) as {
      db_name?: string;
      doc_count?: number;
      update_seq?: unknown;
    };
    markers[db] = {
      db_name: info.db_name,
      doc_count: info.doc_count,
      update_seq: info.update_seq,
    };
  }

  const configFileName = process.env.CONFIG_FILE_NAME;
  let configSummary: Record<string, unknown> | undefined;
  if (configFileName) {
    const configPath = path.resolve(__dirname, '..', 'configs', configFileName);
    if (fs.existsSync(configPath)) {
      const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8')) as {
        stackName?: string;
        couch?: {couchVersionTag?: string; volumeSize?: number};
        domains?: {couch?: string; baseDomain?: string};
        backup?: unknown;
      };
      configSummary = {
        stackName: cfg.stackName,
        couchVersionTag: cfg.couch?.couchVersionTag,
        volumeSize: cfg.couch?.volumeSize,
        backup: cfg.backup,
        couchHost: cfg.domains
          ? `${cfg.domains.couch}.${cfg.domains.baseDomain}`
          : undefined,
      };
    }
  }

  console.log(
    JSON.stringify(
      {
        recordedAt: new Date().toISOString(),
        couchUrl,
        version: welcome.version,
        welcome,
        dbCount: allDbs.length,
        allDbs,
        markers,
        config: configSummary ?? null,
        ec2: {
          instanceId: process.env.EC2_INSTANCE_ID || null,
          dataDevice: process.env.EC2_DATA_DEVICE || '/dev/xvdf',
        },
      },
      null,
      2
    )
  );
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
