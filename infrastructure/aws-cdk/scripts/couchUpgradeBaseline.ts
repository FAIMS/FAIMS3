/**
 * CouchDB upgrade baseline — version + marker DB stats.
 *
 *   cp scripts/.env.dist scripts/.env   # fill in values
 *   pnpm run couch-upgrade-baseline
 *   pnpm run couch-upgrade-baseline -- --instance-id
 *
 * With --instance-id: look up the Couch EC2 instance from STACK_NAME via
 * CloudFormation and write EC2_INSTANCE_ID into scripts/.env.
 */
import {execFileSync} from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const ENV_FILE = path.resolve(__dirname, '.env');

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

function parseArgs(argv: string[]): {
  resolveInstanceId: boolean;
  help: boolean;
} {
  let resolveInstanceId = false;
  let help = false;
  for (const arg of argv) {
    if (arg === '--instance-id') {
      resolveInstanceId = true;
    } else if (arg === '-h' || arg === '--help') {
      help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return {resolveInstanceId, help};
}

function printHelp(): void {
  console.log(`Usage: pnpm run couch-upgrade-baseline [-- --instance-id]

Record CouchDB version, DB list, and optional marker stats as JSON.

Options:
  --instance-id  Look up the Couch EC2 instance from STACK_NAME (CloudFormation)
                 and write EC2_INSTANCE_ID into scripts/.env before baselining.

Requires scripts/.env (from scripts/.env.dist).`);
}

/** Upsert KEY=value in an env file, preserving comments and other keys. */
function upsertEnvVar(filePath: string, key: string, value: string): void {
  const raw = fs.readFileSync(filePath, 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const lines = raw.split(/\r?\n/);
  let found = false;
  const updated = lines.map((line: string) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return line;
    const eq = trimmed.indexOf('=');
    if (eq === -1) return line;
    const k = trimmed.slice(0, eq).trim();
    if (k !== key) return line;
    found = true;
    return `${key}=${value}`;
  });
  if (!found) {
    if (updated.length > 0 && updated[updated.length - 1] !== '') {
      updated.push('');
    }
    updated.push(`${key}=${value}`);
  }
  let out = updated.join(eol);
  if (!out.endsWith(eol)) out += eol;
  fs.writeFileSync(filePath, out);
}

function resolveInstanceIdFromStack(
  stackName: string,
  region?: string
): string {
  const args = [
    'cloudformation',
    'describe-stack-resources',
    '--stack-name',
    stackName,
    '--query',
    "StackResources[?ResourceType=='AWS::EC2::Instance' && contains(LogicalResourceId, 'CouchDBInstance')].PhysicalResourceId | [0]",
    '--output',
    'text',
  ];
  if (region) {
    args.push('--region', region);
  }

  let out: string;
  try {
    out = execFileSync('aws', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (err) {
    const stderr =
      err && typeof err === 'object' && 'stderr' in err
        ? String((err as {stderr?: Buffer | string}).stderr ?? '')
        : '';
    throw new Error(
      `Failed to look up EC2 instance for stack ${stackName}.${
        stderr ? `\n${stderr.trim()}` : ''
      }`
    );
  }

  if (!out || out === 'None') {
    throw new Error(
      `No CouchDB EC2 instance found in stack ${stackName} ` +
        `(looked for AWS::EC2::Instance with LogicalResourceId containing CouchDBInstance).`
    );
  }
  return out;
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
  const {resolveInstanceId, help} = parseArgs(process.argv.slice(2));
  if (help) {
    printHelp();
    return;
  }

  loadEnvFile(ENV_FILE);

  if (resolveInstanceId) {
    const stackName = process.env.STACK_NAME?.trim() ?? '';
    if (!stackName) {
      throw new Error(
        'STACK_NAME is required in scripts/.env when using --instance-id'
      );
    }
    const region =
      process.env.AWS_REGION?.trim() ||
      process.env.AWS_DEFAULT_REGION?.trim() ||
      undefined;
    const instanceId = resolveInstanceIdFromStack(stackName, region);
    upsertEnvVar(ENV_FILE, 'EC2_INSTANCE_ID', instanceId);
    process.env.EC2_INSTANCE_ID = instanceId;
    console.error(
      `Updated ${path.relative(process.cwd(), ENV_FILE)}: EC2_INSTANCE_ID=${instanceId} (stack ${stackName})`
    );
  }

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
          stackName: process.env.STACK_NAME || null,
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
