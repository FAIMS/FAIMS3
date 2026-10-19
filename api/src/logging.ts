// SPDX-License-Identifier: Apache-2.0
/**
 * Conductor stdout logging helpers.
 *
 * Request access logs come from morgan (`combined`) when
 * `config.requestLoggingEnabled` (`REQUEST_LOGGING_ENABLED`) is on.
 * This module adds structured audit lines for impersonation, invite-code,
 * export-download, and map-layer upload/processing activity so they can
 * be grepped independently of HTTP access logs.
 */
import {INPUT_LIMITS} from '@faims3/data-model';
import crypto from 'crypto';
import Bugsnag from '@bugsnag/js';
import Express from 'express';
import {config} from './buildconfig';
import {nowIso} from './time';

/**
 * Logs an error to the console and reports it to Bugsnag when configured. TODO:
 * there is a pending PR which properly handles errors and logs them to Bugsnag.
 * But this GDAL error is worthy of particular concern at this stage. Hence this
 * temporary workaround.
 */
export const logError = (error: unknown) => {
  console.error(error);
  if (config.bugsnagApiKey && shouldReportErrorToBugsnag(error)) {
    const err = error instanceof Error ? error : new Error(String(error));
    Bugsnag.notify(err);
  }
};

/**
 * Whether an error is worth a Bugsnag report.
 *
 * Ordinary 401s and the intentional tombstone-miss 404 are expected client
 * outcomes. Rate limits (429), forbidden access (403), and other failures
 * still report.
 */
export function shouldReportErrorToBugsnag(error: unknown): boolean {
  if (httpStatus(error) === 401) {
    return false;
  }
  if (isTombstoneNotFound(error)) {
    return false;
  }
  return true;
}

function httpStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }
  const record = error as {status?: unknown; statusCode?: unknown};
  if (typeof record.status === 'number') {
    return record.status;
  }
  if (typeof record.statusCode === 'number') {
    return record.statusCode;
  }
  return undefined;
}

function isTombstoneNotFound(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const name = (error as {name?: unknown}).name;
  return name === 'TombstoneNotFoundException';
}

/**
 * When the authenticated user is acting via an impersonation token, writes an
 * audit line to stdout (alongside morgan request logging).
 */
export function logImpersonatedRequest(req: Express.Request): void {
  const user = req.user;
  if (!user?.impersonatingUserId || config.runningUnderTest) {
    return;
  }

  console.log(
    `[Impersonation] ${user.impersonatingUserId} performed ${req.method} ${req.originalUrl} as ${user.user_id} at ${nowIso()}`
  );
}

// Invite audit
// ============
// One JSON line per create/lookup/redemption, prefixed `[InviteAudit]`. Invite codes
// are never logged in plaintext: the `inviteId` field is a fingerprint
// (`PREFIX-a..[sha256-8]..z`) so repeats can be correlated. Skipped under
// tests (`config.runningUnderTest`).

/** Max User-Agent / X-Forwarded-For chars on an audit line. */
const INVITE_AUDIT_UA_MAX = 256;
/** Plaintext body chars kept at each end of the fingerprint (`a` / `z`). */
const INVITE_AUDIT_PEEK = 1;
/** Hex chars of SHA-256 kept inside `[…]` — enough to match repeats. */
const INVITE_AUDIT_FINGERPRINT_LEN = 8;

/** Truncate a log field; empty/missing values are omitted. */
function truncateAuditValue(
  value: string | undefined,
  max: number
): string | undefined {
  if (!value) return undefined;
  return value.length <= max ? value : `${value.slice(0, max)}…`;
}

/**
 * Fingerprint an invite id for audit logs. Never returns the raw code.
 *
 * Format: `PREFIX-a..[djkfljkd]..z` — prefix, first/last body character,
 * and an 8-char SHA-256 of the full id so the same code hashes the same way.
 */
export function fingerprintInviteIdForAudit(
  inviteId: string | undefined
): string | undefined {
  if (!inviteId) return undefined;

  const capped =
    inviteId.length > INPUT_LIMITS.ID_MAX_LENGTH
      ? inviteId.slice(0, INPUT_LIMITS.ID_MAX_LENGTH)
      : inviteId;

  const hash = crypto
    .createHash('sha256')
    .update(capped)
    .digest('hex')
    .slice(0, INVITE_AUDIT_FINGERPRINT_LEN);

  const dash = capped.indexOf('-');
  const prefix = dash === -1 ? '' : capped.slice(0, dash);
  const body = dash === -1 ? capped : capped.slice(dash + 1);
  const peek = Math.min(INVITE_AUDIT_PEEK, body.length);
  const head = body.slice(0, peek);
  const tail = body.slice(-peek);
  const core = `${head}..[${hash}]..${tail}`;
  return prefix ? `${prefix}-${core}` : core;
}

/**
 * Client address and User-Agent for an invite audit line.
 * Prefers `req.ip`, then the socket address; copies `X-Forwarded-For` when set.
 */
export function inviteAuditFromRequest(req: {
  ip?: string;
  socket?: {remoteAddress?: string | null};
  get?: (name: string) => string | undefined;
}): {
  ip?: string;
  forwardedFor?: string;
  userAgent?: string;
} {
  return {
    ip: req.ip || req.socket?.remoteAddress || undefined,
    forwardedFor: truncateAuditValue(
      req.get?.('x-forwarded-for'),
      INVITE_AUDIT_UA_MAX
    ),
    userAgent: truncateAuditValue(req.get?.('user-agent'), INVITE_AUDIT_UA_MAX),
  };
}

/** What happened: create, public lookup, consume on login/register, revoke, or register with no code. */
export type InviteAuditEvent =
  | 'invite.create'
  | 'invite.lookup'
  | 'invite.consume'
  | 'invite.revoke'
  | 'invite.register_missing';

/** Result of that event. Create/consume use success/failure; lookups use valid/invalid/not_found. */
export type InviteAuditOutcome =
  | 'success'
  | 'failure'
  | 'valid'
  | 'invalid'
  | 'not_found';

/**
 * Write a structured invite audit line to stdout. Grep `[InviteAudit]`.
 * Callers typically spread {@link inviteAuditFromRequest} into `entry`.
 * `inviteId` is fingerprinted; the raw code is never written.
 */
export function logInviteAudit(entry: {
  event: InviteAuditEvent;
  outcome: InviteAuditOutcome;
  inviteId?: string;
  reason?: string;
  action?: string;
  source?: string;
  userId?: string;
  role?: string;
  inviteType?: string;
  resourceType?: string;
  resourceId?: string;
  /** Set for Quick Share invites so create, lookup, consume, and revoke can be filtered. */
  kind?: string;
  ip?: string;
  forwardedFor?: string;
  userAgent?: string;
}): void {
  if (config.runningUnderTest) {
    return;
  }

  const {inviteId, ...rest} = entry;
  console.log(
    `[InviteAudit] ${JSON.stringify({
      ts: nowIso(),
      ...rest,
      inviteId: fingerprintInviteIdForAudit(inviteId),
    })}`
  );
}

// Download audit
// ==============
// One JSON line per mint/consume, prefixed `[DownloadAudit]`. Cookie values,
// secrets, and Authorization headers are never logged. Skipped under tests.

/** Mint a grant, or redeem / fail to redeem one. */
export type DownloadAuditEvent = 'download.mint' | 'download.consume';

export type DownloadAuditOutcome = 'success' | 'failure';

/** How the consume request authenticated (omitted on mint). */
export type DownloadAuditAuth = 'cookie' | 'bearer';

/**
 * Structured export-download audit line. Grep `[DownloadAudit]`.
 * Never logs cookie values, secrets, or Authorization headers.
 */
export function logDownloadAudit(entry: {
  event: DownloadAuditEvent;
  outcome: DownloadAuditOutcome;
  grantId?: string;
  reason?: string;
  auth?: DownloadAuditAuth;
  userId?: string;
  projectID?: string;
  format?: string;
  impersonatingUserId?: string;
  ip?: string;
  forwardedFor?: string;
  userAgent?: string;
}): void {
  if (config.runningUnderTest) {
    return;
  }

  console.log(
    `[DownloadAudit] ${JSON.stringify({
      ts: nowIso(),
      ...entry,
    })}`
  );
}

// Map-asset processing audit
// ==========================
// One JSON line per upload/processing stage, prefixed `[MapAssetProcessing]`.
// Long waits (HTTP receive, CouchDB attachment I/O, GDAL) also emit
// `outcome: "waiting"` heartbeats so a stalled job is visible. Skipped
// under tests (`config.runningUnderTest`). Grep `[MapAssetProcessing]`.

/** Prefix for map-layer upload and GDAL processing audit lines. */
export const MAP_ASSET_PROCESSING_LOG = '[MapAssetProcessing]';

/** How often a long stage repeats `outcome: "waiting"` while it is blocked. */
export const MAP_ASSET_PROCESSING_HEARTBEAT_MS = 15_000;

/** One stage of the map-layer upload → normalize → store pipeline. */
export type MapAssetProcessingEvent =
  | 'disk.check'
  | 'upload.receive'
  | 'upload.accept'
  | 'asset.stage'
  | 'processing.enqueue'
  | 'processing.claim'
  | 'processing.run'
  | 'processing.files'
  | 'processing.originals.store'
  | 'processing.normalize'
  | 'gdal.command'
  | 'processing.normalized.store'
  | 'processing.commit'
  | 'attachment.put'
  | 'attachment.download';

/**
 * `started` / `waiting` / `success` / `failure` for a stage that runs.
 * `skipped` when the stage is a no-op (fresh claim held, disk probe failed
 * open, lost the processing claim before store).
 */
export type MapAssetProcessingOutcome =
  | 'started'
  | 'waiting'
  | 'success'
  | 'failure'
  | 'skipped';

/** Fields written on a `[MapAssetProcessing]` line. */
export type MapAssetProcessingEntry = {
  event: MapAssetProcessingEvent;
  outcome: MapAssetProcessingOutcome;
  assetId?: string;
  uploadId?: string;
  reason?: string;
  userId?: string;
  teamId?: string;
  method?: string;
  filename?: string;
  filenames?: string[];
  fileCount?: number;
  byteSize?: number;
  kind?: string;
  command?: string;
  detail?: string;
  phase?: string;
  percent?: number;
  elapsedMs?: number;
  attempt?: number;
  maxAttempts?: number;
  fromStaging?: boolean;
  attachmentId?: string;
  source?: string;
  ip?: string;
  forwardedFor?: string;
  userAgent?: string;
};

/**
 * Structured map-layer processing audit line. Grep `[MapAssetProcessing]`.
 * Does not log file paths, cookie values, or Authorization headers.
 */
export function formatMapAssetProcessingLine(
  entry: MapAssetProcessingEntry,
  ts: string = nowIso()
): string {
  return `${MAP_ASSET_PROCESSING_LOG} ${JSON.stringify({
    ts,
    ...entry,
  })}`;
}

/**
 * Write a structured map-layer processing audit line to stdout.
 * Grep `[MapAssetProcessing]`.
 */
export function logMapAssetProcessing(entry: MapAssetProcessingEntry): void {
  if (config.runningUnderTest) {
    return;
  }

  console.log(formatMapAssetProcessingLine(entry));
}

/**
 * Log `started`, optional `waiting` heartbeats, then `success` or `failure`
 * around a stage that may block (HTTP receive, GDAL, attachment I/O).
 */
export async function withMapAssetProcessingWait<T>(
  entry: Omit<MapAssetProcessingEntry, 'outcome' | 'elapsedMs'>,
  work: () => Promise<T>,
  heartbeatMs: number = MAP_ASSET_PROCESSING_HEARTBEAT_MS
): Promise<T> {
  const started = Date.now();
  logMapAssetProcessing({...entry, outcome: 'started'});
  const timer = setInterval(() => {
    logMapAssetProcessing({
      ...entry,
      outcome: 'waiting',
      elapsedMs: Date.now() - started,
    });
  }, heartbeatMs);
  timer.unref();
  try {
    const result = await work();
    logMapAssetProcessing({
      ...entry,
      outcome: 'success',
      elapsedMs: Date.now() - started,
    });
    return result;
  } catch (error) {
    logMapAssetProcessing({
      ...entry,
      outcome: 'failure',
      elapsedMs: Date.now() - started,
      reason: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    clearInterval(timer);
  }
}
