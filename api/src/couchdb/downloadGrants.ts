/**
 * Single-use export download grants stored in the auth CouchDB.
 *
 * The public grant id is the uuid suffix of `_id` (`downloadgrant_<uuid>`).
 * Only the SHA-256 of the browser cookie secret is persisted.
 */

import {
  AUTH_RECORD_ID_PREFIXES,
  DownloadGrantExistingDocument,
  DownloadGrantFields,
} from '@faims3/data-model';
import crypto from 'crypto';
import {getAuthDB} from '.';
import {InternalSystemError} from '../exceptions';
import {expiryMsFromNow, nowMs} from '../time';
import {hashChallengeCode} from '../utils';

/** Download grants last this long. */
export const DOWNLOAD_GRANT_EXPIRY_MINUTES = 5;
export const DOWNLOAD_GRANT_EXPIRY_MS =
  DOWNLOAD_GRANT_EXPIRY_MINUTES * 60 * 1000;
/** Max unused, unexpired grants per user. Oldest are revoked when exceeded. */
export const MAX_UNUSED_DOWNLOAD_GRANTS_PER_USER = 10;

/** Couch `_id` for a public grant id (`downloadgrant_<uuid>`). */
export const downloadGrantDocId = (grantId: string): string =>
  `${AUTH_RECORD_ID_PREFIXES.downloadgrant}${grantId}`;

/** Public grant id from a Couch `_id` (or the input if it has no prefix). */
export const grantIdFromDocId = (docId: string): string =>
  docId.startsWith(AUTH_RECORD_ID_PREFIXES.downloadgrant)
    ? docId.slice(AUTH_RECORD_ID_PREFIXES.downloadgrant.length)
    : docId;

/** Constant-time string compare for secret hashes. */
const hashesEqual = (left: string, right: string): boolean => {
  const a = Buffer.from(left, 'utf8');
  const b = Buffer.from(right, 'utf8');
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(
    new Uint8Array(a.buffer, a.byteOffset, a.byteLength),
    new Uint8Array(b.buffer, b.byteOffset, b.byteLength)
  );
};

/**
 * Fields copied onto a new grant (plus generated id, secret hash, expiry).
 * Persistable grant metadata only — not documentType / used / secretHash /
 * timestamps, which this module assigns.
 */
export type CreateDownloadGrantInput = Omit<
  DownloadGrantFields,
  | 'documentType'
  | 'used'
  | 'secretHash'
  | 'expiryTimestampMs'
  | 'createdTimestampMs'
>;

/**
 * Load a download grant by public id.
 * @returns The grant document, or null when missing / not a grant.
 */
export const getDownloadGrant = async (
  grantId: string
): Promise<DownloadGrantExistingDocument | null> => {
  const authDB = getAuthDB();
  try {
    const doc = await authDB.get<DownloadGrantExistingDocument>(
      downloadGrantDocId(grantId)
    );
    if (doc.documentType !== 'downloadgrant') {
      return null;
    }
    return doc;
  } catch (err: unknown) {
    const status = (err as {status?: number}).status;
    if (status === 404) {
      return null;
    }
    throw err;
  }
};

/**
 * All download grants for a user (used, unused, and expired).
 * @param userId Owner user id.
 */
export const listDownloadGrantsForUser = async (
  userId: string
): Promise<DownloadGrantExistingDocument[]> => {
  const authDB = getAuthDB();
  const result = await authDB.query<DownloadGrantExistingDocument>(
    'viewsDocument/downloadGrantsByUserId',
    {key: userId, include_docs: true}
  );
  return result.rows
    .map(row => row.doc)
    .filter((doc): doc is DownloadGrantExistingDocument => {
      return !!doc && doc.documentType === 'downloadgrant';
    });
};

/**
 * Compare-and-swap `used: true`. A 409 means another consume/revoke won.
 */
const markGrantUsed = async (
  grant: DownloadGrantExistingDocument
): Promise<void> => {
  const authDB = getAuthDB();
  try {
    await authDB.put({...grant, used: true});
  } catch (err: unknown) {
    const status = (err as {status?: number}).status;
    if (status === 409) {
      throw new InternalSystemError('Download grant already used.');
    }
    throw err;
  }
};

/**
 * Mark every unused, unexpired grant for a user as used (logout / disable).
 * @returns Number of grants newly marked used.
 */
export const revokeUnusedGrantsForUser = async (
  userId: string
): Promise<number> => {
  const grants = await listDownloadGrantsForUser(userId);
  const now = nowMs();
  let revoked = 0;
  for (const grant of grants) {
    if (grant.used || grant.expiryTimestampMs < now) {
      continue;
    }
    try {
      await markGrantUsed(grant);
      revoked += 1;
    } catch {
      // Concurrent consume/revoke is fine — grant is no longer unused.
    }
  }
  return revoked;
};

/**
 * Revoke oldest unused grants so minting one more stays within
 * {@link MAX_UNUSED_DOWNLOAD_GRANTS_PER_USER}.
 */
const enforceUnusedGrantCap = async (userId: string): Promise<void> => {
  const grants = await listDownloadGrantsForUser(userId);
  const now = nowMs();
  const unused = grants
    .filter(g => !g.used && g.expiryTimestampMs >= now)
    .sort((a, b) => a.createdTimestampMs - b.createdTimestampMs);

  const overflow = unused.length - (MAX_UNUSED_DOWNLOAD_GRANTS_PER_USER - 1);
  if (overflow <= 0) {
    return;
  }
  for (const grant of unused.slice(0, overflow)) {
    try {
      await markGrantUsed(grant);
    } catch {
      // Ignore races with consume.
    }
  }
};

/**
 * Persist a new unused grant. Only the SHA-256 of `secret` is stored.
 * @returns Public grant id and the plaintext cookie secret (set, never logged).
 */
export const createDownloadGrant = async (
  input: CreateDownloadGrantInput
): Promise<{grantId: string; secret: string}> => {
  await enforceUnusedGrantCap(input.userId);

  const grantId = crypto.randomUUID();
  const secret = crypto.randomBytes(32).toString('hex');
  const createdTimestampMs = nowMs();
  const fields: DownloadGrantFields = {
    documentType: 'downloadgrant',
    userId: input.userId,
    projectID: input.projectID,
    format: input.format,
    used: false,
    secretHash: hashChallengeCode(secret),
    createdTimestampMs,
    expiryTimestampMs: expiryMsFromNow(DOWNLOAD_GRANT_EXPIRY_MS),
    ...(input.viewID !== undefined ? {viewID: input.viewID} : {}),
    ...(input.fullConfig !== undefined ? {fullConfig: input.fullConfig} : {}),
    ...(input.updatedAfter !== undefined
      ? {updatedAfter: input.updatedAfter}
      : {}),
    ...(input.updatedBefore !== undefined
      ? {updatedBefore: input.updatedBefore}
      : {}),
    ...(input.impersonatingUserId !== undefined
      ? {impersonatingUserId: input.impersonatingUserId}
      : {}),
  };

  const authDB = getAuthDB();
  await authDB.put({_id: downloadGrantDocId(grantId), ...fields});
  return {grantId, secret};
};

/** Result of a consume attempt. `reason` is safe to put on an audit line. */
export type ConsumeDownloadGrantResult =
  | {ok: true; grant: DownloadGrantExistingDocument}
  | {ok: false; reason: 'invalid' | 'used' | 'expired'};

/**
 * Load and consume a grant. When `cookieSecret` is provided, the hash must
 * match. Bearer-path callers omit the secret (ownership is checked by the route).
 *
 * Consume is compare-and-swap: a 409 is treated as already used.
 */
export const consumeDownloadGrant = async ({
  grantId,
  cookieSecret,
}: {
  grantId: string;
  cookieSecret?: string;
}): Promise<ConsumeDownloadGrantResult> => {
  const grant = await getDownloadGrant(grantId);
  if (!grant) {
    return {ok: false, reason: 'invalid'};
  }
  if (grant.used) {
    return {ok: false, reason: 'used'};
  }
  if (grant.expiryTimestampMs < nowMs()) {
    return {ok: false, reason: 'expired'};
  }
  if (cookieSecret !== undefined) {
    if (!hashesEqual(grant.secretHash, hashChallengeCode(cookieSecret))) {
      return {ok: false, reason: 'invalid'};
    }
  }

  try {
    await markGrantUsed(grant);
  } catch (err: unknown) {
    if (
      err instanceof InternalSystemError &&
      err.message === 'Download grant already used.'
    ) {
      return {ok: false, reason: 'used'};
    }
    throw err;
  }

  return {ok: true, grant: {...grant, used: true}};
};

/** Whether `cookieSecret` hashes to the grant's stored `secretHash`. */
export const verifyDownloadGrantCookieSecret = (
  grant: DownloadGrantExistingDocument,
  cookieSecret: string
): boolean => hashesEqual(grant.secretHash, hashChallengeCode(cookieSecret));
