// SPDX-License-Identifier: Apache-2.0
/* eslint-disable n/no-process-exit */
/**
 * Local debugger for the clustered startup-migration lock and per-DB
 * version documents in the Couch `migrations` database.
 *
 * Read-only by default (`status`). Write commands change lock / version
 * *records only* — they never run migration functions or rewrite survey
 * data. Use them to unstick a crashed doer, re-queue a step, or inspect
 * why a replica is waiting.
 *
 * Usage (from api/, with .env pointing at the target Couch):
 *   pnpm debug-migration-lock
 *   pnpm debug-migration-lock status --json
 *   pnpm debug-migration-lock unlock --yes
 *   pnpm debug-migration-lock set-version people 4 --yes --reason='re-run v4→v5'
 *
 * Environment: same as other API scripts (`COUCHDB_INTERNAL_URL`,
 * `COUCHDB_USER` / `COUCHDB_PASSWORD`, lock timeout). Does not start
 * the API. Safe to run while the API is up; unlock/claim while a doer
 * is still migrating can race that process.
 */
import {hostname} from 'node:os';
import * as readline from 'node:readline';
import {
  assessNotebookSchemaCompatibility,
  CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
  DATABASE_TYPES,
  DatabaseType,
  DB_MIGRATIONS,
  DB_TARGET_VERSIONS,
  type DATABASE_TYPE,
  type MigrationLog,
  type MigrationsDBDocument,
  type MigrationsDBFields,
} from '@faims3/data-model';
import {config} from '../src/buildconfig';
import {getMigrationDb, verifyCouchDBConnection} from '../src/couchdb';
import {getAllProjectsListing} from '../src/couchdb/notebooks';
import {
  STARTUP_MIGRATION_LOCK_ID,
  type StartupMigrationLockAttempt,
  type StartupMigrationLockDoc,
} from '../src/couchdb/startupMigrationLock';
import {getTemplates} from '../src/couchdb/templates';

/** Prefix for human stderr / stdout lines from this CLI. */
export const DEBUG_MIGRATION_LOCK_LOG = '[debug-migration-lock]';

/** Same cap as the lock module (`MAX_LOCK_HISTORY`); drop oldest. */
const MAX_LOCK_HISTORY = 10;

/** `launchedBy` / lock `holderId` prefix so history is obviously admin. */
export const ADMIN_ACTOR_PREFIX = 'debug-migration-lock';

/** Global DBs `initialiseAndMigrateDBs` walks; a missing version doc is a gap. */
export const EXPECTED_GLOBAL_DBS: ReadonlyArray<{
  dbType: DATABASE_TYPE;
  dbName: string;
}> = [
  {dbType: DatabaseType.AUTH, dbName: 'auth'},
  {dbType: DatabaseType.DIRECTORY, dbName: 'directory'},
  {dbType: DatabaseType.INVITES, dbName: 'invites'},
  {dbType: DatabaseType.PEOPLE, dbName: 'people'},
  {dbType: DatabaseType.PROJECTS, dbName: 'projects'},
  {dbType: DatabaseType.TEMPLATES, dbName: 'templates'},
  {dbType: DatabaseType.TEAMS, dbName: 'teams'},
  {dbType: DatabaseType.TOMBSTONE, dbName: 'tombstone'},
];

const BOOLEAN_FLAGS = new Set([
  'json',
  'yes',
  'force',
  'create',
  'behind',
  'ahead',
  'unhealthy',
  'strict',
  'help',
]);

const COMMANDS = [
  'status',
  'lock',
  'unlock',
  'delete-lock',
  'claim',
  'dbs',
  'show',
  'set-version',
  'set-health',
  'unregister',
  'targets',
  'notebooks',
  'watch',
  'help',
] as const;

export type DebuggerCommandName = (typeof COMMANDS)[number];

export type DebuggerCommand =
  | {name: 'help'}
  | {name: 'status'; json: boolean; strict: boolean}
  | {name: 'lock'; json: boolean}
  | {
      name: 'unlock';
      status: 'complete' | 'failed';
      reason?: string;
      force: boolean;
      yes: boolean;
    }
  | {name: 'delete-lock'; yes: boolean}
  | {name: 'claim'; yes: boolean; force: boolean}
  | {
      name: 'dbs';
      json: boolean;
      type?: DATABASE_TYPE;
      behind: boolean;
      ahead: boolean;
      unhealthy: boolean;
    }
  | {name: 'show'; db: string; type?: DATABASE_TYPE; json: boolean}
  | {
      name: 'set-version';
      db: string;
      version: number;
      type?: DATABASE_TYPE;
      create: boolean;
      reason?: string;
      yes: boolean;
    }
  | {
      name: 'set-health';
      db: string;
      health: 'healthy' | 'not-healthy';
      type?: DATABASE_TYPE;
      yes: boolean;
    }
  | {name: 'unregister'; db: string; type?: DATABASE_TYPE; yes: boolean}
  | {name: 'targets'; json: boolean}
  | {name: 'notebooks'; json: boolean}
  | {name: 'watch'; intervalMs: number; timeoutMs: number};

/** Persistence used by lock / version mutations. Production passes Couch. */
export type DebuggerDb = {
  get: (id: string) => Promise<unknown>;
  put: (doc: unknown) => Promise<unknown>;
  post: (doc: unknown) => Promise<{id: string}>;
  remove: (doc: {_id: string; _rev: string}) => Promise<unknown>;
  allDocs: (opts: {include_docs: boolean}) => Promise<{
    rows: Array<{id: string; doc?: unknown}>;
  }>;
};

export type VersionRelation = 'current' | 'behind' | 'ahead' | 'unknown-type';

export type PendingStep = {
  from: number;
  to: number;
  description: string;
};

export type VersionGap = {from: number; to: number};

export type DbVersionInfo = {
  relation: VersionRelation;
  target?: number;
  defaultVersion?: number;
  pending: PendingStep[];
  gaps: VersionGap[];
};

export type LockView = {
  present: boolean;
  doc?: StartupMigrationLockDoc;
  ageMs?: number;
  remainingMs?: number;
  expired?: boolean;
  stealable?: boolean;
  interpretation: string;
};

export type DbRow = {
  id: string;
  dbType: string;
  dbName: string;
  version: number;
  health: 'healthy' | 'not-healthy';
  target?: number;
  defaultVersion?: number;
  relation: VersionRelation;
  pending: PendingStep[];
  gaps: VersionGap[];
  lastMigration?: Pick<
    MigrationLog,
    'from' | 'to' | 'status' | 'completedAtTimestampMs' | 'notes'
  >;
};

export type UnrecognisedDoc = {id: string; hint: string};

export type StatusSnapshot = {
  couchUrl: string;
  lockEnabled: boolean;
  timeoutMs: number;
  nowMs: number;
  lock: LockView;
  databases: DbRow[];
  missingExpected: Array<{dbType: string; dbName: string}>;
  unrecognised: UnrecognisedDoc[];
};

export type StatusSummary = {
  total: number;
  current: number;
  behind: number;
  ahead: number;
  unknown: number;
  unhealthy: number;
};

export type NotebookRow = {
  kind: 'project' | 'template';
  id: string;
  name: string;
  schemaVersion?: string;
  relation: string;
  requiresMigration: boolean;
  reason: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function pouchStatus(error: unknown): number | undefined {
  return isRecord(error) && typeof error.status === 'number'
    ? error.status
    : undefined;
}

function pouchName(error: unknown): string | undefined {
  return isRecord(error) && typeof error.name === 'string'
    ? error.name
    : undefined;
}

export function isNotFound(error: unknown): boolean {
  return pouchStatus(error) === 404 || pouchName(error) === 'not_found';
}

export function isConflict(error: unknown): boolean {
  return pouchStatus(error) === 409 || pouchName(error) === 'conflict';
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export function createAdminInstanceId(): string {
  return `${ADMIN_ACTOR_PREFIX}:${hostname()}:${process.pid}`;
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms)) {
    return 'n/a';
  }
  const sign = ms < 0 ? '-' : '';
  let abs = Math.abs(Math.round(ms));
  const hours = Math.floor(abs / 3_600_000);
  abs %= 3_600_000;
  const minutes = Math.floor(abs / 60_000);
  abs %= 60_000;
  const seconds = Math.floor(abs / 1_000);
  const parts: string[] = [];
  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0) {
    parts.push(`${minutes}m`);
  }
  if (seconds > 0 || parts.length === 0) {
    parts.push(`${seconds}s`);
  }
  return sign + parts.join(' ');
}

export function formatTimestamp(ms: number | undefined): string {
  if (ms === undefined || !Number.isFinite(ms)) {
    return 'n/a';
  }
  return new Date(ms).toISOString();
}

function isDatabaseType(value: string): value is DATABASE_TYPE {
  return (DATABASE_TYPES as readonly string[]).includes(value);
}

export function parseDatabaseType(raw: string): DATABASE_TYPE {
  const upper = raw.trim().toUpperCase();
  if (!isDatabaseType(upper)) {
    throw new Error(
      `Unknown database type '${raw}'. Use one of: ${DATABASE_TYPES.join(', ')}.`
    );
  }
  return upper;
}

function flagString(
  flags: Map<string, string | boolean>,
  key: string
): string | undefined {
  const value = flags.get(key);
  return typeof value === 'string' ? value : undefined;
}

function flagBool(flags: Map<string, string | boolean>, key: string): boolean {
  return flags.get(key) === true;
}

function parseNonNegativeInt(raw: string, label: string): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer, got '${raw}'.`);
  }
  return value;
}

function parseUnlockStatus(raw: string | undefined): 'complete' | 'failed' {
  if (raw === undefined || raw === 'complete') {
    return 'complete';
  }
  if (raw === 'failed') {
    return 'failed';
  }
  throw new Error(`--status must be complete or failed, got '${raw}'.`);
}

function parseHealth(raw: string): 'healthy' | 'not-healthy' {
  if (raw === 'healthy' || raw === 'not-healthy') {
    return raw;
  }
  throw new Error(`Health must be healthy or not-healthy, got '${raw}'.`);
}

/**
 * Parse CLI argv (no node/tsx prefix). Default command is `status`.
 */
export function parseArgs(argv: string[]): DebuggerCommand {
  const flags = new Map<string, string | boolean>();
  const positionals: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--') {
      continue;
    }
    if (arg === '-h' || arg === '--help') {
      flags.set('help', true);
      continue;
    }
    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=');
      if (eq !== -1) {
        const key = arg.slice(2, eq);
        flags.set(key, arg.slice(eq + 1));
        continue;
      }
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (
        BOOLEAN_FLAGS.has(key) ||
        next === undefined ||
        next.startsWith('-')
      ) {
        flags.set(key, true);
      } else {
        flags.set(key, next);
        i += 1;
      }
      continue;
    }
    if (arg.startsWith('-')) {
      throw new Error(`Unknown argument: ${arg}`);
    }
    positionals.push(arg);
  }

  if (flagBool(flags, 'help')) {
    return {name: 'help'};
  }

  const commandName = positionals[0] ?? 'status';
  const rest = positionals.slice(1);
  if (!COMMANDS.includes(commandName as DebuggerCommandName)) {
    throw new Error(
      `Unknown command '${commandName}'. Use status, lock, unlock, delete-lock, claim, dbs, show, set-version, set-health, unregister, targets, notebooks, or watch.`
    );
  }
  const command = commandName as DebuggerCommandName;

  const typeRaw = flagString(flags, 'type');
  const type = typeRaw ? parseDatabaseType(typeRaw) : undefined;
  const json = flagBool(flags, 'json');
  const yes = flagBool(flags, 'yes');
  const force = flagBool(flags, 'force');

  switch (command) {
    case 'help':
      return {name: 'help'};
    case 'status':
      return {name: 'status', json, strict: flagBool(flags, 'strict')};
    case 'lock':
      return {name: 'lock', json};
    case 'unlock':
      return {
        name: 'unlock',
        status: parseUnlockStatus(flagString(flags, 'status')),
        reason: flagString(flags, 'reason'),
        force,
        yes,
      };
    case 'delete-lock':
      return {name: 'delete-lock', yes};
    case 'claim':
      return {name: 'claim', yes, force};
    case 'dbs':
      return {
        name: 'dbs',
        json,
        type,
        behind: flagBool(flags, 'behind'),
        ahead: flagBool(flags, 'ahead'),
        unhealthy: flagBool(flags, 'unhealthy'),
      };
    case 'show': {
      if (rest[0] === undefined) {
        throw new Error('show requires a database name (or document id).');
      }
      return {name: 'show', db: rest[0], type, json};
    }
    case 'set-version': {
      if (rest[0] === undefined || rest[1] === undefined) {
        throw new Error('set-version requires <db> <version>.');
      }
      return {
        name: 'set-version',
        db: rest[0],
        version: parseNonNegativeInt(rest[1], 'version'),
        type,
        create: flagBool(flags, 'create'),
        reason: flagString(flags, 'reason'),
        yes,
      };
    }
    case 'set-health': {
      if (rest[0] === undefined || rest[1] === undefined) {
        throw new Error('set-health requires <db> healthy|not-healthy.');
      }
      return {
        name: 'set-health',
        db: rest[0],
        health: parseHealth(rest[1]),
        type,
        yes,
      };
    }
    case 'unregister': {
      if (rest[0] === undefined) {
        throw new Error('unregister requires a database name.');
      }
      return {name: 'unregister', db: rest[0], type, yes};
    }
    case 'targets':
      return {name: 'targets', json};
    case 'notebooks':
      return {name: 'notebooks', json};
    case 'watch':
      return {
        name: 'watch',
        intervalMs: parseNonNegativeInt(
          flagString(flags, 'interval-ms') ?? '2000',
          '--interval-ms'
        ),
        timeoutMs: parseNonNegativeInt(
          flagString(flags, 'timeout-ms') ?? '0',
          '--timeout-ms'
        ),
      };
  }
}

export function usageText(): string {
  return `Usage: pnpm debug-migration-lock [command] [options]

Inspect and surgically edit the startup-migration lock and per-DB version
documents in the Couch migrations database. Write commands change records
only — they do not migrate documents.

Commands:
  status                 Lock + every DB version (default)
  lock                   Lock document and attempt history
  unlock                 Force-settle a running lock (default: complete)
  delete-lock            Remove the lock document entirely
  claim                  Write a running lock held by this CLI
  dbs                    List per-DB version documents
  show <db>              One version document, log, and pending steps
  set-version <db> <n>   Force the recorded schema version (no data rewrite)
  set-health <db> <h>    Set healthy | not-healthy
  unregister <db>        Delete the version document (next migrate rediscovers)
  targets                Expected versions and registered migration steps
  notebooks              Project/template uiSpec versions vs this build
  watch                  Poll the lock until it is missing or settled

Common options:
  --json                 Machine-readable stdout (status/lock/dbs/show/targets/notebooks)
  --yes                  Skip the confirmation prompt on write commands
  --type=PEOPLE          Restrict db matching to one DatabaseType
  --reason='…'           Audit note stored on unlock / set-version
  --force                unlock: rewrite an already-settled lock
                         claim: steal a still-live running lock
  --strict               status: exit 1 if lock is running or any DB is not current
  --behind / --ahead / --unhealthy
                         Filter dbs listing
  --create               set-version: create a missing version document
  --interval-ms=2000     watch poll interval
  --timeout-ms=0         watch deadline (0 = until settled)
  -h, --help             Show this help

Examples:
  pnpm debug-migration-lock
  pnpm debug-migration-lock status --json --strict
  pnpm debug-migration-lock unlock --status=failed --reason='crashed doer' --yes
  pnpm debug-migration-lock set-version people 4 --yes --reason='re-run people v4→v5'
  pnpm debug-migration-lock set-version teams 1 --create --type=TEAMS --yes
`;
}

export function isMigrationDoc(doc: unknown): doc is MigrationsDBDocument {
  if (!isRecord(doc)) {
    return false;
  }
  return (
    typeof doc.dbType === 'string' &&
    typeof doc.dbName === 'string' &&
    typeof doc.version === 'number' &&
    (doc.status === 'healthy' || doc.status === 'not-healthy') &&
    Array.isArray(doc.migrationLog)
  );
}

export function isLockDoc(doc: unknown): doc is StartupMigrationLockDoc {
  return isRecord(doc) && doc._id === STARTUP_MIGRATION_LOCK_ID;
}

export function describeDbVersion(input: {
  dbType: string;
  version: number;
}): DbVersionInfo {
  if (!isDatabaseType(input.dbType)) {
    return {
      relation: 'unknown-type',
      pending: [],
      gaps: [],
    };
  }
  const {targetVersion, defaultVersion} = DB_TARGET_VERSIONS[input.dbType];
  if (input.version === targetVersion) {
    return {
      relation: 'current',
      target: targetVersion,
      defaultVersion,
      pending: [],
      gaps: [],
    };
  }
  if (input.version > targetVersion) {
    return {
      relation: 'ahead',
      target: targetVersion,
      defaultVersion,
      pending: [],
      gaps: [],
    };
  }

  const pending: PendingStep[] = [];
  const gaps: VersionGap[] = [];
  let version = input.version;
  while (version < targetVersion) {
    const step = DB_MIGRATIONS.find(
      migration =>
        migration.dbType === input.dbType &&
        migration.from === version &&
        migration.to === version + 1
    );
    if (step) {
      pending.push({
        from: step.from,
        to: step.to,
        description: step.description,
      });
    } else {
      gaps.push({from: version, to: version + 1});
    }
    version += 1;
  }
  return {
    relation: 'behind',
    target: targetVersion,
    defaultVersion,
    pending,
    gaps,
  };
}

export function classifyLock(
  doc: StartupMigrationLockDoc | null,
  nowMs: number,
  timeoutMs: number
): LockView {
  if (!doc) {
    return {
      present: false,
      interpretation:
        'No lock document. A boot with STARTUP_MIGRATION_LOCK_ENABLED will create and claim one.',
    };
  }
  if (doc.status === 'complete') {
    return {
      present: true,
      doc,
      interpretation: `Last attempt ${doc.attempt} completed (holder ${doc.holderId}). A later boot will re-claim and run again.`,
    };
  }
  if (doc.status === 'failed') {
    return {
      present: true,
      doc,
      interpretation: `Last attempt ${doc.attempt} failed (holder ${doc.holderId})${
        doc.error ? `: ${doc.error}` : '.'
      } Waiters treat this as settled; a later boot will re-claim.`,
    };
  }
  const ageMs = nowMs - doc.startedAtMs;
  const remainingMs = timeoutMs - ageMs;
  const expired = ageMs >= timeoutMs;
  return {
    present: true,
    doc,
    ageMs,
    remainingMs,
    expired,
    stealable: expired,
    interpretation: expired
      ? `Running lock is older than the steal timeout (age ${formatDuration(ageMs)}, timeout ${formatDuration(timeoutMs)}). The next boot can steal from ${doc.holderId}.`
      : `Live running lock held by ${doc.holderId} (age ${formatDuration(ageMs)}, steal in ${formatDuration(remainingMs)}). Waiters will poll; unlock if the holder is dead.`,
  };
}

function lastMigration(
  log: MigrationLog[] | undefined
): DbRow['lastMigration'] {
  if (!log || log.length === 0) {
    return undefined;
  }
  const last = log[log.length - 1];
  return {
    from: last.from,
    to: last.to,
    status: last.status,
    completedAtTimestampMs: last.completedAtTimestampMs,
    notes: last.notes,
  };
}

export function toDbRow(doc: MigrationsDBDocument): DbRow {
  const info = describeDbVersion({
    dbType: doc.dbType,
    version: doc.version,
  });
  return {
    id: doc._id,
    dbType: doc.dbType,
    dbName: doc.dbName,
    version: doc.version,
    health: doc.status,
    target: info.target,
    defaultVersion: info.defaultVersion,
    relation: info.relation,
    pending: info.pending,
    gaps: info.gaps,
    lastMigration: lastMigration(doc.migrationLog),
  };
}

export function summarizeDatabases(rows: DbRow[]): StatusSummary {
  return {
    total: rows.length,
    current: rows.filter(row => row.relation === 'current').length,
    behind: rows.filter(row => row.relation === 'behind').length,
    ahead: rows.filter(row => row.relation === 'ahead').length,
    unknown: rows.filter(row => row.relation === 'unknown-type').length,
    unhealthy: rows.filter(row => row.health === 'not-healthy').length,
  };
}

function unrecognisedHint(doc: unknown): string {
  if (!isRecord(doc)) {
    return 'non-object';
  }
  if (typeof doc.kind === 'string') {
    return `kind=${doc.kind}`;
  }
  const keys = Object.keys(doc)
    .filter(key => !key.startsWith('_'))
    .slice(0, 6);
  return keys.length > 0 ? `keys=${keys.join(',')}` : 'no fields';
}

export async function readLock(
  db: DebuggerDb
): Promise<StartupMigrationLockDoc | null> {
  try {
    const doc = await db.get(STARTUP_MIGRATION_LOCK_ID);
    return isLockDoc(doc) ? doc : null;
  } catch (error) {
    if (isNotFound(error)) {
      return null;
    }
    throw error;
  }
}

export async function loadMigrationsDb(db: DebuggerDb): Promise<{
  lock: StartupMigrationLockDoc | null;
  databases: MigrationsDBDocument[];
  unrecognised: UnrecognisedDoc[];
}> {
  const result = await db.allDocs({include_docs: true});
  let lock: StartupMigrationLockDoc | null = null;
  const databases: MigrationsDBDocument[] = [];
  const unrecognised: UnrecognisedDoc[] = [];

  for (const row of result.rows) {
    if (row.id.startsWith('_design/')) {
      continue;
    }
    if (row.id === STARTUP_MIGRATION_LOCK_ID) {
      if (isLockDoc(row.doc)) {
        lock = row.doc;
      } else {
        unrecognised.push({
          id: row.id,
          hint: 'lock id present but document shape is invalid',
        });
      }
      continue;
    }
    if (isMigrationDoc(row.doc)) {
      databases.push(row.doc);
      continue;
    }
    unrecognised.push({id: row.id, hint: unrecognisedHint(row.doc)});
  }

  databases.sort((a, b) => {
    const typeCmp = a.dbType.localeCompare(b.dbType);
    return typeCmp !== 0 ? typeCmp : a.dbName.localeCompare(b.dbName);
  });

  return {lock, databases, unrecognised};
}

export function missingExpectedGlobals(
  docs: MigrationsDBDocument[]
): Array<{dbType: string; dbName: string}> {
  return EXPECTED_GLOBAL_DBS.filter(
    expected =>
      !docs.some(
        doc => doc.dbType === expected.dbType && doc.dbName === expected.dbName
      )
  );
}

export function collectStatus(options: {
  couchUrl: string;
  lockEnabled: boolean;
  timeoutMs: number;
  nowMs: number;
  lock: StartupMigrationLockDoc | null;
  databases: MigrationsDBDocument[];
  unrecognised: UnrecognisedDoc[];
}): StatusSnapshot {
  return {
    couchUrl: options.couchUrl,
    lockEnabled: options.lockEnabled,
    timeoutMs: options.timeoutMs,
    nowMs: options.nowMs,
    lock: classifyLock(options.lock, options.nowMs, options.timeoutMs),
    databases: options.databases.map(toDbRow),
    missingExpected: missingExpectedGlobals(options.databases),
    unrecognised: options.unrecognised,
  };
}

export function matchMigrationDocs(
  docs: MigrationsDBDocument[],
  selector: {db?: string; type?: DATABASE_TYPE}
): MigrationsDBDocument[] {
  let matches = docs;
  if (selector.type) {
    matches = matches.filter(doc => doc.dbType === selector.type);
  }
  if (!selector.db) {
    return matches;
  }
  const raw = selector.db;
  const exactId = matches.filter(doc => doc._id === raw);
  if (exactId.length > 0) {
    return exactId;
  }
  const exactName = matches.filter(doc => doc.dbName === raw);
  if (exactName.length > 0) {
    return exactName;
  }
  const lowered = raw.toLowerCase();
  return matches.filter(doc => doc.dbName.toLowerCase() === lowered);
}

export function resolveMigrationDoc(
  docs: MigrationsDBDocument[],
  selector: {db: string; type?: DATABASE_TYPE}
): MigrationsDBDocument {
  const matches = matchMigrationDocs(docs, selector);
  if (matches.length === 1) {
    return matches[0];
  }
  if (matches.length === 0) {
    throw new Error(
      `No migration document matches '${selector.db}'` +
        (selector.type ? ` (type ${selector.type})` : '') +
        '. Use `dbs` to list names.'
    );
  }
  const listed = matches
    .map(doc => `${doc.dbType}:${doc.dbName} (${doc._id})`)
    .join(', ');
  throw new Error(
    `Ambiguous database '${selector.db}'. Matches: ${listed}. Pass --type.`
  );
}

function adminLogEntry(fields: {
  from: number;
  to: number;
  notes: string;
  nowMs: number;
}): MigrationLog {
  return {
    from: fields.from,
    to: fields.to,
    notes: fields.notes,
    startedAtTimestampMs: fields.nowMs,
    completedAtTimestampMs: fields.nowMs,
    launchedBy: ADMIN_ACTOR_PREFIX,
    status: 'success',
  };
}

async function putLock(
  db: DebuggerDb,
  doc: StartupMigrationLockDoc
): Promise<void> {
  try {
    await db.put(doc);
  } catch (error) {
    if (isConflict(error)) {
      throw new Error(
        'Conflict writing the lock document (another process updated it). Re-run status and retry.'
      );
    }
    throw error;
  }
}

export async function forceUnlock(options: {
  db: DebuggerDb;
  nowMs: number;
  status: 'complete' | 'failed';
  reason?: string;
  force?: boolean;
}): Promise<{
  changed: boolean;
  before: StartupMigrationLockDoc | null;
  after: StartupMigrationLockDoc | null;
}> {
  const before = await readLock(options.db);
  if (!before) {
    throw new Error('No lock document to unlock.');
  }
  if (before.status !== 'running' && !options.force) {
    return {changed: false, before, after: before};
  }

  const reason =
    options.reason ??
    (before.status === 'running'
      ? 'admin unlock'
      : 'admin unlock --force rewrite');
  const history: StartupMigrationLockAttempt[] = [
    ...before.history,
    {
      holderId: before.holderId,
      startedAtMs: before.startedAtMs,
      finishedAtMs: options.nowMs,
      status: options.status,
      error: reason,
    },
  ].slice(-MAX_LOCK_HISTORY);

  const after: StartupMigrationLockDoc = {
    ...before,
    status: options.status,
    updatedAtMs: options.nowMs,
    error: options.status === 'failed' ? reason : undefined,
    history,
  };
  await putLock(options.db, after);
  return {changed: true, before, after};
}

export async function deleteLock(options: {db: DebuggerDb}): Promise<{
  removed: boolean;
  before: StartupMigrationLockDoc | null;
}> {
  const before = await readLock(options.db);
  if (!before || !before._rev) {
    return {removed: false, before};
  }
  await options.db.remove({_id: before._id, _rev: before._rev});
  return {removed: true, before};
}

export async function forceClaim(options: {
  db: DebuggerDb;
  nowMs: number;
  instanceId: string;
  timeoutMs: number;
  force?: boolean;
}): Promise<{
  changed: boolean;
  stolen: boolean;
  before: StartupMigrationLockDoc | null;
  after: StartupMigrationLockDoc;
}> {
  const before = await readLock(options.db);
  if (
    before &&
    before.status === 'running' &&
    options.nowMs - before.startedAtMs < options.timeoutMs &&
    !options.force
  ) {
    throw new Error(
      `Lock is still live (holder ${before.holderId}, age ${formatDuration(options.nowMs - before.startedAtMs)}). Pass --force to steal.`
    );
  }

  const stolen = before?.status === 'running';
  const history = before
    ? stolen
      ? [
          ...before.history,
          {
            holderId: before.holderId,
            startedAtMs: before.startedAtMs,
            finishedAtMs: options.nowMs,
            status: 'timed_out' as const,
            error: 'admin claim',
          },
        ].slice(-MAX_LOCK_HISTORY)
      : before.history
    : [];

  const after: StartupMigrationLockDoc = {
    _id: STARTUP_MIGRATION_LOCK_ID,
    _rev: before?._rev,
    kind: 'startup-migration-lock',
    status: 'running',
    holderId: options.instanceId,
    startedAtMs: options.nowMs,
    updatedAtMs: options.nowMs,
    attempt: (before?.attempt ?? 0) + 1,
    history,
  };
  await putLock(options.db, after);
  return {changed: true, stolen: Boolean(stolen), before, after};
}

export async function setDbVersion(options: {
  db: DebuggerDb;
  docs: MigrationsDBDocument[];
  selector: {db: string; type?: DATABASE_TYPE};
  version: number;
  create?: boolean;
  reason?: string;
  nowMs: number;
}): Promise<{
  created: boolean;
  before: MigrationsDBDocument | undefined;
  after: MigrationsDBDocument;
}> {
  const existing = matchMigrationDocs(options.docs, options.selector);
  if (existing.length > 1) {
    resolveMigrationDoc(options.docs, {
      db: options.selector.db,
      type: options.selector.type,
    });
  }
  const before = existing[0];
  if (!before && !options.create) {
    throw new Error(
      `No migration document matches '${options.selector.db}'. Pass --create --type=… to insert one.`
    );
  }
  if (!before && options.create) {
    if (!options.selector.type) {
      throw new Error('--create requires --type so the new document is typed.');
    }
    const fields: MigrationsDBFields = {
      dbType: options.selector.type,
      dbName: options.selector.db,
      version: options.version,
      status: 'healthy',
      migrationLog: [
        adminLogEntry({
          from: 0,
          to: options.version,
          notes:
            options.reason ??
            `Admin created migration document at v${options.version}`,
          nowMs: options.nowMs,
        }),
      ],
    };
    const posted = await options.db.post(fields);
    const after = (await options.db.get(posted.id)) as MigrationsDBDocument;
    return {created: true, before: undefined, after};
  }

  const doc = before!;
  const notes =
    options.reason ??
    `Admin set-version ${doc.version} → ${options.version} (record only; data was not migrated)`;
  const after: MigrationsDBDocument = {
    ...doc,
    version: options.version,
    migrationLog: [
      ...doc.migrationLog,
      adminLogEntry({
        from: doc.version,
        to: options.version,
        notes,
        nowMs: options.nowMs,
      }),
    ],
  };
  await options.db.put(after);
  return {created: false, before: doc, after};
}

export async function setDbHealth(options: {
  db: DebuggerDb;
  docs: MigrationsDBDocument[];
  selector: {db: string; type?: DATABASE_TYPE};
  health: 'healthy' | 'not-healthy';
  nowMs: number;
}): Promise<{
  changed: boolean;
  before: MigrationsDBDocument;
  after: MigrationsDBDocument;
}> {
  const before = resolveMigrationDoc(options.docs, {
    db: options.selector.db,
    type: options.selector.type,
  });
  if (before.status === options.health) {
    return {changed: false, before, after: before};
  }
  const after: MigrationsDBDocument = {
    ...before,
    status: options.health,
    migrationLog: [
      ...before.migrationLog,
      adminLogEntry({
        from: before.version,
        to: before.version,
        notes: `Admin set-health ${before.status} → ${options.health}`,
        nowMs: options.nowMs,
      }),
    ],
  };
  await options.db.put(after);
  return {changed: true, before, after};
}

export async function unregisterDb(options: {
  db: DebuggerDb;
  docs: MigrationsDBDocument[];
  selector: {db: string; type?: DATABASE_TYPE};
}): Promise<{removed: boolean; before: MigrationsDBDocument}> {
  const before = resolveMigrationDoc(options.docs, {
    db: options.selector.db,
    type: options.selector.type,
  });
  await options.db.remove({_id: before._id, _rev: before._rev});
  return {removed: true, before};
}

export function filterDbRows(
  rows: DbRow[],
  filters: {
    type?: DATABASE_TYPE;
    behind: boolean;
    ahead: boolean;
    unhealthy: boolean;
  }
): DbRow[] {
  return rows.filter(row => {
    if (filters.type && row.dbType !== filters.type) {
      return false;
    }
    if (filters.behind && row.relation !== 'behind') {
      return false;
    }
    if (filters.ahead && row.relation !== 'ahead') {
      return false;
    }
    if (filters.unhealthy && row.health !== 'not-healthy') {
      return false;
    }
    return true;
  });
}

export function statusIsStrictFailure(snapshot: StatusSnapshot): boolean {
  const summary = summarizeDatabases(snapshot.databases);
  return (
    snapshot.lock.doc?.status === 'running' ||
    summary.behind > 0 ||
    summary.ahead > 0 ||
    summary.unknown > 0 ||
    summary.unhealthy > 0 ||
    snapshot.missingExpected.length > 0
  );
}

export function migrationTargets() {
  return DATABASE_TYPES.map(dbType => ({
    dbType,
    defaultVersion: DB_TARGET_VERSIONS[dbType].defaultVersion,
    targetVersion: DB_TARGET_VERSIONS[dbType].targetVersion,
    steps: DB_MIGRATIONS.filter(step => step.dbType === dbType).map(step => ({
      from: step.from,
      to: step.to,
      description: step.description,
    })),
  }));
}

function pad(value: string, width: number): string {
  return value.length >= width
    ? value
    : value + ' '.repeat(width - value.length);
}

export function formatDbTable(rows: DbRow[]): string {
  if (rows.length === 0) {
    return '  (none)';
  }
  const headers = [
    'TYPE',
    'NAME',
    'VER',
    'TARGET',
    'STATE',
    'HEALTH',
    'PENDING',
  ];
  const cells = rows.map(row => [
    row.dbType,
    row.dbName,
    String(row.version),
    row.target === undefined ? '?' : String(row.target),
    row.relation,
    row.health,
    row.pending.length > 0
      ? row.pending.map(step => `${step.from}→${step.to}`).join(', ')
      : row.gaps.length > 0
        ? row.gaps.map(gap => `gap ${gap.from}→${gap.to}`).join(', ')
        : '',
  ]);
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...cells.map(row => row[index].length))
  );
  const line = (parts: string[]) =>
    '  ' + parts.map((part, index) => pad(part, widths[index])).join('  ');
  return [line(headers), ...cells.map(line)].join('\n');
}

export function formatLockHuman(lock: LockView, timeoutMs: number): string {
  const lines = [
    `  Present:     ${lock.present ? 'yes' : 'no'}`,
    `  Steal after: ${formatDuration(timeoutMs)}`,
  ];
  if (!lock.doc) {
    lines.push(`  Note:        ${lock.interpretation}`);
    return lines.join('\n');
  }
  const doc = lock.doc;
  lines.push(`  Status:      ${doc.status}`);
  lines.push(`  Holder:      ${doc.holderId}`);
  lines.push(`  Attempt:     ${doc.attempt}`);
  lines.push(`  Started:     ${formatTimestamp(doc.startedAtMs)}`);
  lines.push(`  Updated:     ${formatTimestamp(doc.updatedAtMs)}`);
  if (lock.ageMs !== undefined) {
    lines.push(`  Age:         ${formatDuration(lock.ageMs)}`);
    lines.push(
      `  Remaining:   ${
        lock.expired
          ? `expired (${formatDuration(Math.abs(lock.remainingMs ?? 0))} over)`
          : formatDuration(lock.remainingMs ?? 0)
      }`
    );
  }
  if (doc.error) {
    lines.push(`  Error:       ${doc.error}`);
  }
  lines.push(`  Note:        ${lock.interpretation}`);
  if (doc.history.length > 0) {
    lines.push('  History (oldest first):');
    doc.history.forEach((attempt, index) => {
      const duration =
        attempt.finishedAtMs !== undefined
          ? formatDuration(attempt.finishedAtMs - attempt.startedAtMs)
          : 'n/a';
      lines.push(
        `    ${index + 1}. ${attempt.status.padEnd(10)} holder=${attempt.holderId}  ${formatTimestamp(attempt.startedAtMs)} → ${formatTimestamp(attempt.finishedAtMs)}  (${duration})` +
          (attempt.error ? `\n       error=${attempt.error}` : '')
      );
    });
  }
  return lines.join('\n');
}

export function formatStatusHuman(snapshot: StatusSnapshot): string {
  const summary = summarizeDatabases(snapshot.databases);
  const lines = [
    '=== Startup migration lock ===',
    `  Couch:       ${snapshot.couchUrl}`,
    `  Config:      STARTUP_MIGRATION_LOCK_ENABLED=${snapshot.lockEnabled}  timeout=${formatDuration(snapshot.timeoutMs)}`,
    formatLockHuman(snapshot.lock, snapshot.timeoutMs),
    '',
    '=== Database versions ===',
    formatDbTable(snapshot.databases),
    '',
    `  ${summary.total} db(s): ${summary.current} current, ${summary.behind} behind, ${summary.ahead} ahead, ${summary.unknown} unknown-type, ${summary.unhealthy} unhealthy`,
  ];
  if (snapshot.missingExpected.length > 0) {
    lines.push(
      `  Missing expected global docs: ${snapshot.missingExpected
        .map(item => `${item.dbType}:${item.dbName}`)
        .join(', ')}`
    );
  }
  if (snapshot.unrecognised.length > 0) {
    lines.push('  Unrecognised documents in migrations DB:');
    for (const doc of snapshot.unrecognised) {
      lines.push(`    • ${doc.id} (${doc.hint})`);
    }
  }
  return lines.join('\n');
}

export function formatShowHuman(doc: MigrationsDBDocument): string {
  const row = toDbRow(doc);
  const lines = [
    `  Type:     ${doc.dbType}`,
    `  Name:     ${doc.dbName}`,
    `  Id:       ${doc._id}`,
    `  Version:  ${doc.version}` +
      (row.target === undefined
        ? ''
        : `  (target ${row.target}, default ${row.defaultVersion})`),
    `  State:    ${row.relation}`,
    `  Health:   ${doc.status}`,
  ];
  if (row.pending.length > 0) {
    lines.push('  Pending steps this build would apply:');
    for (const step of row.pending) {
      lines.push(`    ${step.from}→${step.to}  ${step.description}`);
    }
  }
  if (row.gaps.length > 0) {
    lines.push('  Missing migration functions:');
    for (const gap of row.gaps) {
      lines.push(`    ${gap.from}→${gap.to}`);
    }
  }
  if (row.relation === 'ahead') {
    lines.push(
      '  Warning: recorded version is ahead of this build. migrateDbs cannot downgrade.'
    );
  }
  lines.push(`  Migration log (${doc.migrationLog.length}):`);
  if (doc.migrationLog.length === 0) {
    lines.push('    (empty)');
  }
  doc.migrationLog.forEach((entry, index) => {
    lines.push(
      `    ${index + 1}. ${entry.status}  ${entry.from}→${entry.to}  ${formatTimestamp(entry.completedAtTimestampMs)}  by ${entry.launchedBy}` +
        (entry.notes ? `\n       ${entry.notes}` : '')
    );
    if (entry.issues && entry.issues.length > 0) {
      lines.push(`       issues: ${entry.issues.join('; ')}`);
    }
  });
  return lines.join('\n');
}

export function formatTargetsHuman(): string {
  const groups = migrationTargets();
  const lines = ['=== Registered DB targets ==='];
  for (const group of groups) {
    lines.push(
      `  ${group.dbType}: default v${group.defaultVersion} → target v${group.targetVersion}`
    );
    if (group.steps.length === 0) {
      lines.push(
        '    (no step functions; already at default/target or no-op type)'
      );
    }
    for (const step of group.steps) {
      lines.push(`    ${step.from}→${step.to}  ${step.description}`);
    }
  }
  return lines.join('\n');
}

export function formatNotebooksHuman(
  rows: NotebookRow[],
  target: string
): string {
  const lines = [
    `=== Notebook uiSpec versions (target ${target}) ===`,
    `  ${rows.length} listing(s)`,
  ];
  if (rows.length === 0) {
    return lines.join('\n');
  }
  const headers = ['KIND', 'NAME', 'VERSION', 'RELATION', 'MIGRATE'];
  const cells = rows.map(row => [
    row.kind,
    `${row.name} (${row.id})`,
    row.schemaVersion ?? '(none)',
    row.relation,
    row.requiresMigration ? 'yes' : 'no',
  ]);
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...cells.map(row => row[index].length))
  );
  const line = (parts: string[]) =>
    '  ' + parts.map((part, index) => pad(part, widths[index])).join('  ');
  lines.push(line(headers));
  for (const cell of cells) {
    lines.push(line(cell));
  }
  const needing = rows.filter(row => row.requiresMigration).length;
  lines.push(
    `  ${needing} would be migrated on the next notebook startup walk.`
  );
  return lines.join('\n');
}

function print(message: string): void {
  console.log(message);
}

function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

/** Diagnostics and write-command receipts — keep stdout reserved for payload / `--json`. */
function log(message: string): void {
  console.error(message);
}

async function confirmOrThrow(message: string, yes: boolean): Promise<void> {
  if (yes) {
    return;
  }
  if (!process.stdin.isTTY) {
    throw new Error('Refusing write without --yes (stdin is not a TTY).');
  }
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    const answer = await new Promise<string>(resolve => {
      rl.question(`${message}\nType "yes" to continue: `, resolve);
    });
    if (answer.trim().toLowerCase() !== 'yes') {
      throw new Error('Aborted.');
    }
  } finally {
    rl.close();
  }
}

async function requireCouch(): Promise<void> {
  const connection = await verifyCouchDBConnection();
  if (!connection.valid) {
    const details = [
      connection.server_msg,
      connection.validate_error,
      ...(connection.database_errors ?? []),
    ]
      .filter(Boolean)
      .join('; ');
    throw new Error(
      `Cannot reach CouchDB at ${config.couchdbInternalUrl}` +
        (details ? `: ${details}` : '.')
    );
  }
}

async function loadSnapshot(
  db: DebuggerDb,
  nowMs = Date.now()
): Promise<StatusSnapshot> {
  const loaded = await loadMigrationsDb(db);
  return collectStatus({
    couchUrl: config.couchdbInternalUrl,
    lockEnabled: config.startupMigrationLockEnabled,
    timeoutMs: config.startupMigrationLockTimeoutMs,
    nowMs,
    lock: loaded.lock,
    databases: loaded.databases,
    unrecognised: loaded.unrecognised,
  });
}

async function loadNotebooks(): Promise<NotebookRow[]> {
  const [projects, templates] = await Promise.all([
    getAllProjectsListing(),
    getTemplates({}),
  ]);
  const rows: NotebookRow[] = [];
  for (const project of projects) {
    const assessed = assessNotebookSchemaCompatibility(
      project.uiSpecProperties?.schemaVersion
    );
    rows.push({
      kind: 'project',
      id: project._id,
      name: project.name,
      schemaVersion: project.uiSpecProperties?.schemaVersion,
      relation: assessed.relation,
      requiresMigration: assessed.requiresMigration,
      reason: assessed.reason,
    });
  }
  for (const template of templates) {
    const assessed = assessNotebookSchemaCompatibility(
      template.uiSpecProperties?.schemaVersion
    );
    rows.push({
      kind: 'template',
      id: template._id,
      name: template.name,
      schemaVersion: template.uiSpecProperties?.schemaVersion,
      relation: assessed.relation,
      requiresMigration: assessed.requiresMigration,
      reason: assessed.reason,
    });
  }
  return rows;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

export async function runCommand(
  command: DebuggerCommand,
  options: {
    db: DebuggerDb;
    nowMs?: number;
    instanceId?: string;
    timeoutMs?: number;
    confirm?: (message: string, yes: boolean) => Promise<void>;
    loadNotebooks?: () => Promise<NotebookRow[]>;
  }
): Promise<{exitCode: number}> {
  if (command.name === 'help') {
    print(usageText());
    return {exitCode: 0};
  }

  const nowMs = options.nowMs ?? Date.now();
  const instanceId = options.instanceId ?? createAdminInstanceId();
  const timeoutMs = options.timeoutMs ?? config.startupMigrationLockTimeoutMs;
  const confirm = options.confirm ?? confirmOrThrow;

  if (command.name === 'targets') {
    if (command.json) {
      printJson({
        notebookUiSchema: CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
        databases: migrationTargets(),
      });
    } else {
      print(formatTargetsHuman());
      print(
        `\n  Notebook uiSpec target: ${CURRENT_NOTEBOOK_UI_SCHEMA_VERSION}`
      );
    }
    return {exitCode: 0};
  }

  if (command.name === 'status') {
    const snapshot = await loadSnapshot(options.db, nowMs);
    if (command.json) {
      printJson({...snapshot, summary: summarizeDatabases(snapshot.databases)});
    } else {
      print(formatStatusHuman(snapshot));
    }
    return {
      exitCode: command.strict && statusIsStrictFailure(snapshot) ? 1 : 0,
    };
  }

  if (command.name === 'lock') {
    const snapshot = await loadSnapshot(options.db, nowMs);
    if (command.json) {
      printJson(snapshot.lock);
    } else {
      print('=== Startup migration lock ===');
      print(formatLockHuman(snapshot.lock, snapshot.timeoutMs));
    }
    return {exitCode: 0};
  }

  if (command.name === 'dbs') {
    const snapshot = await loadSnapshot(options.db, nowMs);
    const rows = filterDbRows(snapshot.databases, command);
    if (command.json) {
      printJson({databases: rows, summary: summarizeDatabases(rows)});
    } else {
      print('=== Database versions ===');
      print(formatDbTable(rows));
      const summary = summarizeDatabases(rows);
      print(
        `\n  ${summary.total} shown: ${summary.current} current, ${summary.behind} behind, ${summary.ahead} ahead, ${summary.unhealthy} unhealthy`
      );
    }
    return {exitCode: 0};
  }

  if (command.name === 'show') {
    const loaded = await loadMigrationsDb(options.db);
    const doc = resolveMigrationDoc(loaded.databases, {
      db: command.db,
      type: command.type,
    });
    if (command.json) {
      printJson({document: doc, view: toDbRow(doc)});
    } else {
      print(formatShowHuman(doc));
    }
    return {exitCode: 0};
  }

  if (command.name === 'notebooks') {
    const rows = await (options.loadNotebooks ?? loadNotebooks)();
    if (command.json) {
      printJson({
        target: CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
        notebooks: rows,
      });
    } else {
      print(formatNotebooksHuman(rows, CURRENT_NOTEBOOK_UI_SCHEMA_VERSION));
    }
    return {exitCode: 0};
  }

  if (command.name === 'watch') {
    const started = nowMs;
    let tickNow = nowMs;
    while (true) {
      const lock = classifyLock(await readLock(options.db), tickNow, timeoutMs);
      const status = lock.doc?.status ?? 'missing';
      print(
        `${formatTimestamp(tickNow)}  ${status}` +
          (lock.doc
            ? `  holder=${lock.doc.holderId} attempt=${lock.doc.attempt}` +
              (lock.ageMs !== undefined
                ? ` age=${formatDuration(lock.ageMs)}`
                : '')
            : '')
      );
      if (status !== 'running') {
        return {exitCode: 0};
      }
      if (command.timeoutMs > 0 && tickNow - started >= command.timeoutMs) {
        throw new Error(
          `Watch timed out after ${formatDuration(command.timeoutMs)} with the lock still running.`
        );
      }
      await sleep(command.intervalMs);
      tickNow = Date.now();
    }
  }

  if (command.name === 'unlock') {
    const before = await readLock(options.db);
    await confirm(
      `Force-settle the startup lock as ${command.status}` +
        (before
          ? ` (currently ${before.status}, holder ${before.holderId}).`
          : '.') +
        ' Waiters will proceed; a live doer will not overwrite this settlement.',
      command.yes
    );
    const result = await forceUnlock({
      db: options.db,
      nowMs,
      status: command.status,
      reason: command.reason,
      force: command.force,
    });
    if (!result.changed) {
      log(
        `${DEBUG_MIGRATION_LOCK_LOG} lock already ${result.before?.status}; pass --force to rewrite.`
      );
    } else {
      log(
        `${DEBUG_MIGRATION_LOCK_LOG} unlocked ${result.before?.status} → ${result.after?.status}`
      );
    }
    return {exitCode: 0};
  }

  if (command.name === 'delete-lock') {
    await confirm(
      'Delete the startup-migration lock document. The next enabled boot will create a new one and run migrations.',
      command.yes
    );
    const result = await deleteLock({db: options.db});
    log(
      result.removed
        ? `${DEBUG_MIGRATION_LOCK_LOG} deleted lock (was ${result.before?.status})`
        : `${DEBUG_MIGRATION_LOCK_LOG} no lock document to delete`
    );
    return {exitCode: 0};
  }

  if (command.name === 'claim') {
    await confirm(
      'Write a running lock held by this CLI. Other API instances will wait until timeout, unlock, or this claim is settled.',
      command.yes
    );
    const result = await forceClaim({
      db: options.db,
      nowMs,
      instanceId,
      timeoutMs,
      force: command.force,
    });
    log(
      `${DEBUG_MIGRATION_LOCK_LOG} claimed lock as ${result.after.holderId} (attempt ${result.after.attempt}${result.stolen ? ', stole previous holder' : ''})`
    );
    return {exitCode: 0};
  }

  if (command.name === 'set-version') {
    const loaded = await loadMigrationsDb(options.db);
    await confirm(
      `Set recorded version of '${command.db}' to ${command.version}. ` +
        'This does not migrate or rewrite documents; the next migrate run will trust this number.',
      command.yes
    );
    const result = await setDbVersion({
      db: options.db,
      docs: loaded.databases,
      selector: {db: command.db, type: command.type},
      version: command.version,
      create: command.create,
      reason: command.reason,
      nowMs,
    });
    log(
      result.created
        ? `${DEBUG_MIGRATION_LOCK_LOG} created ${result.after.dbType}:${result.after.dbName} at v${result.after.version}`
        : `${DEBUG_MIGRATION_LOCK_LOG} ${result.after.dbType}:${result.after.dbName} version ${result.before?.version} → ${result.after.version}`
    );
    return {exitCode: 0};
  }

  if (command.name === 'set-health') {
    const loaded = await loadMigrationsDb(options.db);
    await confirm(
      `Set health of '${command.db}' to ${command.health}.`,
      command.yes
    );
    const result = await setDbHealth({
      db: options.db,
      docs: loaded.databases,
      selector: {db: command.db, type: command.type},
      health: command.health,
      nowMs,
    });
    log(
      result.changed
        ? `${DEBUG_MIGRATION_LOCK_LOG} ${result.after.dbType}:${result.after.dbName} health ${result.before.status} → ${result.after.status}`
        : `${DEBUG_MIGRATION_LOCK_LOG} ${result.before.dbType}:${result.before.dbName} already ${result.before.status}`
    );
    return {exitCode: 0};
  }

  if (command.name === 'unregister') {
    const loaded = await loadMigrationsDb(options.db);
    await confirm(
      `Delete the version document for '${command.db}'. The next migrate will treat the database as unknown and start from defaultVersion.`,
      command.yes
    );
    const result = await unregisterDb({
      db: options.db,
      docs: loaded.databases,
      selector: {db: command.db, type: command.type},
    });
    log(
      `${DEBUG_MIGRATION_LOCK_LOG} unregistered ${result.before.dbType}:${result.before.dbName} (was v${result.before.version})`
    );
    return {exitCode: 0};
  }

  return {exitCode: 0};
}

export async function main(argv = process.argv.slice(2)): Promise<number> {
  const command = parseArgs(argv);
  if (command.name === 'help') {
    print(usageText());
    return 0;
  }

  log(
    `${DEBUG_MIGRATION_LOCK_LOG} couch=${config.couchdbInternalUrl} lockEnabled=${config.startupMigrationLockEnabled}`
  );
  await requireCouch();
  const db = getMigrationDb() as unknown as DebuggerDb;
  const result = await runCommand(command, {db});
  return result.exitCode;
}

export function isDirectExecution(
  argv1: string | undefined = process.argv[1]
): boolean {
  return argv1 !== undefined && /debugMigrationLock(\.ts)?$/.test(argv1);
}

if (isDirectExecution()) {
  main()
    .then(code => {
      process.exit(code);
    })
    .catch((error: unknown) => {
      console.error(
        `${DEBUG_MIGRATION_LOCK_LOG} failed: ${errorMessage(error)}`
      );
      process.exit(1);
    });
}
