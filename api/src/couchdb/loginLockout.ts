// SPDX-License-Identifier: Apache-2.0
/**
 * Couch-backed progressive lockout for local-password login.
 *
 * One Auth document per people `_id` (`loginlockout_<userId>`). Couch is the
 * only source of truth — no process-local cache — so every Conductor task
 * shares the same counter. Unknown identifiers never create a document.
 */

import {
  AUTH_RECORD_ID_PREFIXES,
  LoginLockoutExistingDocument,
  LoginLockoutExistingDocumentSchema,
  LoginLockoutFields,
} from '@faims3/data-model';
import {getAuthDB} from '.';
import {nowMs} from '../time';
import {getCouchUserFromEmailOrUserId} from './users';

export const LOCKOUT_PERIOD_SHORT_MS = 10 * 1000;
export const LOCKOUT_PERIOD_MEDIUM_MS = 60 * 1000;
export const LOCKOUT_PERIOD_LONG_MS = 5 * 60 * 1000;
export const LOCKOUT_PERIOD_MAX_MS = 15 * 60 * 1000;

/** Last-attempt older than this is treated as no delay (and may be deleted). */
export const LOGIN_LOCKOUT_STALE_MS = LOCKOUT_PERIOD_MAX_MS;

const INCREMENT_RETRY_BUDGET = 12;

/** Raised on unexpected lockout-doc reads (network, 5xx, parse). */
export class LoginLockoutUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LoginLockoutUnavailableError';
  }
}

export const loginLockoutDocumentId = (userId: string): string =>
  AUTH_RECORD_ID_PREFIXES.loginlockout + userId;

/**
 * Remaining delay in ms for a given failure count and last-attempt time.
 * Returns `max(0, period - elapsed)`, not the full period when any remainder
 * is positive.
 */
export const getAccountLockoutDelayMs = ({
  count,
  lastAttemptMs,
  now = Date.now(),
}: {
  count: number;
  lastAttemptMs: number;
  now?: number;
}): number => {
  if (count < 5) {
    return 0;
  }
  const period =
    count >= 15
      ? LOCKOUT_PERIOD_MAX_MS
      : count >= 10
        ? LOCKOUT_PERIOD_LONG_MS
        : count >= 7
          ? LOCKOUT_PERIOD_MEDIUM_MS
          : LOCKOUT_PERIOD_SHORT_MS;
  return Math.max(0, period - (now - lastAttemptMs));
};

export const isLoginLockoutStale = (
  doc: Pick<LoginLockoutExistingDocument, 'lastAttemptMs'>,
  now = Date.now()
): boolean => now - doc.lastAttemptMs > LOGIN_LOCKOUT_STALE_MS;

const isNotFound = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const status = (error as {status?: unknown}).status;
  const name = (error as {name?: unknown}).name;
  return status === 404 || name === 'not_found';
};

const isConflict = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const status = (error as {status?: unknown}).status;
  const name = (error as {name?: unknown}).name;
  return status === 409 || name === 'conflict';
};

const wrapReadError = (error: unknown, id: string): never => {
  const detail = error instanceof Error ? error.message : String(error);
  throw new LoginLockoutUnavailableError(
    `Failed to read login lockout document ${id}: ${detail}`
  );
};

/**
 * Fetch the lockout document for a people `_id`. Missing/404 → null.
 * Any other read/parse error fails closed via {@link LoginLockoutUnavailableError}.
 */
export const getLoginLockoutForUserId = async (
  userId: string
): Promise<LoginLockoutExistingDocument | null> => {
  const authDB = getAuthDB();
  const id = loginLockoutDocumentId(userId);
  try {
    const raw = await authDB.get(id);
    const parsed = LoginLockoutExistingDocumentSchema.safeParse(raw);
    if (!parsed.success) {
      throw new LoginLockoutUnavailableError(
        `Login lockout document ${id} failed schema parse`
      );
    }
    return parsed.data;
  } catch (error) {
    if (isNotFound(error)) {
      return null;
    }
    if (error instanceof LoginLockoutUnavailableError) {
      throw error;
    }
    return wrapReadError(error, id);
  }
};

const deleteLoginLockoutDoc = async (
  doc: LoginLockoutExistingDocument
): Promise<void> => {
  const authDB = getAuthDB();
  try {
    await authDB.remove(doc);
  } catch (error) {
    if (isNotFound(error) || isConflict(error)) {
      return;
    }
    throw error;
  }
};

export type LoginLockoutEvaluation = {
  delayMs: number;
  userId?: string;
};

/**
 * Remaining delay for the people user resolved from `identifier`.
 * Unknown identifiers and missing/stale docs have no delay.
 */
export const evaluateLoginLockoutForIdentifier = async (
  identifier: string
): Promise<LoginLockoutEvaluation> => {
  const user = await getCouchUserFromEmailOrUserId(identifier);
  if (!user) {
    return {delayMs: 0};
  }

  const doc = await getLoginLockoutForUserId(user._id);
  if (!doc) {
    return {delayMs: 0, userId: user._id};
  }

  const now = nowMs();
  if (isLoginLockoutStale(doc, now)) {
    await deleteLoginLockoutDoc(doc).catch(() => undefined);
    return {delayMs: 0, userId: user._id};
  }

  return {
    delayMs: getAccountLockoutDelayMs({
      count: doc.count,
      lastAttemptMs: doc.lastAttemptMs,
      now,
    }),
    userId: user._id,
  };
};

/**
 * Create or increment the lockout document for a known people `_id`.
 * Concurrent writers retry on Couch 409 until the write lands or the budget
 * is exhausted. Stale docs restart at count 1.
 */
export const incrementLoginLockoutForUserId = async (
  userId: string
): Promise<LoginLockoutExistingDocument> => {
  const authDB = getAuthDB();
  const id = loginLockoutDocumentId(userId);
  let lastError: unknown;

  for (let attempt = 0; attempt < INCREMENT_RETRY_BUDGET; attempt++) {
    const now = nowMs();
    try {
      let existing: LoginLockoutExistingDocument | null = null;
      try {
        const raw = await authDB.get(id);
        const parsed = LoginLockoutExistingDocumentSchema.safeParse(raw);
        if (!parsed.success) {
          throw new LoginLockoutUnavailableError(
            `Login lockout document ${id} failed schema parse`
          );
        }
        existing = parsed.data;
      } catch (error) {
        if (isNotFound(error)) {
          existing = null;
        } else if (error instanceof LoginLockoutUnavailableError) {
          throw error;
        } else {
          return wrapReadError(error, id);
        }
      }

      if (!existing) {
        const created: LoginLockoutFields & {_id: string} = {
          _id: id,
          documentType: 'loginlockout',
          userId,
          count: 1,
          lastAttemptMs: now,
        };
        const put = await authDB.put(created);
        return {...created, _rev: put.rev};
      }

      const nextCount = isLoginLockoutStale(existing, now)
        ? 1
        : existing.count + 1;
      const updated: LoginLockoutExistingDocument = {
        ...existing,
        count: nextCount,
        lastAttemptMs: now,
      };
      const put = await authDB.put(updated);
      return {...updated, _rev: put.rev};
    } catch (error) {
      lastError = error;
      if (isConflict(error)) {
        continue;
      }
      throw error;
    }
  }

  throw (
    lastError ??
    new Error(`Login lockout increment retries exhausted for ${id}`)
  );
};

/**
 * Increment lockout for a known people user. Unknown identifiers write nothing.
 */
export const incrementLoginLockoutForIdentifier = async (
  identifier: string
): Promise<LoginLockoutExistingDocument | null> => {
  const user = await getCouchUserFromEmailOrUserId(identifier);
  if (!user) {
    return null;
  }
  return incrementLoginLockoutForUserId(user._id);
};

const resetLoginLockoutForUserIdOnce = async (
  userId: string
): Promise<void> => {
  const doc = await getLoginLockoutForUserId(userId);
  if (!doc) {
    return;
  }
  await deleteLoginLockoutDoc(doc);
};

/** Delete the lockout document so the next failure starts at 1. */
export const resetLoginLockoutForUserId = async (
  userId: string
): Promise<void> => {
  let lastError: unknown;
  for (let attempt = 0; attempt < INCREMENT_RETRY_BUDGET; attempt++) {
    try {
      await resetLoginLockoutForUserIdOnce(userId);
      return;
    } catch (error) {
      lastError = error;
      if (isConflict(error)) {
        continue;
      }
      throw error;
    }
  }
  throw (
    lastError ??
    new Error(
      `Login lockout reset retries exhausted for ${loginLockoutDocumentId(userId)}`
    )
  );
};

export const resetLoginLockoutForIdentifier = async (
  identifier: string
): Promise<void> => {
  const user = await getCouchUserFromEmailOrUserId(identifier);
  if (!user) {
    return;
  }
  await resetLoginLockoutForUserId(user._id);
};

/** Flash copy for remaining wait (seconds under a minute, else minutes). */
export const formatLoginLockoutMessage = (delayMs: number): string => {
  const delaySec = Math.ceil(delayMs / 1000);
  const delayMin = Math.ceil(delaySec / 60);
  return delaySec > 60
    ? `Too many failed login attempts. Please try again in ${delayMin} minute${delayMin > 1 ? 's' : ''}`
    : `Too many failed login attempts. Please try again in ${delaySec} second${delaySec > 1 ? 's' : ''}`;
};
