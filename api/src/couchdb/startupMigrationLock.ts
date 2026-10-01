// SPDX-License-Identifier: Apache-2.0
/**
 * Couch-mediated exclusive lock for clustered API startup migrations.
 *
 * One instance (the "doer") runs the work. Other instances wait until the lock
 * is `complete` or `failed`, then continue booting — the same error-tolerant
 * path as today's startup (a reported failure does not block attaching the full API).
 *
 * Transient Couch errors (waiter polls, claim get/put) are retried with
 * exponential backoff. Only a streak of {@link STARTUP_MIGRATION_LOCK_IO_RETRIES}
 * consecutive I/O failures gives up and throws — `runStartupMigrations` then
 * fail-opens so the full API can attach.
 *
 * If the doer vanishes without writing a result, waiters steal the lock after
 * {@link STARTUP_MIGRATION_LOCK_TIMEOUT_MS}. The steal is a revisioned put, so
 * only one waiter wins a given race and becomes the next doer.
 *
 * A later startup wave that finds `complete`/`failed` will claim and run again
 * (migrations are idempotent). Waiters who already observed a live doer do not
 * re-run; they just proceed once it settles.
 *
 * This is an edge-case guard, not a distributed consensus system. The
 * underlying migrate path is already error-tolerant; the crashed-doer case
 * should be rare.
 */
import {randomUUID} from 'node:crypto';
import {hostname} from 'node:os';
import {logKeyValue, type LogKeyValueFields} from '../utils/logKeyValue';

/** Well-known document in the migrations DB. */
export const STARTUP_MIGRATION_LOCK_ID = 'startup-migration-lock';

/**
 * Default steal timeout (30 minutes). Production boot uses
 * `config.startupMigrationLockTimeoutMs` (`STARTUP_MIGRATION_LOCK_TIMEOUT_MS`).
 */
export const STARTUP_MIGRATION_LOCK_TIMEOUT_MS = 30 * 60 * 1000;

/** How often a waiter re-reads the lock. */
export const STARTUP_MIGRATION_LOCK_POLL_MS = 5_000;

/** Consecutive lock I/O failures before claim/wait gives up. */
export const STARTUP_MIGRATION_LOCK_IO_RETRIES = 5;

/** First backoff after a lock I/O error; doubles each consecutive failure. */
export const STARTUP_MIGRATION_LOCK_IO_BACKOFF_MS = 1_000;

/** Cap for the I/O error backoff. */
export const STARTUP_MIGRATION_LOCK_IO_BACKOFF_MAX_MS = 16_000;

/** Keep a short audit trail on the lock document itself. */
const MAX_LOCK_HISTORY = 10;

/** Log every Nth wait poll after the first (5s * 6 = 30s). */
const WAIT_LOG_EVERY_POLLS = 6;

/** Prefix for structured `console.log` lines from clustered startup migrations. */
export const STARTUP_MIGRATION_LOG = '[startup-migration]';

export type StartupMigrationLockStatus = 'running' | 'complete' | 'failed';

export type StartupMigrationLockAttempt = {
  holderId: string;
  startedAtMs: number;
  finishedAtMs?: number;
  status: 'complete' | 'failed' | 'timed_out';
  error?: string;
};

export type StartupMigrationLockDoc = {
  _id: string;
  _rev?: string;
  kind: 'startup-migration-lock';
  status: StartupMigrationLockStatus;
  holderId: string;
  startedAtMs: number;
  updatedAtMs: number;
  attempt: number;
  error?: string;
  history: StartupMigrationLockAttempt[];
};

export type StartupMigrationLockStore = {
  get: (id: string) => Promise<StartupMigrationLockDoc>;
  put: (doc: StartupMigrationLockDoc) => Promise<unknown>;
};

export type StartupMigrationResult = {
  role: 'doer' | 'waiter';
  status: 'complete' | 'failed';
  error?: string;
};

export type StartupMigrationLockOptions = {
  db: StartupMigrationLockStore;
  instanceId: string;
  run: () => Promise<void>;
  /** Defaults to {@link STARTUP_MIGRATION_LOCK_TIMEOUT_MS}. */
  timeoutMs?: number;
  /** Defaults to {@link STARTUP_MIGRATION_LOCK_POLL_MS}. */
  pollIntervalMs?: number;
  /** Consecutive lock I/O errors before giving up. Defaults to {@link STARTUP_MIGRATION_LOCK_IO_RETRIES}. */
  maxIoErrors?: number;
  /** Backoff after the nth consecutive I/O error. */
  ioBackoffMs?: (consecutiveErrors: number) => number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

/** Hostname, pid, and a short UUID so clustered replicas can identify themselves. */
export function createStartupInstanceId(): string {
  return `${hostname()}:${process.pid}:${randomUUID().slice(0, 8)}`;
}

/** One line: `[startup-migration] <event> key=value ...` (undefined fields omitted). */
export function logStartupMigration(
  event: string,
  fields: LogKeyValueFields = {}
): void {
  logKeyValue(STARTUP_MIGRATION_LOG, event, fields);
}

function sleepMs(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

/** 1s, 2s, 4s, … up to {@link STARTUP_MIGRATION_LOCK_IO_BACKOFF_MAX_MS}. */
export function startupMigrationIoBackoffMs(
  consecutiveErrors: number,
  baseMs = STARTUP_MIGRATION_LOCK_IO_BACKOFF_MS,
  maxMs = STARTUP_MIGRATION_LOCK_IO_BACKOFF_MAX_MS
): number {
  const exp = Math.max(0, consecutiveErrors - 1);
  return Math.min(maxMs, baseMs * 2 ** exp);
}

function isConflict(error: unknown): boolean {
  return pouchStatus(error) === 409 || pouchName(error) === 'conflict';
}

function isNotFound(error: unknown): boolean {
  return pouchStatus(error) === 404 || pouchName(error) === 'not_found';
}

function pouchStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }
  const status = (error as {status?: unknown}).status;
  return typeof status === 'number' ? status : undefined;
}

function pouchName(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }
  const name = (error as {name?: unknown}).name;
  return typeof name === 'string' ? name : undefined;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/** Log a transient lock I/O error. Throws once the consecutive streak is exhausted. */
function throwIfIoBudgetExceeded(options: {
  event: string;
  instanceId: string;
  error: unknown;
  consecutiveErrors: number;
  maxIoErrors: number;
}): void {
  const {event, instanceId, error, consecutiveErrors, maxIoErrors} = options;
  logStartupMigration(event, {
    instance: instanceId,
    consecutiveErrors,
    maxIoErrors,
    error: errorMessage(error),
  });
  if (consecutiveErrors >= maxIoErrors) {
    throw error;
  }
}

function isExpired(
  doc: StartupMigrationLockDoc,
  nowMs: number,
  timeoutMs: number
): boolean {
  return nowMs - doc.startedAtMs >= timeoutMs;
}

function archiveRunningAttempt(
  doc: StartupMigrationLockDoc,
  finishedAtMs: number
): StartupMigrationLockAttempt[] {
  if (doc.status !== 'running') {
    return doc.history;
  }
  const timedOut: StartupMigrationLockAttempt = {
    holderId: doc.holderId,
    startedAtMs: doc.startedAtMs,
    finishedAtMs,
    status: 'timed_out',
  };
  return [...doc.history, timedOut].slice(-MAX_LOCK_HISTORY);
}

async function readLock(
  db: StartupMigrationLockStore
): Promise<StartupMigrationLockDoc | null> {
  try {
    return await db.get(STARTUP_MIGRATION_LOCK_ID);
  } catch (error) {
    if (isNotFound(error)) {
      return null;
    }
    throw error;
  }
}

/**
 * Try to become the doer. Returns `wait` when another instance holds a live
 * lock (or just won the same claim race).
 */
async function tryClaim(options: {
  db: StartupMigrationLockStore;
  instanceId: string;
  timeoutMs: number;
  nowMs: number;
}): Promise<'claimed' | 'wait'> {
  const {db, instanceId, timeoutMs, nowMs} = options;
  const existing = await readLock(db);

  if (
    existing &&
    existing.status === 'running' &&
    !isExpired(existing, nowMs, timeoutMs)
  ) {
    logStartupMigration('wait_for_doer', {
      instance: instanceId,
      holder: existing.holderId,
      attempt: existing.attempt,
      startedAtMs: existing.startedAtMs,
      ageMs: nowMs - existing.startedAtMs,
      timeoutMs,
    });
    return 'wait';
  }

  const next: StartupMigrationLockDoc = {
    _id: STARTUP_MIGRATION_LOCK_ID,
    _rev: existing?._rev,
    kind: 'startup-migration-lock',
    status: 'running',
    holderId: instanceId,
    startedAtMs: nowMs,
    updatedAtMs: nowMs,
    attempt: (existing?.attempt ?? 0) + 1,
    history: existing ? archiveRunningAttempt(existing, nowMs) : [],
  };

  try {
    await db.put(next);
  } catch (error) {
    if (isConflict(error)) {
      logStartupMigration('claim_conflict', {
        instance: instanceId,
        previousHolder: existing?.holderId,
        previousStatus: existing?.status,
      });
      return 'wait';
    }
    throw error;
  }

  logStartupMigration('claimed', {
    instance: instanceId,
    attempt: next.attempt,
    stolen: existing?.status === 'running',
    previousHolder: existing?.holderId,
    previousStatus: existing?.status,
  });
  return 'claimed';
}

async function settleLock(options: {
  db: StartupMigrationLockStore;
  instanceId: string;
  status: 'complete' | 'failed';
  error?: string;
  nowMs: number;
}): Promise<void> {
  const {db, instanceId, status, error, nowMs} = options;
  try {
    const doc = await readLock(db);
    if (!doc || doc.holderId !== instanceId || doc.status !== 'running') {
      logStartupMigration('lost_lock_before_settle', {
        instance: instanceId,
        intendedStatus: status,
        holder: doc?.holderId,
        lockStatus: doc?.status,
      });
      return;
    }

    const history = [
      ...doc.history,
      {
        holderId: instanceId,
        startedAtMs: doc.startedAtMs,
        finishedAtMs: nowMs,
        status,
        error,
      },
    ].slice(-MAX_LOCK_HISTORY);

    await db.put({
      ...doc,
      status,
      updatedAtMs: nowMs,
      error,
      history,
    });
    logStartupMigration('settled', {
      instance: instanceId,
      status,
      attempt: doc.attempt,
      durationMs: nowMs - doc.startedAtMs,
      error,
    });
  } catch (settleError) {
    logStartupMigration('settle_failed', {
      instance: instanceId,
      intendedStatus: status,
      error: errorMessage(settleError),
    });
  }
}

async function runAsDoer(
  options: StartupMigrationLockOptions,
  now: () => number
): Promise<StartupMigrationResult> {
  const {db, instanceId, run} = options;
  logStartupMigration('doer_begin', {instance: instanceId});
  try {
    await run();
  } catch (error) {
    const message = errorMessage(error);
    console.error(`${STARTUP_MIGRATION_LOG} doer_failed`, error);
    await settleLock({
      db,
      instanceId,
      status: 'failed',
      error: message,
      nowMs: now(),
    });
    return {role: 'doer', status: 'failed', error: message};
  }

  await settleLock({
    db,
    instanceId,
    status: 'complete',
    nowMs: now(),
  });
  return {role: 'doer', status: 'complete'};
}

/**
 * Poll until the current doer settles, or the lock expires and we should try
 * to steal it.
 */
async function waitForDoer(options: {
  db: StartupMigrationLockStore;
  instanceId: string;
  timeoutMs: number;
  pollIntervalMs: number;
  maxIoErrors: number;
  ioBackoffMs: (consecutiveErrors: number) => number;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
}): Promise<
  | {action: 'proceed'; status: 'complete' | 'failed'; error?: string}
  | {action: 'retry'}
> {
  const {
    db,
    instanceId,
    timeoutMs,
    pollIntervalMs,
    maxIoErrors,
    ioBackoffMs,
    now,
    sleep,
  } = options;
  let polls = 0;
  let consecutiveErrors = 0;

  while (true) {
    await sleep(
      consecutiveErrors > 0 ? ioBackoffMs(consecutiveErrors) : pollIntervalMs
    );
    const nowMs = now();
    let doc: StartupMigrationLockDoc | null;
    try {
      doc = await readLock(db);
      consecutiveErrors = 0;
    } catch (error) {
      consecutiveErrors += 1;
      throwIfIoBudgetExceeded({
        event: 'wait_io_error',
        instanceId,
        error,
        consecutiveErrors,
        maxIoErrors,
      });
      continue;
    }

    polls += 1;

    if (!doc) {
      logStartupMigration('lock_missing_while_waiting', {instance: instanceId});
      return {action: 'retry'};
    }

    if (doc.status === 'complete' || doc.status === 'failed') {
      logStartupMigration('doer_settled', {
        instance: instanceId,
        holder: doc.holderId,
        status: doc.status,
        attempt: doc.attempt,
        error: doc.error,
      });
      return {action: 'proceed', status: doc.status, error: doc.error};
    }

    const ageMs = nowMs - doc.startedAtMs;
    if (isExpired(doc, nowMs, timeoutMs)) {
      logStartupMigration('doer_timeout', {
        instance: instanceId,
        holder: doc.holderId,
        attempt: doc.attempt,
        ageMs,
        timeoutMs,
      });
      return {action: 'retry'};
    }

    if (polls === 1 || polls % WAIT_LOG_EVERY_POLLS === 0) {
      logStartupMigration('still_waiting', {
        instance: instanceId,
        holder: doc.holderId,
        attempt: doc.attempt,
        ageMs,
        remainingMs: timeoutMs - ageMs,
        polls,
      });
    }
  }
}

/**
 * Claim the startup-migration lock or wait for the current holder. The
 * callback runs only on the doer. Reported failures are written to the lock
 * so waiters can proceed; a silent crash is recovered by timeout + steal.
 */
export async function withStartupMigrationLock(
  options: StartupMigrationLockOptions
): Promise<StartupMigrationResult> {
  const timeoutMs = options.timeoutMs ?? STARTUP_MIGRATION_LOCK_TIMEOUT_MS;
  const pollIntervalMs =
    options.pollIntervalMs ?? STARTUP_MIGRATION_LOCK_POLL_MS;
  const maxIoErrors = options.maxIoErrors ?? STARTUP_MIGRATION_LOCK_IO_RETRIES;
  const ioBackoffMs = options.ioBackoffMs ?? startupMigrationIoBackoffMs;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? sleepMs;
  let consecutiveClaimErrors = 0;

  logStartupMigration('begin', {instance: options.instanceId, timeoutMs});

  while (true) {
    let claim: 'claimed' | 'wait';
    try {
      claim = await tryClaim({
        db: options.db,
        instanceId: options.instanceId,
        timeoutMs,
        nowMs: now(),
      });
      consecutiveClaimErrors = 0;
    } catch (error) {
      consecutiveClaimErrors += 1;
      throwIfIoBudgetExceeded({
        event: 'claim_io_error',
        instanceId: options.instanceId,
        error,
        consecutiveErrors: consecutiveClaimErrors,
        maxIoErrors,
      });
      await sleep(ioBackoffMs(consecutiveClaimErrors));
      continue;
    }

    if (claim === 'claimed') {
      const result = await runAsDoer(options, now);
      logStartupMigration('finish', {
        instance: options.instanceId,
        role: result.role,
        status: result.status,
        error: result.error,
      });
      return result;
    }

    const wait = await waitForDoer({
      db: options.db,
      instanceId: options.instanceId,
      timeoutMs,
      pollIntervalMs,
      maxIoErrors,
      ioBackoffMs,
      now,
      sleep,
    });

    if (wait.action === 'proceed') {
      const result: StartupMigrationResult = {
        role: 'waiter',
        status: wait.status,
        error: wait.error,
      };
      logStartupMigration('finish', {
        instance: options.instanceId,
        role: result.role,
        status: result.status,
        error: result.error,
      });
      return result;
    }
  }
}
