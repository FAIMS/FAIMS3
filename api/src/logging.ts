/**
 * Conductor stdout logging helpers.
 *
 * Request access logs come from morgan (`combined`). This module adds
 * structured audit lines for impersonation and invite-code activity so they
 * can be grepped independently of HTTP access logs.
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
  if (config.bugsnagApiKey) {
    const err = error instanceof Error ? error : new Error(String(error));
    Bugsnag.notify(err);
  }
};

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

/** What happened: create, public lookup, consume on login/register, or register with no code. */
export type InviteAuditEvent =
  | 'invite.create'
  | 'invite.lookup'
  | 'invite.consume'
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
