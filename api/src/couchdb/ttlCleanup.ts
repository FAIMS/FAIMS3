/**
 * TTL cleanup for ephemeral auth / invite CouchDB documents.
 *
 * Deletes expired refresh tokens, email codes, verification challenges,
 * invites, and (optionally) long-lived tokens after retention windows that
 * preserve auth rate-limiting. Never touches people, projects, data-*, or
 * survey tombstones.
 *
 * Pure retention predicates are exported for unit tests; {@link runTtlCleanup}
 * performs the paginated sweep + bulkDocs deletes.
 */

import {
  AUTH_RECORD_ID_PREFIXES,
  DatabaseInterface,
  EmailCodeExistingDocument,
  ExistingInvitesDBDocument,
  LongLivedTokenExistingDocument,
  RefreshRecordExistingDocument,
  VerificationChallengeExistingDocument,
} from '@faims3/data-model';
import {compactCouchDatabase, getAuthDB, getInvitesDB} from '.';
import {
  EMAIL_CODE_COOLDOWN_MS,
  EMAIL_CODE_RATE_LIMIT_WINDOW_MS,
} from './emailReset';
import {
  VERIFICATION_COOLDOWN_MS,
  VERIFICATION_RATE_LIMIT_WINDOW_MS,
} from './verificationChallenges';

// Defaults
export const DEFAULT_REFRESH_GRACE_MS = 24 * 60 * 60 * 1000; // 1 day
export const DEFAULT_RATE_LIMIT_GRACE_MS = 60 * 60 * 1000; // 1 hour
export const DEFAULT_INVITE_GRACE_MS = 0;
export const DEFAULT_LONG_LIVED_AUDIT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const DEFAULT_BATCH_SIZE = 100;
export const DEFAULT_ERROR_THRESHOLD = 0;

export type TtlDocType =
  | 'refresh'
  | 'emailcode'
  | 'verification'
  | 'invite'
  | 'longlived';

export type TtlTypeStats = {
  scanned: number;
  deleted: number;
  skipped: number;
  errors: number;
};

export type TtlCleanupStats = Record<TtlDocType, TtlTypeStats>;

export type TtlCleanupOptions = {
  dryRun?: boolean;
  compact?: boolean;
  includeLongLived?: boolean;
  /** Grace after refresh expiry (and override for invite grace when set via CLI). */
  refreshGraceMs?: number;
  /** Extra grace on top of email/verification rate-limit retention. */
  rateLimitGraceMs?: number;
  inviteGraceMs?: number;
  /**
   * Also delete non-expired invites that have exhausted capped uses.
   * Default false — exhausted invites may still be useful if uses are raised later.
   */
  deleteExhaustedInvites?: boolean;
  longLivedAuditRetentionMs?: number;
  batchSize?: number;
  /** Exit non-zero when errors exceed this (default 0 → any error fails). */
  errorThreshold?: number;
  nowMs?: number;
  log?: (message: string) => void;
};

export type TtlCleanupResult = {
  dryRun: boolean;
  durationMs: number;
  stats: TtlCleanupStats;
  compacted: string[];
  success: boolean;
};

const emptyStats = (): TtlCleanupStats => ({
  refresh: {scanned: 0, deleted: 0, skipped: 0, errors: 0},
  emailcode: {scanned: 0, deleted: 0, skipped: 0, errors: 0},
  verification: {scanned: 0, deleted: 0, skipped: 0, errors: 0},
  invite: {scanned: 0, deleted: 0, skipped: 0, errors: 0},
  longlived: {scanned: 0, deleted: 0, skipped: 0, errors: 0},
});

type DeletableDoc = {_id: string; _rev: string};

const isAuthPrefixMatch = (
  id: string,
  documentType: keyof typeof AUTH_RECORD_ID_PREFIXES
): boolean => id.startsWith(AUTH_RECORD_ID_PREFIXES[documentType]);

/** Retention age for email codes: rate-limit window + cooldown (+ grace). */
export const emailCodeRetentionMs = (graceMs = DEFAULT_RATE_LIMIT_GRACE_MS) =>
  EMAIL_CODE_RATE_LIMIT_WINDOW_MS + EMAIL_CODE_COOLDOWN_MS + graceMs;

/** Retention age for verification challenges: window + cooldown (+ grace). */
export const verificationRetentionMs = (
  graceMs = DEFAULT_RATE_LIMIT_GRACE_MS
) => VERIFICATION_RATE_LIMIT_WINDOW_MS + VERIFICATION_COOLDOWN_MS + graceMs;

/**
 * Refresh tokens: delete when expiry is older than now - grace.
 * Disabled tokens follow the same expiry+grace rule (no separate disabledAt).
 */
export const shouldDeleteRefreshToken = (
  doc: Pick<
    RefreshRecordExistingDocument,
    '_id' | 'documentType' | 'expiryTimestampMs' | 'enabled'
  >,
  nowMs: number,
  graceMs = DEFAULT_REFRESH_GRACE_MS
): boolean => {
  if (doc.documentType !== 'refresh') return false;
  if (!isAuthPrefixMatch(doc._id, 'refresh')) return false;
  return doc.expiryTimestampMs < nowMs - graceMs;
};

/**
 * Email codes: retain through the rate-limit window + cooldown (+ grace),
 * measured from createdTimestampMs (fallback: expiryTimestampMs). Not deleted
 * at code expiry alone — used codes are kept until retention elapses.
 */
export const shouldDeleteEmailCode = (
  doc: Pick<
    EmailCodeExistingDocument,
    '_id' | 'documentType' | 'createdTimestampMs' | 'expiryTimestampMs' | 'used'
  >,
  nowMs: number,
  graceMs = DEFAULT_RATE_LIMIT_GRACE_MS
): boolean => {
  if (doc.documentType !== 'emailcode') return false;
  if (!isAuthPrefixMatch(doc._id, 'emailcode')) return false;
  const anchor =
    typeof doc.createdTimestampMs === 'number'
      ? doc.createdTimestampMs
      : doc.expiryTimestampMs;
  return anchor < nowMs - emailCodeRetentionMs(graceMs);
};

/**
 * Verification challenges: same retention model as email codes with
 * verification window + cooldown constants.
 */
export const shouldDeleteVerificationChallenge = (
  doc: Pick<
    VerificationChallengeExistingDocument,
    '_id' | 'documentType' | 'createdTimestampMs' | 'expiryTimestampMs' | 'used'
  >,
  nowMs: number,
  graceMs = DEFAULT_RATE_LIMIT_GRACE_MS
): boolean => {
  if (doc.documentType !== 'verification') return false;
  if (!isAuthPrefixMatch(doc._id, 'verification')) return false;
  const anchor =
    typeof doc.createdTimestampMs === 'number'
      ? doc.createdTimestampMs
      : doc.expiryTimestampMs;
  return anchor < nowMs - verificationRetentionMs(graceMs);
};

/**
 * Invites: delete when expiry is past (plus optional grace). Optionally also
 * delete non-expired invites when uses are capped and exhausted (opt-in;
 * default keeps them so uses can be raised later).
 */
export const shouldDeleteInvite = (
  doc: Pick<
    ExistingInvitesDBDocument,
    '_id' | 'expiry' | 'usesOriginal' | 'usesConsumed'
  >,
  nowMs: number,
  {
    graceMs = DEFAULT_INVITE_GRACE_MS,
    deleteExhausted = false,
  }: {graceMs?: number; deleteExhausted?: boolean} = {}
): boolean => {
  if (typeof doc.expiry === 'number' && doc.expiry < nowMs - graceMs) {
    return true;
  }
  if (
    deleteExhausted &&
    typeof doc.usesOriginal === 'number' &&
    doc.usesOriginal > 0 &&
    doc.usesConsumed >= doc.usesOriginal
  ) {
    return true;
  }
  return false;
};

/**
 * Long-lived tokens: never delete enabled, non-expired tokens (including
 * never-expiring ones). Revoked (`enabled === false`) or past-expiry tokens
 * are kept for `auditRetentionMs` (default 30 days) so revocation/expiry
 * remains auditable, then deleted.
 *
 * The audit clock (`auditAnchor`) starts at:
 * - revoked: `updatedTimestampMs` (when it was disabled), falling back to
 *   `createdTimestampMs`
 * - expired but not revoked: `expiryTimestampMs`, then `updatedTimestampMs`,
 *   then `createdTimestampMs`
 */
export const shouldDeleteLongLivedToken = (
  doc: Pick<
    LongLivedTokenExistingDocument,
    | '_id'
    | 'documentType'
    | 'enabled'
    | 'expiryTimestampMs'
    | 'updatedTimestampMs'
    | 'createdTimestampMs'
  >,
  nowMs: number,
  auditRetentionMs = DEFAULT_LONG_LIVED_AUDIT_RETENTION_MS
): boolean => {
  if (doc.documentType !== 'longlived') return false;
  if (!isAuthPrefixMatch(doc._id, 'longlived')) return false;

  const expired =
    typeof doc.expiryTimestampMs === 'number' && doc.expiryTimestampMs < nowMs;
  const revoked = doc.enabled === false;

  // Active, non-expired (including never-expiring) tokens are never deleted.
  if (doc.enabled && !expired) return false;
  if (!revoked && !expired) return false;

  const auditAnchor = revoked
    ? (doc.updatedTimestampMs ?? doc.createdTimestampMs)
    : (doc.expiryTimestampMs ??
      doc.updatedTimestampMs ??
      doc.createdTimestampMs);

  return auditAnchor < nowMs - auditRetentionMs;
};

type StartkeyPage<T> = {
  /** Docs after source-specific filtering (e.g. drop `_design/*`). */
  docs: T[];
  /** Last raw CouchDB row id; used to advance past filtered-only pages. */
  lastRawId?: string;
  /** Raw rows returned this fetch (for the page-full check). */
  fetchedCount: number;
};

/**
 * Inclusive-startkey pagination shared by auth views and invites `allDocs`.
 *
 * CouchDB `startkey` is inclusive, so after the first page we request
 * `batchSize + 1` (+ `overFetch`) and drop the previous page's last id — but
 * only when that id is still the first row. Concurrent deletes can remove
 * that id from the view between pages; CouchDB then already starts at the
 * next live key, and a blind skip would drop a live document.
 *
 * When the fetch callback filters rows (e.g. `_design/*`), `overFetch` and
 * `lastRawId` keep us from stalling on filtered-only pages or dropping a
 * local tail after capping to `batchSize`.
 */
async function* paginateByStartkey<T extends {_id?: string}>(
  batchSize: number,
  fetchPage: (opts: {
    startkey?: string;
    limit: number;
  }) => Promise<StartkeyPage<T>>,
  {overFetch = 0}: {overFetch?: number} = {}
): AsyncGenerator<T[]> {
  let startkey: string | undefined;
  let skipFirst = false;
  let hasMore = true;

  while (hasMore) {
    const fetchLimit = batchSize + (skipFirst ? 1 : 0) + overFetch;
    const {
      docs: fetched,
      lastRawId,
      fetchedCount,
    } = await fetchPage({
      startkey,
      limit: fetchLimit,
    });
    const pageFull = fetchedCount >= fetchLimit;

    let docs = fetched;
    // Only drop the startkey row when it is still present. Deletes between
    // pages remove the previous page's last id from the view, so CouchDB's
    // next page already starts at the next live key — blind skip would drop it.
    if (skipFirst && docs.length > 0 && docs[0]._id === startkey) {
      docs = docs.slice(1);
    }

    if (docs.length === 0) {
      // Empty after filter (e.g. design-doc-only page): skip past last raw id
      // when CouchDB may still have rows, otherwise we are done.
      if (pageFull && lastRawId) {
        startkey = lastRawId;
        skipFirst = true;
      } else {
        hasMore = false;
      }
      continue;
    }

    const chunk = docs.slice(0, batchSize);
    yield chunk;
    const lastId = chunk[chunk.length - 1]._id;
    // Continue when leftover filtered docs remain locally, or CouchDB may
    // have more rows. Stopping on short pages alone permanently skips the
    // remainder of `docs` after the first batchSize chunk.
    if (lastId && (docs.length > batchSize || pageFull)) {
      startkey = lastId;
      skipFirst = true;
    } else {
      hasMore = false;
    }
  }
}

/** Page an auth-DB view by `_id` startkey. See {@link paginateByStartkey}. */
async function* paginateAuthView<T extends {_id?: string}>(
  viewName: string,
  batchSize: number
): AsyncGenerator<T[]> {
  const authDB = getAuthDB();
  yield* paginateByStartkey(batchSize, async ({startkey, limit}) => {
    const opts: PouchDB.Query.Options<any, any> = {
      include_docs: true,
      limit,
    };
    if (startkey !== undefined) {
      opts.startkey = startkey;
    }
    const result = await authDB.query<T>(viewName, opts);
    const docs = result.rows.filter(r => !!r.doc).map(r => r.doc as T);
    return {
      docs,
      lastRawId: result.rows[result.rows.length - 1]?.id,
      fetchedCount: result.rows.length,
    };
  });
}

/**
 * Page the invites DB via `allDocs` (no type-specific view). Over-fetches so
 * filtering `_design/*` still yields a full batch. See {@link paginateByStartkey}.
 */
async function* paginateInvitesAllDocs(
  batchSize: number
): AsyncGenerator<ExistingInvitesDBDocument[]> {
  const invitesDB = getInvitesDB();
  yield* paginateByStartkey(
    batchSize,
    async ({startkey, limit}) => {
      const opts: Record<string, unknown> = {
        include_docs: true,
        limit,
      };
      if (startkey !== undefined) {
        opts.startkey = startkey;
      }
      const result = await invitesDB.allDocs(opts as any);
      const rawRows = result.rows.filter(r => !!r.doc);
      const docs = rawRows
        .filter(r => !r.id.startsWith('_design/'))
        .map(r => r.doc as ExistingInvitesDBDocument);
      return {
        docs,
        lastRawId: rawRows[rawRows.length - 1]?.id,
        fetchedCount: rawRows.length,
      };
    },
    {overFetch: 10}
  );
}

const bulkDelete = async (
  db: DatabaseInterface,
  docs: DeletableDoc[],
  dryRun: boolean
): Promise<{deleted: number; errors: number}> => {
  if (docs.length === 0) {
    return {deleted: 0, errors: 0};
  }
  if (dryRun) {
    return {deleted: docs.length, errors: 0};
  }

  const payload = docs.map(d => ({_id: d._id, _rev: d._rev, _deleted: true}));
  const results = await db.bulkDocs(payload);

  let deleted = 0;
  let errors = 0;
  for (const r of results) {
    if ('error' in r && r.error) {
      // Already gone / conflict: treat as non-fatal skip for idempotency
      if (r.status === 404 || r.name === 'not_found' || r.status === 409) {
        continue;
      }
      errors += 1;
    } else {
      deleted += 1;
    }
  }
  return {deleted, errors};
};

const sweepAuthType = async <T extends DeletableDoc>({
  viewName,
  docType,
  shouldDelete,
  stats,
  batchSize,
  dryRun,
}: {
  viewName: string;
  docType: TtlDocType;
  shouldDelete: (doc: T) => boolean;
  stats: TtlCleanupStats;
  batchSize: number;
  dryRun: boolean;
}): Promise<void> => {
  const authDB = getAuthDB();
  const typeStats = stats[docType];

  for await (const batch of paginateAuthView<T>(viewName, batchSize)) {
    typeStats.scanned += batch.length;
    const toDelete: DeletableDoc[] = [];
    for (const doc of batch) {
      if (shouldDelete(doc)) {
        toDelete.push({_id: doc._id, _rev: doc._rev});
      } else {
        typeStats.skipped += 1;
      }
    }
    const {deleted, errors} = await bulkDelete(authDB, toDelete, dryRun);
    typeStats.deleted += deleted;
    typeStats.errors += errors;
  }
};

const sweepInvites = async ({
  stats,
  batchSize,
  dryRun,
  shouldDelete,
}: {
  stats: TtlCleanupStats;
  batchSize: number;
  dryRun: boolean;
  shouldDelete: (doc: ExistingInvitesDBDocument) => boolean;
}): Promise<void> => {
  const invitesDB = getInvitesDB();
  const typeStats = stats.invite;

  for await (const batch of paginateInvitesAllDocs(batchSize)) {
    typeStats.scanned += batch.length;
    const toDelete: DeletableDoc[] = [];
    for (const doc of batch) {
      if (shouldDelete(doc)) {
        toDelete.push({_id: doc._id, _rev: doc._rev});
      } else {
        typeStats.skipped += 1;
      }
    }
    const {deleted, errors} = await bulkDelete(invitesDB, toDelete, dryRun);
    typeStats.deleted += deleted;
    typeStats.errors += errors;
  }
};

/**
 * Run the full TTL cleanup sweep against auth + invites DBs.
 */
export const runTtlCleanup = async (
  options: TtlCleanupOptions = {}
): Promise<TtlCleanupResult> => {
  const dryRun = options.dryRun ?? false;
  const compact = options.compact ?? false;
  const includeLongLived = options.includeLongLived ?? false;
  const refreshGraceMs = options.refreshGraceMs ?? DEFAULT_REFRESH_GRACE_MS;
  const rateLimitGraceMs =
    options.rateLimitGraceMs ?? DEFAULT_RATE_LIMIT_GRACE_MS;
  const inviteGraceMs = options.inviteGraceMs ?? DEFAULT_INVITE_GRACE_MS;
  const deleteExhaustedInvites = options.deleteExhaustedInvites ?? false;
  const longLivedAuditRetentionMs =
    options.longLivedAuditRetentionMs ?? DEFAULT_LONG_LIVED_AUDIT_RETENTION_MS;
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const errorThreshold = options.errorThreshold ?? DEFAULT_ERROR_THRESHOLD;
  const nowMs = options.nowMs ?? Date.now();
  const log = options.log ?? ((msg: string) => console.log(msg));

  const started = Date.now();
  const stats = emptyStats();
  const compacted: string[] = [];

  log(
    `TTL cleanup starting (dryRun=${dryRun}, compact=${compact}, includeLongLived=${includeLongLived}, now=${new Date(nowMs).toISOString()})`
  );

  // 1. Refresh tokens
  await sweepAuthType<RefreshRecordExistingDocument>({
    viewName: 'viewsDocument/refreshTokens',
    docType: 'refresh',
    shouldDelete: doc => shouldDeleteRefreshToken(doc, nowMs, refreshGraceMs),
    stats,
    batchSize,
    dryRun,
  });

  // 2. Email codes (rate-limit retention)
  await sweepAuthType<EmailCodeExistingDocument>({
    viewName: 'viewsDocument/emailCodes',
    docType: 'emailcode',
    shouldDelete: doc => shouldDeleteEmailCode(doc, nowMs, rateLimitGraceMs),
    stats,
    batchSize,
    dryRun,
  });

  // 3. Verification challenges (rate-limit retention)
  await sweepAuthType<VerificationChallengeExistingDocument>({
    viewName: 'viewsDocument/verificationChallenges',
    docType: 'verification',
    shouldDelete: doc =>
      shouldDeleteVerificationChallenge(doc, nowMs, rateLimitGraceMs),
    stats,
    batchSize,
    dryRun,
  });

  // 4. Invites
  await sweepInvites({
    stats,
    batchSize,
    dryRun,
    shouldDelete: doc =>
      shouldDeleteInvite(doc, nowMs, {
        graceMs: inviteGraceMs,
        deleteExhausted: deleteExhaustedInvites,
      }),
  });

  // 5. Long-lived (optional)
  if (includeLongLived) {
    await sweepAuthType<LongLivedTokenExistingDocument>({
      viewName: 'viewsDocument/longLivedTokens',
      docType: 'longlived',
      shouldDelete: doc =>
        shouldDeleteLongLivedToken(doc, nowMs, longLivedAuditRetentionMs),
      stats,
      batchSize,
      dryRun,
    });
  }

  // Compaction only after successful deletes (not dry-run)
  if (compact && !dryRun) {
    const totalErrors = Object.values(stats).reduce((n, s) => n + s.errors, 0);
    if (totalErrors === 0) {
      for (const dbName of ['auth', 'invites'] as const) {
        try {
          log(`Compacting ${dbName}...`);
          await compactCouchDatabase(dbName);
          compacted.push(dbName);
        } catch (err) {
          log(`Compaction failed for ${dbName}: ${(err as Error).message}`);
          stats.refresh.errors += 1; // attribute to overall error count
        }
      }
    } else {
      log('Skipping compaction due to delete errors.');
    }
  }

  const durationMs = Date.now() - started;
  const totalErrors = Object.values(stats).reduce((n, s) => n + s.errors, 0);
  const success = totalErrors <= errorThreshold;

  for (const [type, s] of Object.entries(stats)) {
    if (
      type === 'longlived' &&
      !includeLongLived &&
      s.scanned === 0 &&
      s.deleted === 0
    ) {
      continue;
    }
    log(
      `  ${type}: scanned=${s.scanned} deleted=${s.deleted} skipped=${s.skipped} errors=${s.errors}`
    );
  }
  log(
    `TTL cleanup finished in ${durationMs}ms (success=${success}${compacted.length ? `, compacted=${compacted.join(',')}` : ''})`
  );

  return {dryRun, durationMs, stats, compacted, success};
};
