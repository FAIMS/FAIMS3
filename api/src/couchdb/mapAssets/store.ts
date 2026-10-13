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
  MAP_ASSETS_BY_CREATOR,
  MAP_ASSETS_BY_STATUS,
  MAP_ASSETS_BY_TEAM,
  MapAssetFields,
  MapAssetLinkFields,
  MapAssetNormalizeOptions,
  MapAssetStyle,
  resolveMapAssetNormalizeOptions,
} from '@faims3/data-model';
import {randomUUID} from 'crypto';
import {rm} from 'fs/promises';
import {getMapAssetsDB} from '..';
import * as Exceptions from '../../exceptions';
import {
  assetHasAttachment,
  downloadAttachmentToFile,
  putFileAttachment,
  sha256,
  sha256File,
} from './attachments';
import {normalizeMapUpload, UploadedMapFile} from './normalize';
import {
  cleanupStaging,
  ensureStagingPaths,
  readStagedFiles,
  stageUploadFiles,
} from './staging';

export {sha256} from './attachments';

type AttachmentDb = {
  getAttachment(docId: string, attachmentId: string): Promise<Buffer | Blob>;
};

function attachmentDb() {
  return getMapAssetsDB() as unknown as AttachmentDb;
}

async function asBuffer(data: Buffer | Blob): Promise<Buffer> {
  if (Buffer.isBuffer(data)) {
    return data;
  }
  return Buffer.from(await data.arrayBuffer());
}

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
  rev,
  files,
  primaryFilename,
}: {
  assetId: string;
  rev: string;
  files: UploadedMapFile[];
  primaryFilename: string;
}): Promise<string> {
  const primary =
    files.find(file => file.filename === primaryFilename) ?? files[0];
  if (!primary.diskPath) {
    throw new Error(`Upload is missing data for ${primary.filename}.`);
  }
  let nextRev = await putFileAttachment({
    assetId,
    rev,
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
    nextRev = await putFileAttachment({
      assetId,
      rev: nextRev,
      attachmentId: companionAttachmentName(file.filename),
      filePath: file.diskPath,
      contentType: 'application/octet-stream',
    });
  }
  return nextRev;
}

export async function createMapAsset({
  name,
  description,
  ownedByTeamId,
  createdBy,
  files,
  primaryFilename,
  style,
  quality,
  normalizeOptions,
}: {
  name: string;
  description: string;
  ownedByTeamId?: string;
  createdBy: string;
  files: UploadedMapFile[];
  primaryFilename: string;
  style?: MapAssetStyle;
  quality?: number;
  normalizeOptions?: Partial<MapAssetNormalizeOptions>;
}): Promise<ExistingMapAsset> {
  const db = getMapAssetsDB();
  const now = Date.now();
  const assetId = `asset-${randomUUID()}`;
  const companions = files
    .map(file => file.filename)
    .filter(filename => filename !== primaryFilename);
  const resolved = resolveMapAssetNormalizeOptions({
    quality,
    options: normalizeOptions,
  });
  const fields: MapAssetFields = {
    docType: MAP_ASSET_DOC_TYPE,
    name,
    description,
    ...(ownedByTeamId ? {ownedByTeamId} : {}),
    createdBy,
    originalFilename: primaryFilename,
    ...(companions.length > 0 ? {companionFilenames: companions} : {}),
    byteSize: 0,
    status: 'processing',
    defaultStyle: style ?? DEFAULT_MAP_ASSET_STYLE,
    quality: resolved.quality,
    normalizeOptions: resolved.options,
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
  quality,
  normalizeOptions,
}: {
  assetId: string;
  files: UploadedMapFile[];
  primaryFilename: string;
  quality?: number;
  normalizeOptions?: Partial<MapAssetNormalizeOptions>;
}): Promise<ExistingMapAsset> {
  const current = await getMapAsset(assetId);
  if (current.status === 'processing') {
    throw new Exceptions.InvalidRequestException(
      'This map layer is still processing.'
    );
  }
  const companions = files
    .map(file => file.filename)
    .filter(filename => filename !== primaryFilename);
  const resolved = resolveMapAssetNormalizeOptions({
    quality,
    options: normalizeOptions,
  });
  await getMapAssetsDB().put(
    omitUndefinedFields({
      ...current,
      originalFilename: primaryFilename,
      companionFilenames: companions.length > 0 ? companions : undefined,
      status: 'processing',
      failureReason: undefined,
      contentHash: undefined,
      kind: undefined,
      extent4326: undefined,
      extent3857: undefined,
      byteSize: 0,
      processingStartedAt: undefined,
      processingAttempts: undefined,
      quality: resolved.quality,
      normalizeOptions: resolved.options,
      updatedAt: Date.now(),
    })
  );
  await cleanupStaging(assetId);
  await stageUploadFiles(assetId, files);
  return getMapAsset(assetId);
}

function uploadFilenames(asset: ExistingMapAsset): string[] {
  return [asset.originalFilename, ...(asset.companionFilenames ?? [])];
}

async function downloadOriginalsToStaging(
  asset: ExistingMapAsset
): Promise<UploadedMapFile[] | undefined> {
  if (!assetHasAttachment(asset, MAP_ASSET_ORIGINAL_ATTACHMENT)) {
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
    await downloadAttachmentToFile({
      assetId: asset._id,
      attachmentId: MAP_ASSET_ORIGINAL_ATTACHMENT,
      destPath: primary.diskPath,
    });
    for (const filename of asset.companionFilenames ?? []) {
      const file = staged.find(item => item.filename === filename);
      if (!file?.diskPath) {
        continue;
      }
      await downloadAttachmentToFile({
        assetId: asset._id,
        attachmentId: companionAttachmentName(filename),
        destPath: file.diskPath,
      });
    }
  } catch (error) {
    const status =
      (error as {status?: number; statusCode?: number}).status ??
      (error as {statusCode?: number}).statusCode;
    if (status === 404) {
      await cleanupStaging(asset._id);
      return undefined;
    }
    throw error;
  }
  return readStagedFiles(asset._id, uploadFilenames(asset));
}

async function resolveUploadFiles(asset: ExistingMapAsset): Promise<{
  files: UploadedMapFile[];
  fromStaging: boolean;
}> {
  const staged = await readStagedFiles(asset._id, uploadFilenames(asset));
  if (staged) {
    return {files: staged, fromStaging: true};
  }
  const downloaded = await downloadOriginalsToStaging(asset);
  if (downloaded) {
    return {files: downloaded, fromStaging: false};
  }
  throw new Error('The uploaded map files are no longer available.');
}

/** A claim older than this may be taken by another API process. */
export const MAP_ASSET_PROCESSING_CLAIM_TIMEOUT_MS = 2 * 60 * 60 * 1000;
/**
 * Claims started for one upload, including the first. A crash after this
 * many claims is marked failed. A GDAL error fails on the current claim.
 */
export const MAP_ASSET_PROCESSING_MAX_ATTEMPTS = 3;
export const MAP_ASSET_PROCESSING_SWEEP_INTERVAL_MS = 60 * 1000;
export const MAP_ASSET_PROCESSING_EXHAUSTED_REASON =
  'Map layer processing was interrupted too many times.';

const PROCESSING_CLAIM_RETRIES = 5;

export type MapAssetProcessingRuntime = {
  now?: () => number;
  claimTimeoutMs?: number;
  maxAttempts?: number;
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
 * True when `status` is `processing` and no live claim is held.
 * A missing timestamp is stale: the process died before it claimed the job.
 */
export function mapAssetProcessingClaimIsStale(
  asset: {status: string; processingStartedAt?: number},
  now: number,
  timeoutMs: number = MAP_ASSET_PROCESSING_CLAIM_TIMEOUT_MS
): boolean {
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
    if (!mapAssetProcessingClaimIsStale(asset, now, timeoutMs)) {
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
        processingStartedAt: now,
        processingAttempts: attempts + 1,
        updatedAt: now,
      });
      return getMapAsset(assetId);
    } catch (error) {
      if (isConflict(error)) {
        continue;
      }
      throw error;
    }
  }
  console.error(`[map-assets] could not claim ${assetId}`);
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
 * Store the normalized file while this claim still owns the asset.
 * Returns false when another process has taken over or already finished.
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
}): Promise<boolean> {
  for (let attempt = 0; attempt < PROCESSING_CLAIM_RETRIES; attempt++) {
    const latest = await getMapAsset(assetId);
    if (
      latest.status !== 'processing' ||
      latest.processingStartedAt !== claimStartedAt
    ) {
      return false;
    }
    try {
      if (filePath) {
        await putFileAttachment({
          assetId,
          rev: latest._rev,
          attachmentId: MAP_ASSET_NORMALIZED_ATTACHMENT,
          filePath,
          contentType: mediaType,
        });
        return true;
      }
      if (!bytes) {
        throw new Error('Normalized map layer is missing data.');
      }
      await getMapAssetsDB().putAttachment(
        assetId,
        MAP_ASSET_NORMALIZED_ATTACHMENT,
        latest._rev,
        bytes,
        mediaType
      );
      return true;
    } catch (error) {
      if (!isConflict(error)) {
        throw error;
      }
    }
  }
  throw new Error(`Could not store the normalized map layer for ${assetId}.`);
}

/** Runs GDAL and stores the normalized attachment. Safe to call from the job queue. */
export async function processMapAsset(
  assetId: string,
  runtime?: MapAssetProcessingRuntime
): Promise<void> {
  const claimed = await claimMapAssetProcessing(assetId, runtime);
  const claimStartedAt = claimed?.processingStartedAt;
  if (!claimed || claimStartedAt === undefined) {
    return;
  }
  let cleanupDir: string | undefined;
  try {
    const {files, fromStaging} = await resolveUploadFiles(claimed);
    if (fromStaging) {
      await putOriginalFilesFromDisk({
        assetId,
        rev: (await getMapAsset(assetId))._rev,
        files,
        primaryFilename: claimed.originalFilename,
      });
    }
    const {options} = resolveMapAssetNormalizeOptions({
      quality: claimed.quality,
      options: claimed.normalizeOptions,
    });
    const normalize = runtime?.normalize ?? normalizeMapUpload;
    const normalized = await normalize(files, options);
    cleanupDir = normalized.cleanupDir;
    const stored = await putNormalizedAttachment({
      assetId,
      claimStartedAt,
      filePath: normalized.filePath,
      bytes: normalized.bytes,
      mediaType: normalized.mediaType,
    });
    if (!stored) {
      return;
    }
    const contentHash = normalized.filePath
      ? await sha256File(normalized.filePath)
      : sha256(normalized.bytes ?? Buffer.alloc(0));
    const byteSize = normalized.byteSize ?? normalized.bytes?.length ?? 0;
    await commitProcessingResult(assetId, claimStartedAt, latest =>
      omitUndefinedFields({
        ...latest,
        status: 'ready' as const,
        kind: normalized.kind,
        contentHash,
        byteSize,
        extent4326: normalized.extent4326,
        extent3857: normalized.extent3857,
        failureReason: undefined,
        processingStartedAt: undefined,
        updatedAt: processingNow(runtime),
      })
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Map layer processing failed.';
    await commitProcessingResult(assetId, claimStartedAt, latest =>
      omitUndefinedFields({
        ...latest,
        status: 'failed' as const,
        failureReason: message,
        processingStartedAt: undefined,
        updatedAt: processingNow(runtime),
      })
    );
  } finally {
    if (cleanupDir) {
      await rm(cleanupDir, {recursive: true, force: true}).catch(
        () => undefined
      );
    }
    await cleanupStaging(assetId);
  }
}

let processingQueue: Promise<void> = Promise.resolve();

/** Serialise GDAL work so one large raster does not overlap the next. */
export function enqueueMapAssetProcessing(
  assetId: string,
  runtime?: MapAssetProcessingRuntime
): void {
  processingQueue = processingQueue
    .then(() => processMapAsset(assetId, runtime))
    .catch(error => {
      console.error(`[map-assets] processing failed for ${assetId}`, error);
    });
}

/** Test helper: wait until queued processing has finished. */
export function waitForMapAssetProcessing(): Promise<void> {
  return processingQueue;
}

/**
 * Re-queue processing assets whose claim is missing or expired.
 * Each API process runs this on startup and on a timer so a crashed
 * container's job is picked up by the next sweep. Staging files on this
 * host are reused; otherwise originals are streamed back from CouchDB.
 */
export async function sweepStaleMapAssetProcessing(
  runtime?: MapAssetProcessingRuntime
): Promise<string[]> {
  const now = processingNow(runtime);
  const timeoutMs = claimTimeoutMs(runtime);
  const result = await getMapAssetsDB().query<number>(MAP_ASSETS_BY_STATUS, {
    key: 'processing',
    include_docs: false,
  });
  const enqueued: string[] = [];
  for (const row of result.rows) {
    if (!row.id) {
      continue;
    }
    try {
      const asset = await getMapAsset(row.id);
      if (!mapAssetProcessingClaimIsStale(asset, now, timeoutMs)) {
        continue;
      }
      enqueued.push(row.id);
      enqueueMapAssetProcessing(row.id, runtime);
    } catch (error) {
      if (!(error instanceof Exceptions.ItemNotFoundException)) {
        throw error;
      }
    }
  }
  return enqueued;
}

let processingSweepTimer: ReturnType<typeof setInterval> | undefined;

/** Start the in-process sweep. Idempotent. The timer does not hold the process open. */
export function startMapAssetProcessingSweeper(): void {
  if (processingSweepTimer) {
    return;
  }
  const run = () => {
    sweepStaleMapAssetProcessing().catch(error => {
      console.error('[map-assets] processing sweep failed', error);
    });
  };
  run();
  processingSweepTimer = setInterval(
    run,
    MAP_ASSET_PROCESSING_SWEEP_INTERVAL_MS
  );
  processingSweepTimer.unref();
  console.log(
    `[map-assets] processing sweep every ${MAP_ASSET_PROCESSING_SWEEP_INTERVAL_MS}ms`
  );
}

export async function readNormalizedAttachment(
  assetId: string
): Promise<{bytes: Buffer; mediaType: string; filename: string}> {
  const asset = await getMapAsset(assetId);
  if (asset.status !== 'ready' || !asset.kind) {
    throw new Exceptions.InvalidRequestException(
      'This map layer is not ready to download.'
    );
  }
  const bytes = await asBuffer(
    await attachmentDb().getAttachment(assetId, MAP_ASSET_NORMALIZED_ATTACHMENT)
  );
  const extension = asset.kind === 'geojson' ? 'geojson' : 'png';
  return {
    bytes,
    mediaType: asset.kind === 'geojson' ? 'application/geo+json' : 'image/png',
    filename: `${asset.name}.${extension}`,
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
  await db.remove(latest);
  await cleanupStaging(assetId);
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
