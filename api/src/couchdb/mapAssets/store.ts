// SPDX-License-Identifier: Apache-2.0
/**
 * mapAssets documents, links, and the survey listing manifest.
 */

import {
  buildContextualLayersHash,
  companionAttachmentName,
  ContextualLayerListing,
  DEFAULT_MAP_ASSET_STYLE,
  ExistingMapAsset,
  ExistingMapAssetLink,
  MAP_ASSET_DOC_TYPE,
  MAP_ASSET_LINK_DOC_TYPE,
  MAP_ASSET_LINKS_BY_ASSET,
  MAP_ASSET_LINKS_BY_PROJECT,
  MAP_ASSET_NORMALIZED_ATTACHMENT,
  MAP_ASSET_ORIGINAL_ATTACHMENT,
  normalizedMapAssetExtension,
  normalizedMapAssetMediaType,
  MAP_ASSETS_BY_CREATOR,
  MAP_ASSETS_BY_STATUS,
  MAP_ASSETS_BY_TEAM,
  MapAssetFields,
  MapAssetLinkFields,
  GetMapAssetDownloadUrlResponse,
  isMapAssetInProgress,
  MapAssetStatus,
  MapAssetStyle,
  StoredAttachmentLocation,
} from '@faims3/data-model';
import {randomUUID} from 'crypto';
import {rm} from 'fs/promises';
import {getMapAssetsDB} from '..';
import * as Exceptions from '../../exceptions';
import {
  logMapAssetProcessing,
  MAP_ASSET_PROCESSING_LOG,
  withMapAssetProcessingWait,
} from '../../logging';
import {
  assetHasStoredAttachment,
  collectStream,
  deleteStoredAttachment,
  downloadAttachmentStream,
  presignAttachmentDownload,
  downloadAttachmentToFile,
  putBytesAttachment,
  putFileAttachment,
  sha256,
  sha256File,
  storedAttachmentLocation,
} from './attachments';
import {normalizeMapUpload, UploadedMapFile} from './normalize';
import {
  cleanupStaging,
  ensureStagingPaths,
  readStagedFiles,
  stageUploadFiles,
} from './staging';

export {sha256} from './attachments';

function isAsset(doc: {
  _id?: string;
  docType?: string;
}): doc is ExistingMapAsset {
  return doc.docType === MAP_ASSET_DOC_TYPE;
}

function isLink(doc: {docType?: string}): doc is ExistingMapAssetLink {
  return doc.docType === MAP_ASSET_LINK_DOC_TYPE;
}

export async function getMapAsset(assetId: string): Promise<ExistingMapAsset> {
  try {
    const doc = await getMapAssetsDB().get(assetId);
    if (!isAsset(doc)) {
      throw new Exceptions.ItemNotFoundException(
        `Map asset ${assetId} was not found.`
      );
    }
    return doc;
  } catch (error) {
    if (error instanceof Exceptions.ItemNotFoundException) {
      throw error;
    }
    const status = (error as {status?: number}).status;
    if (status === 404) {
      throw new Exceptions.ItemNotFoundException(
        `Map asset ${assetId} was not found.`
      );
    }
    throw error;
  }
}

async function queryIds(view: string, key: string): Promise<string[]> {
  const result = await getMapAssetsDB().query<number | string>(view, {
    key,
    include_docs: false,
  });
  return result.rows
    .map(row => row.id)
    .filter((id): id is string => Boolean(id));
}

export async function listAssetsByTeam(
  teamId: string
): Promise<ExistingMapAsset[]> {
  const ids = await queryIds(MAP_ASSETS_BY_TEAM, teamId);
  return loadAssets(ids);
}

export async function listAssetsByCreator(
  userId: string
): Promise<ExistingMapAsset[]> {
  const ids = await queryIds(MAP_ASSETS_BY_CREATOR, userId);
  return loadAssets(ids);
}

async function loadAssets(ids: string[]): Promise<ExistingMapAsset[]> {
  const assets: ExistingMapAsset[] = [];
  for (const id of ids) {
    try {
      assets.push(await getMapAsset(id));
    } catch (error) {
      if (!(error instanceof Exceptions.ItemNotFoundException)) {
        throw error;
      }
    }
  }
  return assets;
}

export async function listLinkProjectIds(assetId: string): Promise<string[]> {
  const result = await getMapAssetsDB().query<string>(
    MAP_ASSET_LINKS_BY_ASSET,
    {
      key: assetId,
      include_docs: false,
    }
  );
  return result.rows
    .map(row => row.value)
    .filter((value): value is string => typeof value === 'string');
}

export async function listLinkAssetIds(projectId: string): Promise<string[]> {
  const result = await getMapAssetsDB().query<string>(
    MAP_ASSET_LINKS_BY_PROJECT,
    {key: projectId, include_docs: false}
  );
  return result.rows
    .map(row => row.value)
    .filter((value): value is string => typeof value === 'string');
}

export function linkDocumentId(assetId: string, projectId: string): string {
  return `link-${assetId}-${projectId}`;
}

async function putOriginalFilesFromDisk({
  assetId,
  files,
  primaryFilename,
}: {
  assetId: string;
  files: UploadedMapFile[];
  primaryFilename: string;
}): Promise<Record<string, StoredAttachmentLocation>> {
  return withMapAssetProcessingWait(
    {
      event: 'processing.originals.store',
      assetId,
      filename: primaryFilename,
      fileCount: files.length,
      filenames: files.map(file => file.filename),
      byteSize: files.reduce(
        (sum, file) => sum + (file.size ?? file.bytes?.length ?? 0),
        0
      ),
    },
    async () => {
      const locations: Record<string, StoredAttachmentLocation> = {};
      const primary =
        files.find(file => file.filename === primaryFilename) ?? files[0];
      if (!primary.diskPath) {
        throw new Error(`Upload is missing data for ${primary.filename}.`);
      }
      locations[MAP_ASSET_ORIGINAL_ATTACHMENT] = await putFileAttachment({
        assetId,
        attachmentId: MAP_ASSET_ORIGINAL_ATTACHMENT,
        filePath: primary.diskPath,
        contentType: 'application/octet-stream',
      });
      for (const file of files) {
        if (file.filename === primary.filename) {
          continue;
        }
        if (!file.diskPath) {
          throw new Error(`Upload is missing data for ${file.filename}.`);
        }
        const attachmentId = companionAttachmentName(file.filename);
        locations[attachmentId] = await putFileAttachment({
          assetId,
          attachmentId,
          filePath: file.diskPath,
          contentType: 'application/octet-stream',
        });
      }
      return locations;
    }
  );
}

async function mergeStoredAttachments(
  assetId: string,
  locations: Record<string, StoredAttachmentLocation>,
  claimStartedAt?: number
): Promise<void> {
  const db = getMapAssetsDB();
  for (let attempt = 0; attempt < PROCESSING_CLAIM_RETRIES; attempt++) {
    const latest = await getMapAsset(assetId);
    if (
      claimStartedAt !== undefined &&
      (latest.status !== 'processing' ||
        latest.processingStartedAt !== claimStartedAt)
    ) {
      return;
    }
    try {
      await db.put(
        omitUndefinedFields({
          ...latest,
          storedAttachments: {
            ...(latest.storedAttachments ?? {}),
            ...locations,
          },
          updatedAt: Date.now(),
        })
      );
      return;
    } catch (error) {
      if (!isConflict(error)) {
        throw error;
      }
    }
  }
  throw new Error(`Could not save map layer storage metadata for ${assetId}.`);
}

async function deleteUnreferencedAttachments(
  previous: Record<string, StoredAttachmentLocation> | undefined,
  next: Record<string, StoredAttachmentLocation>
): Promise<void> {
  if (!previous) {
    return;
  }
  for (const [attachmentId, location] of Object.entries(previous)) {
    const replacement = next[attachmentId];
    if (replacement && replacement.resourceUri === location.resourceUri) {
      continue;
    }
    await deleteStoredAttachment(location).catch(() => undefined);
  }
}

export async function createMapAsset({
  name,
  description,
  ownedByTeamId,
  createdBy,
  files,
  primaryFilename,
  style,
}: {
  name: string;
  description: string;
  ownedByTeamId?: string;
  createdBy: string;
  files: UploadedMapFile[];
  primaryFilename: string;
  style?: MapAssetStyle;
}): Promise<ExistingMapAsset> {
  const db = getMapAssetsDB();
  const now = Date.now();
  const assetId = `asset-${randomUUID()}`;
  const companions = files
    .map(file => file.filename)
    .filter(filename => filename !== primaryFilename);
  const fields: MapAssetFields = {
    docType: MAP_ASSET_DOC_TYPE,
    name,
    description,
    ...(ownedByTeamId ? {ownedByTeamId} : {}),
    createdBy,
    originalFilename: primaryFilename,
    ...(companions.length > 0 ? {companionFilenames: companions} : {}),
    byteSize: 0,
    status: 'pending',
    defaultStyle: style ?? DEFAULT_MAP_ASSET_STYLE,
    createdAt: now,
    updatedAt: now,
  };
  const created = await db.put({_id: assetId, ...fields});
  try {
    await stageUploadFiles(assetId, files);
  } catch (error) {
    await cleanupStaging(assetId);
    try {
      await db.remove(assetId, created.rev);
    } catch {
      // Staging failed; drop the empty asset if we still can.
    }
    throw error;
  }
  return getMapAsset(assetId);
}

export async function updateMapAssetDetails({
  assetId,
  name,
  description,
}: {
  assetId: string;
  name: string;
  description: string;
}): Promise<ExistingMapAsset> {
  const current = await getMapAsset(assetId);
  await getMapAssetsDB().put({
    ...current,
    name,
    description,
    updatedAt: Date.now(),
  });
  return getMapAsset(assetId);
}

export async function replaceMapAssetFiles({
  assetId,
  files,
  primaryFilename,
}: {
  assetId: string;
  files: UploadedMapFile[];
  primaryFilename: string;
}): Promise<ExistingMapAsset> {
  const current = await getMapAsset(assetId);
  if (isMapAssetInProgress(current.status)) {
    throw new Exceptions.InvalidRequestException(
      'This map layer is still being prepared.'
    );
  }
  const companions = files
    .map(file => file.filename)
    .filter(filename => filename !== primaryFilename);
  const previousStored = current.storedAttachments;
  await getMapAssetsDB().put(
    omitUndefinedFields({
      ...current,
      originalFilename: primaryFilename,
      companionFilenames: companions.length > 0 ? companions : undefined,
      storedAttachments: undefined,
      status: 'pending',
      failureReason: undefined,
      contentHash: undefined,
      kind: undefined,
      extent4326: undefined,
      extent3857: undefined,
      minZoom: undefined,
      maxZoom: undefined,
      tileSize: undefined,
      byteSize: 0,
      processingStartedAt: undefined,
      processingAttempts: undefined,
      updatedAt: Date.now(),
    })
  );
  await cleanupStaging(assetId);
  await stageUploadFiles(assetId, files);
  if (previousStored) {
    await Promise.all(
      Object.values(previousStored).map(location =>
        deleteStoredAttachment(location).catch(() => undefined)
      )
    );
  }
  return getMapAsset(assetId);
}

function uploadFilenames(asset: ExistingMapAsset): string[] {
  return [asset.originalFilename, ...(asset.companionFilenames ?? [])];
}

async function downloadOriginalsToStaging(
  asset: ExistingMapAsset
): Promise<UploadedMapFile[] | undefined> {
  if (!assetHasStoredAttachment(asset, MAP_ASSET_ORIGINAL_ATTACHMENT)) {
    return undefined;
  }
  const staged = await ensureStagingPaths(asset._id, uploadFilenames(asset));
  try {
    const primary = staged.find(
      file => file.filename === asset.originalFilename
    );
    if (!primary?.diskPath) {
      return undefined;
    }
    const original = storedAttachmentLocation(
      asset,
      MAP_ASSET_ORIGINAL_ATTACHMENT
    );
    if (!original) {
      return undefined;
    }
    await downloadAttachmentToFile({
      location: original,
      destPath: primary.diskPath,
      assetId: asset._id,
      attachmentId: MAP_ASSET_ORIGINAL_ATTACHMENT,
    });
    for (const filename of asset.companionFilenames ?? []) {
      const file = staged.find(item => item.filename === filename);
      if (!file?.diskPath) {
        continue;
      }
      const companion = storedAttachmentLocation(
        asset,
        companionAttachmentName(filename)
      );
      if (!companion) {
        continue;
      }
      await downloadAttachmentToFile({
        location: companion,
        destPath: file.diskPath,
        assetId: asset._id,
        attachmentId: companionAttachmentName(filename),
      });
    }
  } catch (error) {
    const status =
      (error as {status?: number}).status ??
      (error as {statusCode?: number}).statusCode ??
      (error as {$metadata?: {httpStatusCode?: number}}).$metadata
        ?.httpStatusCode;
    if (status === 404) {
      await cleanupStaging(asset._id);
      return undefined;
    }
    throw error;
  }
  return readStagedFiles(asset._id, uploadFilenames(asset));
}

/**
 * Refresh the claim this often while GDAL runs so a long raster is not
 * treated as abandoned. The worker updates its local claim token to match.
 */
export const MAP_ASSET_PROCESSING_CLAIM_HEARTBEAT_MS = 60 * 1000;
/** A claim older than this may be taken by another worker. */
export const MAP_ASSET_PROCESSING_CLAIM_TIMEOUT_MS = 2 * 60 * 60 * 1000;
/**
 * Claims started for one upload, including the first. A crash after this
 * many claims is marked failed. A GDAL error fails on the current claim.
 */
export const MAP_ASSET_PROCESSING_MAX_ATTEMPTS = 3;
export const MAP_ASSET_PROCESSING_SWEEP_INTERVAL_MS = 60 * 1000;
/**
 * How long a pending asset may sit with no staging files and no
 * originals before the API marks it failed. Staging still on disk is
 * retried instead.
 */
export const MAP_ASSET_ORIGINAL_UPLOAD_GRACE_MS = 2 * 60 * 1000;
export const MAP_ASSET_ORIGINALS_MISSING_REASON =
  'The uploaded map files are no longer available.';
export const MAP_ASSET_PROCESSING_EXHAUSTED_REASON =
  'Map layer processing was interrupted too many times.';

const PROCESSING_CLAIM_RETRIES = 5;

export type MapAssetProcessingRuntime = {
  now?: () => number;
  claimTimeoutMs?: number;
  maxAttempts?: number;
  /** `0` disables the claim heartbeat. Default is 60s. */
  claimHeartbeatMs?: number;
  /** Age before a pending asset with no files is failed. */
  originalUploadGraceMs?: number;
  normalize?: typeof normalizeMapUpload;
};

function processingNow(runtime?: MapAssetProcessingRuntime): number {
  return runtime?.now?.() ?? Date.now();
}

function claimTimeoutMs(runtime?: MapAssetProcessingRuntime): number {
  return runtime?.claimTimeoutMs ?? MAP_ASSET_PROCESSING_CLAIM_TIMEOUT_MS;
}

function maxProcessingAttempts(runtime?: MapAssetProcessingRuntime): number {
  return runtime?.maxAttempts ?? MAP_ASSET_PROCESSING_MAX_ATTEMPTS;
}

function originalUploadGraceMs(runtime?: MapAssetProcessingRuntime): number {
  return runtime?.originalUploadGraceMs ?? MAP_ASSET_ORIGINAL_UPLOAD_GRACE_MS;
}

function claimHeartbeatMs(runtime?: MapAssetProcessingRuntime): number {
  return runtime?.claimHeartbeatMs ?? MAP_ASSET_PROCESSING_CLAIM_HEARTBEAT_MS;
}

/** Latest claim timestamp. Heartbeat and commit share `chain` so they don't race. */
type ClaimToken = {
  current: number;
  chain: Promise<void>;
};

function withClaimToken<T>(
  token: ClaimToken,
  fn: () => Promise<T>
): Promise<T> {
  const run = token.chain.then(fn, fn);
  token.chain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function isConflict(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    (error as {status?: number}).status === 409
  );
}

function omitUndefinedFields<T extends object>(doc: T): T {
  const next = {...doc};
  for (const key of Object.keys(next) as (keyof T)[]) {
    if (next[key] === undefined) {
      delete next[key];
    }
  }
  return next;
}

/**
 * True when a worker may claim this asset: it is `pending`, or `processing`
 * with no live claim (the previous worker died, or a legacy unclaimed job).
 */
export function mapAssetIsClaimable(
  asset: {status: string; processingStartedAt?: number},
  now: number,
  timeoutMs: number = MAP_ASSET_PROCESSING_CLAIM_TIMEOUT_MS
): boolean {
  if (asset.status === 'pending') {
    return true;
  }
  if (asset.status !== 'processing') {
    return false;
  }
  const startedAt = asset.processingStartedAt;
  if (startedAt === undefined || !Number.isFinite(startedAt)) {
    return true;
  }
  return now - startedAt >= timeoutMs;
}

/**
 * Compare-and-swap the claim. Returns the claimed document, or undefined
 * when another process holds a fresh claim, the asset is already finished,
 * or this upload has used its attempts.
 */
async function claimMapAssetProcessing(
  assetId: string,
  runtime?: MapAssetProcessingRuntime
): Promise<ExistingMapAsset | undefined> {
  const db = getMapAssetsDB();
  const now = processingNow(runtime);
  const timeoutMs = claimTimeoutMs(runtime);
  const maxAttempts = maxProcessingAttempts(runtime);

  for (let attempt = 0; attempt < PROCESSING_CLAIM_RETRIES; attempt++) {
    const asset = await getMapAsset(assetId);
    if (!mapAssetIsClaimable(asset, now, timeoutMs)) {
      logMapAssetProcessing({
        event: 'processing.claim',
        outcome: 'skipped',
        assetId,
        filename: asset.originalFilename,
        attempt: asset.processingAttempts,
        reason: isMapAssetInProgress(asset.status)
          ? 'a fresh claim is already held'
          : `status is ${asset.status}`,
      });
      return undefined;
    }
    const attempts = asset.processingAttempts ?? 0;
    if (attempts >= maxAttempts) {
      try {
        await db.put(
          omitUndefinedFields({
            ...asset,
            status: 'failed' as const,
            failureReason: MAP_ASSET_PROCESSING_EXHAUSTED_REASON,
            processingStartedAt: undefined,
            updatedAt: now,
          })
        );
        await cleanupStaging(assetId);
        logMapAssetProcessing({
          event: 'processing.claim',
          outcome: 'failure',
          assetId,
          filename: asset.originalFilename,
          attempt: attempts,
          maxAttempts,
          reason: MAP_ASSET_PROCESSING_EXHAUSTED_REASON,
        });
        return undefined;
      } catch (error) {
        if (isConflict(error)) {
          continue;
        }
        throw error;
      }
    }
    try {
      await db.put({
        ...asset,
        status: 'processing',
        processingStartedAt: now,
        processingAttempts: attempts + 1,
        updatedAt: now,
      });
      logMapAssetProcessing({
        event: 'processing.claim',
        outcome: 'success',
        assetId,
        filename: asset.originalFilename,
        attempt: attempts + 1,
        maxAttempts,
      });
      return getMapAsset(assetId);
    } catch (error) {
      if (isConflict(error)) {
        continue;
      }
      throw error;
    }
  }
  logMapAssetProcessing({
    event: 'processing.claim',
    outcome: 'failure',
    assetId,
    reason: 'could not claim after retries',
  });
  console.error(`${MAP_ASSET_PROCESSING_LOG} could not claim ${assetId}`);
  return undefined;
}

/**
 * Write the terminal status only while this claim still owns the asset.
 * A concurrent run that already reached `ready` or `failed` is left as-is.
 */
async function commitProcessingResult(
  assetId: string,
  claimStartedAt: number,
  build: (asset: ExistingMapAsset) => ExistingMapAsset
): Promise<void> {
  const db = getMapAssetsDB();
  for (let attempt = 0; attempt < PROCESSING_CLAIM_RETRIES; attempt++) {
    const latest = await getMapAsset(assetId);
    if (
      latest.status !== 'processing' ||
      latest.processingStartedAt !== claimStartedAt
    ) {
      return;
    }
    try {
      await db.put(omitUndefinedFields(build(latest)));
      return;
    } catch (error) {
      if (!isConflict(error)) {
        throw error;
      }
    }
  }
  throw new Error(`Could not save map layer processing result for ${assetId}.`);
}

/**
 * Store the normalized file in object storage while this claim still owns
 * the asset. Returns the location, or undefined when another process has
 * taken over or already finished.
 */
async function putNormalizedAttachment({
  assetId,
  claimStartedAt,
  filePath,
  bytes,
  mediaType,
}: {
  assetId: string;
  claimStartedAt: number;
  filePath?: string;
  bytes?: Buffer;
  mediaType: string;
}): Promise<StoredAttachmentLocation | undefined> {
  const latest = await getMapAsset(assetId);
  if (
    latest.status !== 'processing' ||
    latest.processingStartedAt !== claimStartedAt
  ) {
    logMapAssetProcessing({
      event: 'processing.normalized.store',
      outcome: 'skipped',
      assetId,
      reason: 'lost the processing claim before storing the normalized file',
    });
    return undefined;
  }
  if (filePath) {
    return putFileAttachment({
      assetId,
      attachmentId: MAP_ASSET_NORMALIZED_ATTACHMENT,
      filePath,
      contentType: mediaType,
    });
  }
  if (!bytes) {
    throw new Error('Normalized map layer is missing data.');
  }
  return putBytesAttachment({
    assetId,
    attachmentId: MAP_ASSET_NORMALIZED_ATTACHMENT,
    bytes,
    contentType: mediaType,
  });
}

/**
 * Upload staged originals to object storage and drop the local copies.
 * Safe to call more than once. Returns false when there is nothing on disk
 * and originals are not already stored.
 */
export async function storeOriginalsFromStaging(
  assetId: string
): Promise<boolean> {
  const asset = await getMapAsset(assetId);
  if (!isMapAssetInProgress(asset.status)) {
    return false;
  }
  if (assetHasStoredAttachment(asset, MAP_ASSET_ORIGINAL_ATTACHMENT)) {
    await cleanupStaging(assetId);
    return true;
  }
  const staged = await readStagedFiles(assetId, uploadFilenames(asset));
  if (!staged) {
    return false;
  }
  const locations = await putOriginalFilesFromDisk({
    assetId,
    files: staged,
    primaryFilename: asset.originalFilename,
  });
  await mergeStoredAttachments(assetId, locations);
  await cleanupStaging(assetId);
  return true;
}

/** Fire-and-forget original upload after the HTTP handler has responded. */
export function scheduleStoreOriginals(assetId: string): void {
  void storeOriginalsFromStaging(assetId).catch(error => {
    logMapAssetProcessing({
      event: 'processing.originals.store',
      outcome: 'failure',
      assetId,
      reason: error instanceof Error ? error.message : String(error),
    });
    console.error(
      `${MAP_ASSET_PROCESSING_LOG} original upload failed for ${assetId}`,
      error
    );
  });
}

async function refreshClaimToken(
  assetId: string,
  token: ClaimToken,
  runtime?: MapAssetProcessingRuntime
): Promise<boolean> {
  return withClaimToken(token, async () => {
    const latest = await getMapAsset(assetId);
    if (
      latest.status !== 'processing' ||
      latest.processingStartedAt !== token.current
    ) {
      return false;
    }
    const now = processingNow(runtime);
    try {
      await getMapAssetsDB().put({
        ...latest,
        processingStartedAt: now,
        updatedAt: now,
      });
    } catch (error) {
      if (isConflict(error)) {
        return false;
      }
      throw error;
    }
    token.current = now;
    logMapAssetProcessing({
      event: 'processing.claim',
      outcome: 'waiting',
      assetId,
      detail: 'refreshed processing claim',
    });
    return true;
  });
}

function startClaimHeartbeat(
  assetId: string,
  token: ClaimToken,
  runtime?: MapAssetProcessingRuntime
): () => void {
  const intervalMs = claimHeartbeatMs(runtime);
  if (intervalMs <= 0) {
    return () => undefined;
  }
  const timer = setInterval(() => {
    void refreshClaimToken(assetId, token, runtime).catch(error => {
      console.error(
        `${MAP_ASSET_PROCESSING_LOG} claim heartbeat failed for ${assetId}`,
        error
      );
    });
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}

async function loadOriginalFiles(
  asset: ExistingMapAsset
): Promise<UploadedMapFile[]> {
  logMapAssetProcessing({
    event: 'processing.files',
    outcome: 'started',
    assetId: asset._id,
    filename: asset.originalFilename,
    detail: 'downloading originals from object storage',
    source: 'object-storage',
  });
  const downloaded = await downloadOriginalsToStaging(asset);
  if (!downloaded) {
    throw new Error(MAP_ASSET_ORIGINALS_MISSING_REASON);
  }
  logMapAssetProcessing({
    event: 'processing.files',
    outcome: 'success',
    assetId: asset._id,
    filename: asset.originalFilename,
    fileCount: downloaded.length,
    source: 'object-storage',
  });
  return downloaded;
}

/**
 * Claim one pending (or stale processing) asset that already has originals,
 * run GDAL, and store the PMTiles. Sets `status` to `processing` for the
 * duration of the claim. Does not upload originals and does not claim a
 * job that lacks them. Another worker's fresh claim is left alone.
 */
export async function processMapAsset(
  assetId: string,
  runtime?: MapAssetProcessingRuntime
): Promise<void> {
  const existing = await getMapAsset(assetId);
  if (!isMapAssetInProgress(existing.status)) {
    return;
  }
  if (!assetHasStoredAttachment(existing, MAP_ASSET_ORIGINAL_ATTACHMENT)) {
    logMapAssetProcessing({
      event: 'processing.run',
      outcome: 'skipped',
      assetId,
      filename: existing.originalFilename,
      reason: 'originals are not in object storage yet',
    });
    return;
  }
  const claimed = await claimMapAssetProcessing(assetId, runtime);
  const claimStartedAt = claimed?.processingStartedAt;
  if (!claimed || claimStartedAt === undefined) {
    return;
  }
  const token: ClaimToken = {
    current: claimStartedAt,
    chain: Promise.resolve(),
  };
  const stopHeartbeat = startClaimHeartbeat(assetId, token, runtime);
  const runStarted = Date.now();
  logMapAssetProcessing({
    event: 'processing.run',
    outcome: 'started',
    assetId,
    filename: claimed.originalFilename,
    attempt: claimed.processingAttempts,
    userId: claimed.createdBy,
    teamId: claimed.ownedByTeamId,
  });
  let cleanupDir: string | undefined;
  const previousStored = claimed.storedAttachments;
  const nextStored: Record<string, StoredAttachmentLocation> = {};
  for (const filename of uploadFilenames(claimed)) {
    const attachmentId =
      filename === claimed.originalFilename
        ? MAP_ASSET_ORIGINAL_ATTACHMENT
        : companionAttachmentName(filename);
    const location = storedAttachmentLocation(claimed, attachmentId);
    if (location) {
      nextStored[attachmentId] = location;
    }
  }
  try {
    const files = await loadOriginalFiles(claimed);
    const normalize = runtime?.normalize ?? normalizeMapUpload;
    const normalized = await withMapAssetProcessingWait(
      {
        event: 'processing.normalize',
        assetId,
        filename: claimed.originalFilename,
        detail: 'GDAL inspect + convert',
      },
      () => normalize(files, {assetId})
    );
    cleanupDir = normalized.cleanupDir;
    stopHeartbeat();
    await token.chain;
    const stillOwned = await refreshClaimToken(assetId, token, runtime);
    if (!stillOwned) {
      logMapAssetProcessing({
        event: 'processing.run',
        outcome: 'skipped',
        assetId,
        filename: claimed.originalFilename,
        elapsedMs: Date.now() - runStarted,
        reason: 'lost the processing claim',
      });
      return;
    }
    const stored = await withMapAssetProcessingWait(
      {
        event: 'processing.normalized.store',
        assetId,
        filename: claimed.originalFilename,
        kind: normalized.kind,
        byteSize: normalized.byteSize ?? normalized.bytes?.length,
      },
      () =>
        putNormalizedAttachment({
          assetId,
          claimStartedAt: token.current,
          filePath: normalized.filePath,
          bytes: normalized.bytes,
          mediaType: normalized.mediaType,
        })
    );
    if (!stored) {
      logMapAssetProcessing({
        event: 'processing.run',
        outcome: 'skipped',
        assetId,
        filename: claimed.originalFilename,
        elapsedMs: Date.now() - runStarted,
        reason: 'lost the processing claim',
      });
      return;
    }
    nextStored[MAP_ASSET_NORMALIZED_ATTACHMENT] = stored;
    const contentHash = normalized.filePath
      ? await sha256File(normalized.filePath)
      : sha256(normalized.bytes ?? Buffer.alloc(0));
    const byteSize = normalized.byteSize ?? normalized.bytes?.length ?? 0;
    await commitProcessingResult(assetId, token.current, latest =>
      omitUndefinedFields({
        ...latest,
        status: 'ready' as const,
        kind: normalized.kind,
        contentHash,
        byteSize,
        storedAttachments: nextStored,
        extent4326: normalized.extent4326,
        extent3857: normalized.extent3857,
        minZoom: normalized.minZoom,
        maxZoom: normalized.maxZoom,
        tileSize: normalized.tileSize,
        failureReason: undefined,
        processingStartedAt: undefined,
        updatedAt: processingNow(runtime),
      })
    );
    await deleteUnreferencedAttachments(previousStored, nextStored);
    logMapAssetProcessing({
      event: 'processing.commit',
      outcome: 'success',
      assetId,
      filename: claimed.originalFilename,
      kind: normalized.kind,
      byteSize,
    });
    logMapAssetProcessing({
      event: 'processing.run',
      outcome: 'success',
      assetId,
      filename: claimed.originalFilename,
      kind: normalized.kind,
      byteSize,
      elapsedMs: Date.now() - runStarted,
    });
  } catch (error) {
    stopHeartbeat();
    await token.chain;
    const message =
      error instanceof Error ? error.message : 'Map layer processing failed.';
    await commitProcessingResult(assetId, token.current, latest =>
      omitUndefinedFields({
        ...latest,
        status: 'failed' as const,
        failureReason: message,
        processingStartedAt: undefined,
        updatedAt: processingNow(runtime),
      })
    );
    logMapAssetProcessing({
      event: 'processing.commit',
      outcome: 'failure',
      assetId,
      filename: claimed.originalFilename,
      reason: message,
    });
    logMapAssetProcessing({
      event: 'processing.run',
      outcome: 'failure',
      assetId,
      filename: claimed.originalFilename,
      elapsedMs: Date.now() - runStarted,
      reason: message,
    });
  } finally {
    stopHeartbeat();
    if (cleanupDir) {
      await rm(cleanupDir, {recursive: true, force: true}).catch(
        () => undefined
      );
    }
    await cleanupStaging(assetId);
  }
}

const IN_PROGRESS_STATUS_KEYS = [
  'pending',
  'processing',
] as const satisfies readonly MapAssetStatus[];

async function listInProgressMapAssetIds(): Promise<string[]> {
  const result = await getMapAssetsDB().query<number>(MAP_ASSETS_BY_STATUS, {
    keys: [...IN_PROGRESS_STATUS_KEYS],
    include_docs: false,
  });
  const ids: string[] = [];
  for (const row of result.rows) {
    if (row.id) {
      ids.push(row.id);
    }
  }
  return ids;
}

/**
 * One unclaimed `pending` (or stale `processing`) asset whose originals
 * are already in object storage, or undefined when a worker should keep
 * polling.
 */
export async function findUnclaimedSpatialJob(
  runtime?: MapAssetProcessingRuntime
): Promise<string | undefined> {
  const now = processingNow(runtime);
  const timeoutMs = claimTimeoutMs(runtime);
  for (const assetId of await listInProgressMapAssetIds()) {
    try {
      const asset = await getMapAsset(assetId);
      if (!assetHasStoredAttachment(asset, MAP_ASSET_ORIGINAL_ATTACHMENT)) {
        continue;
      }
      if (!mapAssetIsClaimable(asset, now, timeoutMs)) {
        continue;
      }
      return asset._id;
    } catch (error) {
      if (!(error instanceof Exceptions.ItemNotFoundException)) {
        throw error;
      }
    }
  }
  return undefined;
}

/** Queue depth the capacity manager turns into worker tasks. */
export async function summarizeSpatialBacklog(
  runtime?: MapAssetProcessingRuntime
): Promise<{inFlight: number; unclaimed: number}> {
  const now = processingNow(runtime);
  const timeoutMs = claimTimeoutMs(runtime);
  let inFlight = 0;
  let unclaimed = 0;
  for (const assetId of await listInProgressMapAssetIds()) {
    try {
      const asset = await getMapAsset(assetId);
      if (!assetHasStoredAttachment(asset, MAP_ASSET_ORIGINAL_ATTACHMENT)) {
        continue;
      }
      if (mapAssetIsClaimable(asset, now, timeoutMs)) {
        unclaimed += 1;
      } else {
        inFlight += 1;
      }
    } catch (error) {
      if (!(error instanceof Exceptions.ItemNotFoundException)) {
        throw error;
      }
    }
  }
  return {inFlight, unclaimed};
}

/**
 * Retry original uploads from leftover staging, and fail pending assets
 * whose files are gone. Does not run GDAL.
 */
export async function sweepPendingOriginalUploads(
  runtime?: MapAssetProcessingRuntime
): Promise<string[]> {
  const now = processingNow(runtime);
  const graceMs = originalUploadGraceMs(runtime);
  logMapAssetProcessing({
    event: 'processing.sweep',
    outcome: 'started',
    detail: 'original upload sweep',
  });
  const touched: string[] = [];
  for (const assetId of await listInProgressMapAssetIds()) {
    try {
      const asset = await getMapAsset(assetId);
      if (assetHasStoredAttachment(asset, MAP_ASSET_ORIGINAL_ATTACHMENT)) {
        await cleanupStaging(asset._id);
        continue;
      }
      const staged = await readStagedFiles(asset._id, uploadFilenames(asset));
      if (staged) {
        await storeOriginalsFromStaging(asset._id);
        touched.push(asset._id);
        continue;
      }
      if (now - asset.updatedAt < graceMs) {
        continue;
      }
      await commitMissingOriginals(asset._id, now);
      touched.push(asset._id);
    } catch (error) {
      if (!(error instanceof Exceptions.ItemNotFoundException)) {
        throw error;
      }
    }
  }
  logMapAssetProcessing({
    event: 'processing.sweep',
    outcome: 'success',
    fileCount: touched.length,
    detail:
      touched.length === 0
        ? 'no pending original uploads'
        : `updated ${touched.length} in-progress asset(s)`,
  });
  return touched;
}

async function commitMissingOriginals(
  assetId: string,
  now: number
): Promise<void> {
  const db = getMapAssetsDB();
  for (let attempt = 0; attempt < PROCESSING_CLAIM_RETRIES; attempt++) {
    const latest = await getMapAsset(assetId);
    if (!isMapAssetInProgress(latest.status)) {
      return;
    }
    if (assetHasStoredAttachment(latest, MAP_ASSET_ORIGINAL_ATTACHMENT)) {
      return;
    }
    try {
      await db.put(
        omitUndefinedFields({
          ...latest,
          status: 'failed' as const,
          failureReason: MAP_ASSET_ORIGINALS_MISSING_REASON,
          processingStartedAt: undefined,
          updatedAt: now,
        })
      );
      return;
    } catch (error) {
      if (!isConflict(error)) {
        throw error;
      }
    }
  }
}

let originalUploadSweepTimer: ReturnType<typeof setInterval> | undefined;

/**
 * Start the API-side original-upload sweep. Idempotent. The timer does not
 * hold the process open. GDAL runs in the spatial worker, not here.
 */
export function startMapAssetOriginalUploadSweeper(): void {
  if (originalUploadSweepTimer) {
    return;
  }
  const run = () => {
    sweepPendingOriginalUploads().catch(error => {
      logMapAssetProcessing({
        event: 'processing.sweep',
        outcome: 'failure',
        reason: error instanceof Error ? error.message : String(error),
      });
      console.error(
        `${MAP_ASSET_PROCESSING_LOG} original upload sweep failed`,
        error
      );
    });
  };
  run();
  originalUploadSweepTimer = setInterval(
    run,
    MAP_ASSET_PROCESSING_SWEEP_INTERVAL_MS
  );
  originalUploadSweepTimer.unref();
  logMapAssetProcessing({
    event: 'processing.sweep',
    outcome: 'started',
    detail: `original uploads every ${MAP_ASSET_PROCESSING_SWEEP_INTERVAL_MS}ms`,
    source: 'sweeper',
  });
}

/** How long a client-direct download grant stays valid. */
export const MAP_ASSET_DOWNLOAD_URL_EXPIRY_SECONDS = 60 * 60;

function normalizedDownloadMeta(asset: ExistingMapAsset): {
  location: StoredAttachmentLocation;
  mediaType: string;
  filename: string;
} {
  if (asset.status !== 'ready' || !asset.kind) {
    throw new Exceptions.InvalidRequestException(
      'This map layer is not ready to download.'
    );
  }
  const location = storedAttachmentLocation(
    asset,
    MAP_ASSET_NORMALIZED_ATTACHMENT
  );
  if (!location) {
    throw new Exceptions.InvalidRequestException(
      'This map layer is not ready to download.'
    );
  }
  return {
    location,
    mediaType: normalizedMapAssetMediaType(asset.kind),
    filename: `${asset.name}.${normalizedMapAssetExtension(asset.kind)}`,
  };
}

/**
 * Mint a host-reachable presigned GET for the device-ready file.
 * Clients download the bytes from object storage, not through Conductor.
 */
export async function presignNormalizedAttachment(
  assetId: string
): Promise<GetMapAssetDownloadUrlResponse> {
  const {location, mediaType, filename} = normalizedDownloadMeta(
    await getMapAsset(assetId)
  );
  const expiresInSeconds = MAP_ASSET_DOWNLOAD_URL_EXPIRY_SECONDS;
  return {
    url: await presignAttachmentDownload({
      location,
      expiresInSeconds,
      contentType: mediaType,
      filename,
    }),
    mediaType,
    filename,
    byteSize: location.byteSize,
    expiresInSeconds,
  };
}

export async function openNormalizedAttachment(assetId: string): Promise<{
  body: Awaited<ReturnType<typeof downloadAttachmentStream>>;
  mediaType: string;
  filename: string;
  byteSize?: number;
}> {
  const {location, mediaType, filename} = normalizedDownloadMeta(
    await getMapAsset(assetId)
  );
  return {
    body: await downloadAttachmentStream(location),
    mediaType,
    filename,
    byteSize: location.byteSize,
  };
}

export async function readNormalizedAttachment(
  assetId: string
): Promise<{bytes: Buffer; mediaType: string; filename: string}> {
  const file = await openNormalizedAttachment(assetId);
  return {
    bytes: await collectStream(file.body),
    mediaType: file.mediaType,
    filename: file.filename,
  };
}

export async function linkMapAsset({
  assetId,
  projectId,
  linkedBy,
}: {
  assetId: string;
  projectId: string;
  linkedBy: string;
}): Promise<ExistingMapAssetLink> {
  await getMapAsset(assetId);
  const db = getMapAssetsDB();
  const _id = linkDocumentId(assetId, projectId);
  try {
    const existing = await db.get(_id);
    if (isLink(existing)) {
      return existing;
    }
  } catch (error) {
    const status = (error as {status?: number}).status;
    if (status !== 404) {
      throw error;
    }
  }
  const fields: MapAssetLinkFields = {
    docType: 'link',
    assetId,
    projectId,
    linkedBy,
    createdAt: Date.now(),
  };
  const created = await db.put({_id, ...fields});
  return {_id, _rev: created.rev, ...fields};
}

export async function unlinkMapAsset({
  assetId,
  projectId,
}: {
  assetId: string;
  projectId: string;
}): Promise<void> {
  const db = getMapAssetsDB();
  const _id = linkDocumentId(assetId, projectId);
  try {
    const existing = await db.get(_id);
    await db.remove(existing);
  } catch (error) {
    const status = (error as {status?: number}).status;
    if (status === 404) {
      return;
    }
    throw error;
  }
}

export async function deleteMapAsset(assetId: string): Promise<void> {
  const db = getMapAssetsDB();
  const asset = await getMapAsset(assetId);
  const result = await db.query<string>(MAP_ASSET_LINKS_BY_ASSET, {
    key: assetId,
    include_docs: false,
  });
  for (const row of result.rows) {
    if (!row.id) {
      continue;
    }
    const link = await db.get(row.id);
    if (isLink(link)) {
      await db.remove(link);
    }
  }
  const latest = await getMapAsset(asset._id);
  const stored = latest.storedAttachments ?? {};
  await db.remove(latest);
  await cleanupStaging(assetId);
  await Promise.all(
    Object.values(stored).map(location =>
      deleteStoredAttachment(location).catch(() => undefined)
    )
  );
}

function toListing(
  asset: ExistingMapAsset
): ContextualLayerListing | undefined {
  if (
    asset.status !== 'ready' ||
    !asset.kind ||
    !asset.contentHash ||
    !asset.extent4326
  ) {
    return undefined;
  }
  return {
    id: asset._id,
    name: asset.name,
    kind: asset.kind,
    byteSize: asset.byteSize,
    contentHash: asset.contentHash,
    extent: asset.extent4326,
    ...(asset.extent3857 ? {extent3857: asset.extent3857} : {}),
    ...(asset.minZoom !== undefined ? {minZoom: asset.minZoom} : {}),
    ...(asset.maxZoom !== undefined ? {maxZoom: asset.maxZoom} : {}),
    ...(asset.tileSize !== undefined ? {tileSize: asset.tileSize} : {}),
    defaultStyle: asset.defaultStyle,
  };
}

/** Ready layers linked to one survey, plus the manifest hash. */
export async function contextualLayersForProject(projectId: string): Promise<{
  contextualLayers: ContextualLayerListing[];
  contextualLayersHash: string;
}> {
  const assetIds = await listLinkAssetIds(projectId);
  const layers: ContextualLayerListing[] = [];
  for (const assetId of assetIds) {
    try {
      const listing = toListing(await getMapAsset(assetId));
      if (listing) {
        layers.push(listing);
      }
    } catch (error) {
      if (!(error instanceof Exceptions.ItemNotFoundException)) {
        throw error;
      }
    }
  }
  layers.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return {
    contextualLayers: layers,
    contextualLayersHash: await buildContextualLayersHash(layers),
  };
}

/**
 * Attaches the survey manifest onto listing rows.
 * A read failure leaves the fields off the row so a device does not treat a
 * transient error as "this survey no longer has layers" and delete local files.
 */
export async function attachContextualLayers<T extends {_id: string}>(
  projects: T[]
): Promise<
  (T & {
    contextualLayers?: ContextualLayerListing[];
    contextualLayersHash?: string;
  })[]
> {
  try {
    return await Promise.all(
      projects.map(async project => {
        const manifest = await contextualLayersForProject(project._id);
        return {...project, ...manifest};
      })
    );
  } catch (error) {
    console.error('[map-assets] failed to attach survey layers', error);
    return projects;
  }
}
