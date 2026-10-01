// SPDX-License-Identifier: Apache-2.0
/**
 * Couch-mediated exclusive lock for clustered API startup migrations.
 *
 * Stored as one well-known document ({@link STARTUP_MIGRATION_LOCK_ID}) in the
 * migrations DB. Callers pass a {@link StartupMigrationLockStore} (Pouch/Couch
 * `get`/`put` is enough). Production entry point is
 * {@link withStartupMigrationLock} via `runStartupMigrations` when
 * `config.startupMigrationLockEnabled` (`STARTUP_MIGRATION_LOCK_ENABLED`)
 * is on and `DISABLE_MIGRATE_ON_STARTUP` is off. The lock flag
 * defaults off for local reload safety; clustered deployments that
 * still migrate on boot must enable it (AWS CDK hard-enables it).
 *
 * ## Roles
 *
 * - **doer** — wins the claim, runs the callback, then writes `complete` or
 *   `failed` onto the lock. The callback runs on this instance only.
 * - **waiter** — sees a live `running` lock (or loses the same claim race) and
 *   polls until that attempt settles. Does not run the callback.
 *
 * A reported `failed` is still a settlement: waiters proceed and the caller
 * (`runStartupMigrations`) still attaches the full API. That matches the
 * pre-lock error-tolerant boot.
 *
 * ## Claim, settle, steal
 *
 * `tryClaim` becomes the doer when the document is missing, already
 * `complete`/`failed`, or `running` past {@link StartupMigrationLockOptions.timeoutMs}
 * (age is `now - startedAtMs`, not `updatedAtMs`). A later process start that
 * finds a settled lock therefore re-claims and runs again — migrations are
 * idempotent. Waiters who already joined a live attempt do not re-run; they
 * proceed once it settles.
 *
 * If the doer vanishes without writing a result, waiters return to `tryClaim`
 * after the timeout. The steal is a revisioned put, so only one waiter wins a
 * given race. A doer that was stolen mid-run must not overwrite the thief
 * (`settleLock` no-ops unless this instance still holds `running`).
 *
 * This is an edge-case guard, not a consensus protocol. The migrate path is
 * already error-tolerant; a silent crashed doer should be rare.
 *
 * ## I/O
 *
 * Transient Couch errors on claim get/put and waiter polls retry with
 * exponential backoff. A streak of {@link STARTUP_MIGRATION_LOCK_IO_RETRIES}
 * consecutive failures throws. `runStartupMigrations` catches that and
 * fail-opens so the full API can still attach. A successful read resets the
 * streak. 409 on claim is not I/O failure — it means another instance won.
 */
import {randomUUID} from 'node:crypto';
import {hostname} from 'node:os';
import {logKeyValue, type LogKeyValueFields} from '../utils/logKeyValue';

/** `_id` of the single lock document in the migrations DB. */
export const STARTUP_MIGRATION_LOCK_ID = 'startup-migration-lock';

/**
 * Default steal timeout (30 minutes). Production boot overrides this with
 * `config.startupMigrationLockTimeoutMs` (`STARTUP_MIGRATION_LOCK_TIMEOUT_MS`)
 * when the lock is enabled.
 */
export const STARTUP_MIGRATION_LOCK_TIMEOUT_MS = 30 * 60 * 1000;

/** How often a waiter re-reads the lock while a doer is still live. */
export const STARTUP_MIGRATION_LOCK_POLL_MS = 5_000;

/**
 * Consecutive lock I/O failures (claim get/put or waiter poll) before
 * {@link withStartupMigrationLock} throws. A successful read resets the streak.
 */
export const STARTUP_MIGRATION_LOCK_IO_RETRIES = 5;

/** First backoff after a lock I/O error; doubles each consecutive failure. */
export const STARTUP_MIGRATION_LOCK_IO_BACKOFF_MS = 1_000;

/** Cap for the I/O error backoff. */
export const STARTUP_MIGRATION_LOCK_IO_BACKOFF_MAX_MS = 16_000;

/** Keep at most this many {@link StartupMigrationLockDoc.history} rows (drop oldest). */
const MAX_LOCK_HISTORY = 10;

/** After the first wait log, emit `still_waiting` every N polls (5s * 6 = 30s). */
const WAIT_LOG_EVERY_POLLS = 6;

/** Prefix for structured `console.log` lines from clustered startup migrations. */
export const STARTUP_MIGRATION_LOG = '[startup-migration]';

/**
 * Current lock document status.
 *
 * - `running` — a doer holds the lock and has not settled.
 * - `complete` / `failed` — the last attempt wrote a result. A new
 *   {@link withStartupMigrationLock} call will re-claim and run again.
 */
export type StartupMigrationLockStatus = 'running' | 'complete' | 'failed';

/** One archived attempt on {@link StartupMigrationLockDoc.history}. */
export type StartupMigrationLockAttempt = {
  holderId: string;
  startedAtMs: number;
  finishedAtMs?: number;
  /** `timed_out` is written when a later claim steals a still-`running` lock. */
  status: 'complete' | 'failed' | 'timed_out';
  error?: string;
};

/** Shape of the well-known lock document. */
export type StartupMigrationLockDoc = {
  _id: string;
  _rev?: string;
  kind: 'startup-migration-lock';
  status: StartupMigrationLockStatus;
  /** Instance that last claimed (`hostname:pid:uuid8`). */
  holderId: string;
  /** Claim time; steal timeout is measured from this, not `updatedAtMs`. */
  startedAtMs: number;
  updatedAtMs: number;
  /** Monotonic claim count across this document's life. */
  attempt: number;
  /** Set when the current attempt settled as `failed`. */
  error?: string;
  history: StartupMigrationLockAttempt[];
};

/**
 * Persistence used by the lock. Production passes the migrations Pouch
 * database; tests may substitute an in-memory store.
 *
 * `get` should reject with a Pouch-style 404 / `not_found` when missing, and
 * `put` with 409 / `conflict` on a stale `_rev`. Other rejections are treated
 * as transient I/O.
 */
export type StartupMigrationLockStore = {
  get: (id: string) => Promise<StartupMigrationLockDoc>;
  put: (doc: StartupMigrationLockDoc) => Promise<unknown>;
};

/** Outcome of one {@link withStartupMigrationLock} call. */
export type StartupMigrationResult = {
  /** Whether this instance ran the callback or only waited. */
  role: 'doer' | 'waiter';
  /** Settlement written (doer) or observed (waiter). */
  status: 'complete' | 'failed';
  error?: string;
};

/** Arguments to {@link withStartupMigrationLock}. Time/sleep hooks are for tests. */
export type StartupMigrationLockOptions = {
  db: StartupMigrationLockStore;
  /** Stable for this process; see {@link createStartupInstanceId}. */
  instanceId: string;
  /** Migration work. Invoked only after this instance claims the lock. */
  run: () => Promise<void>;
  /**
   * Age of a `running` lock after which waiters steal. Defaults to
   * {@link STARTUP_MIGRATION_LOCK_TIMEOUT_MS}.
   */
  timeoutMs?: number;
  /** Defaults to {@link STARTUP_MIGRATION_LOCK_POLL_MS}. */
  pollIntervalMs?: number;
  /** Consecutive lock I/O errors before giving up. Defaults to {@link STARTUP_MIGRATION_LOCK_IO_RETRIES}. */
  maxIoErrors?: number;
  /** Backoff after the nth consecutive I/O error. `n` is 1-based. */
  ioBackoffMs?: (consecutiveErrors: number) => number;
  /** Clock for claim/timeout. Injected in tests; defaults to `Date.now`. */
  now?: () => number;
  /** Delay used for poll and I/O backoff. Injected in tests. */
  sleep?: (ms: number) => Promise<void>;
};

/**
 * Identity written as {@link StartupMigrationLockDoc.holderId}.
 * Format: `hostname:pid:<8 hex chars>` so clustered replicas can tell who
 * claimed or is waiting.
 */
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

/**
 * Default I/O backoff: 1s, 2s, 4s, … up to
 * {@link STARTUP_MIGRATION_LOCK_IO_BACKOFF_MAX_MS}. `consecutiveErrors` is
 * 1-based (first failure → `baseMs`).
 */
export function startupMigrationIoBackoffMs(
  consecutiveErrors: number,
  baseMs = STARTUP_MIGRATION_LOCK_IO_BACKOFF_MS,
  maxMs = STARTUP_MIGRATION_LOCK_IO_BACKOFF_MAX_MS
): number {
  const exp = Math.max(0, consecutiveErrors - 1);
  return Math.min(maxMs, baseMs * 2 ** exp);
}

/** Pouch/Couch 409 — another replica wrote the lock first. */
function isConflict(error: unknown): boolean {
  return pouchStatus(error) === 409 || pouchName(error) === 'conflict';
}

/** Pouch/Couch 404 — lock document has never been created. */
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

/**
 * Log a transient lock I/O error. Re-throws `error` once
 * `consecutiveErrors >= maxIoErrors` so the caller can fail-open.
 */
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

/** True when a `running` lock is old enough to steal (`nowMs - startedAtMs`). */
function isExpired(
  doc: StartupMigrationLockDoc,
  nowMs: number,
  timeoutMs: number
): boolean {
  return nowMs - doc.startedAtMs >= timeoutMs;
}

/**
 * When stealing a still-`running` lock, append a `timed_out` history row and
 * drop entries beyond {@link MAX_LOCK_HISTORY}. Settled docs keep their
 * existing history (the previous attempt already archived itself).
 */
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

/** Latest lock document, or `null` if it has never been created (404). */
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
 * Try to become the doer.
 *
 * Returns `claimed` after a successful put of `status: 'running'`. Returns
 * `wait` when another instance holds a non-expired `running` lock, or when
 * the put loses a 409 race. Missing, settled, and expired documents are
 * claimable. Non-409 put/get errors propagate as I/O.
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

/**
 * Write `complete` or `failed` for the current attempt.
 *
 * No-ops (and logs `lost_lock_before_settle`) if the document is gone, held
 * by someone else, or no longer `running` — a stolen lock must not be
 * overwritten. Settle I/O errors are logged (`settle_failed`) and swallowed
 * so a doer that already finished work can still return.
 */
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

/**
 * Run the callback then settle. A thrown `run` is recorded as `failed` and
 * returned — it does not reject {@link withStartupMigrationLock}.
 */
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
 * Poll until the current doer settles, or we should try to become the doer.
 *
 * - `proceed` — observed `complete` or `failed`; caller returns as a waiter.
 * - `retry` — document vanished or the `running` lock expired; caller loops
 *   back to {@link tryClaim} (steal / first-create).
 *
 * Poll I/O uses the same `maxIoErrors` threshold as claim, with its own
 * consecutive-error streak. A missing document is `retry`, not I/O failure.
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
 * Claim the startup-migration lock or wait for the current holder.
 *
 * Loops `tryClaim` → (`runAsDoer` | `waitForDoer`) until this instance either
 * runs and settles, or observes a settlement. The callback runs only on the
 * doer. A thrown `run` becomes `{role: 'doer', status: 'failed'}`; only a
 * consecutive lock-I/O streak rejects (caller fail-opens). A silent doer
 * crash is recovered by timeout + steal.
 *
 * @returns Who ran and how the attempt settled. Waiters never invoke `run`.
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
