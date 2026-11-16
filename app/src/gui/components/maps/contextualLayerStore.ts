// SPDX-License-Identifier: Apache-2.0
/**
 * On-device copies of normalized map layers, plus local paint preferences.
 * File bytes live in Capacitor Filesystem or the Origin Private File System.
 * The file catalog, per-survey style edits, and seen-listing hashes live in
 * persisted Redux. Survey membership is the survey listing: a stored file is
 * available to every activated survey that lists that asset.
 */

import {Capacitor} from '@capacitor/core';
import {Directory, Filesystem} from '@capacitor/filesystem';
import type {
  ContextualLayerListing,
  GetMapAssetDownloadUrlResponse,
} from '@faims3/data-model';
import {
  isTiledMapAssetKind,
  normalizedMapAssetExtension,
} from '@faims3/data-model';
import type {ContextualMapLayer, TileByteRead} from '@faims3/forms';
import {
  moveStackedLayer,
  readBlobRange,
  readResponseBytes,
} from '@faims3/forms';
import {
  readContextualLayersState,
  writeContextualLayersState,
  type ContextualLayerFile,
  type ContextualLayerPrefs,
  type ContextualLayersState,
} from '../../../context/slices/contextualLayersSlice';
import {createAsyncMutex} from '../../../utils/asyncMutex';
import {
  assignDownloadedLayer,
  filenamesToDelete,
  layerDeviceStatus,
  retainListedLayers,
} from './contextualLayerIndex';
import {readNativeFileRange} from './mapFileRange';

type StoredFile = ContextualLayerFile;
type LayerPrefs = ContextualLayerPrefs;
type LayerIndex = ContextualLayersState;

/** Persisted files, prefs, and seen hashes. */
function readIndex(): LayerIndex {
  return readContextualLayersState();
}

/** Persist the files/prefs/seen-hash snapshot. */
function writeIndex(index: LayerIndex): void {
  writeContextualLayersState(index);
}

/**
 * One writer at a time for the on-device files map. Downloads, directory
 * retain, release, and remove all replace `files` from a snapshot; overlapping
 * them drops other surveys' entries, then deleteUnreferencedFiles removes those
 * files from disk. Style edits stay outside this lock.
 *
 * Downloads only hold this lock for the short index commit after their bytes
 * are on disk, so layers can transfer in parallel. The commit re-reads the
 * index under the lock, so a parallel download's entry is never overwritten
 * by a stale snapshot taken before the transfer started.
 */
const runFileIndexMutation = createAsyncMutex();

/**
 * Filenames an in-flight download is writing. The file is not in the index
 * until its commit, so without this an unrelated commit's
 * deleteUnreferencedFiles sweep would delete the partial file mid-transfer.
 */
const inFlightFileWrites = new Set<string>();

/**
 * Maximum number of layer files transferring at once, across every caller
 * (settings panel, activation prompt, preview). Extra downloads wait —
 * cancellably — for a free slot rather than saturating the connection and
 * disk on a field device. Three sits in the middle of the useful 2–4 range:
 * enough to hide latency between files, few enough for a weak link.
 */
export const MAP_LAYER_DOWNLOAD_CONCURRENCY = 3;

let activeLayerTransfers = 0;
type LayerTransferWaiter = {
  resolve: () => void;
  reject: (error: Error) => void;
  signal?: AbortSignal;
  onAbort: () => void;
};
const layerTransferWaiters: LayerTransferWaiter[] = [];

/** Take a transfer slot, waiting (cancellably) when all slots are busy. */
async function acquireLayerTransferSlot(signal?: AbortSignal): Promise<void> {
  throwIfDownloadCancelled(signal);
  if (activeLayerTransfers < MAP_LAYER_DOWNLOAD_CONCURRENCY) {
    activeLayerTransfers += 1;
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const waiter: LayerTransferWaiter = {
      signal,
      resolve: () => {
        signal?.removeEventListener('abort', waiter.onAbort);
        resolve();
      },
      reject,
      onAbort: () => {
        const index = layerTransferWaiters.indexOf(waiter);
        if (index >= 0) {
          layerTransferWaiters.splice(index, 1);
        }
        reject(new ContextualLayerDownloadCancelledError());
      },
    };
    signal?.addEventListener('abort', waiter.onAbort, {once: true});
    layerTransferWaiters.push(waiter);
  });
}

/** Free a transfer slot and hand it to the longest-waiting download. */
function releaseLayerTransferSlot(): void {
  const next = layerTransferWaiters.shift();
  if (next) {
    // The slot passes straight to the waiter, so the count is unchanged.
    next.resolve();
    return;
  }
  activeLayerTransfers -= 1;
}

const layerDownloadChains = new Map<string, Promise<void>>();

/**
 * Serialize downloads of one asset (concurrent callers would write the same
 * filename), while downloads of different assets run in parallel. A queued
 * caller re-checks the index once it holds the asset, so it reuses the copy
 * the caller ahead of it just committed instead of downloading it again.
 *
 * `fn` may register leftover work with `holdUntil`. The caller still
 * returns immediately, but the next download of this asset waits until
 * that work settles — used so a cancelled native `downloadFile` can
 * delete `{assetId}-{hash}.pmtiles` before a retry indexes the same name.
 */
async function runLayerDownloadExclusive<T>(
  assetId: string,
  fn: (holdUntil: (work: Promise<unknown>) => void) => Promise<T>
): Promise<T> {
  const previous = layerDownloadChains.get(assetId) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>(resolve => {
    release = resolve;
  });
  layerDownloadChains.set(assetId, current);
  await previous.catch(() => {});
  const leftovers: Promise<unknown>[] = [];
  /** Release this asset's download chain once leftovers settle. */
  const finish = () => {
    release();
    if (layerDownloadChains.get(assetId) === current) {
      layerDownloadChains.delete(assetId);
    }
  };
  try {
    return await fn(work => {
      leftovers.push(work);
    });
  } finally {
    if (leftovers.length === 0) {
      finish();
    } else {
      void Promise.allSettled(leftovers).then(finish);
    }
  }
}

/** Drop per-asset download chains left held by cancelled native transfers. */
export function resetLayerDownloadExclusiveForTests(): void {
  layerDownloadChains.clear();
}

/** Filenames already on disk (native Data dir or browser OPFS). */
async function listDeviceFilenames(): Promise<string[]> {
  if (Capacitor.isNativePlatform()) {
    try {
      const listing = await Filesystem.readdir({
        path: 'map-assets',
        directory: Directory.Data,
      });
      return listing.files.map(file => file.name);
    } catch {
      return [];
    }
  }
  try {
    const root = await navigator.storage.getDirectory();
    const dir = await root.getDirectoryHandle('map-assets');
    const names: string[] = [];
    for await (const name of dir.keys()) {
      names.push(name);
    }
    return names;
  } catch {
    return [];
  }
}

/** Delete bytes that the index no longer names, including a replaced hash. */
async function deleteUnreferencedFiles(index: LayerIndex): Promise<void> {
  const referenced = new Set(
    Object.values(index.files).map(file => file.filename)
  );
  const onDisk = await listDeviceFilenames();
  await Promise.all(
    onDisk
      .filter(
        filename =>
          !referenced.has(filename) && !inFlightFileWrites.has(filename)
      )
      .map(filename => removeDeviceFile(filename))
  );
}

/** Drop paint prefs whose asset is no longer on the device. */
function dropUnusedPrefs(index: LayerIndex): void {
  for (const [projectId, byAsset] of Object.entries(index.prefs)) {
    for (const assetId of Object.keys(byAsset)) {
      if (!index.files[assetId]) {
        delete byAsset[assetId];
      }
    }
    if (Object.keys(byAsset).length === 0) {
      delete index.prefs[projectId];
    }
  }
}

/** Stable on-device name: `{assetId}-{contentHash}.pmtiles`. */
function filenameFor(layer: ContextualLayerListing): string {
  return `${layer.id}-${layer.contentHash}.${normalizedMapAssetExtension(layer.kind)}`;
}

/**
 * Range reader for one stored archive. The browser slices the OPFS file.
 * Android and iOS seek through MapFileRange.
 */
async function bindStoredLayerReader(filename: string): Promise<TileByteRead> {
  if (Capacitor.isNativePlatform()) {
    return (offset, length, signal) =>
      readNativeFileRange(`map-assets/${filename}`, offset, length, signal);
  }
  const root = await navigator.storage.getDirectory();
  const dir = await root.getDirectoryHandle('map-assets');
  const handle = await dir.getFileHandle(filename);
  const file = await handle.getFile();
  return (offset, length, signal) =>
    readBlobRange(file, offset, length, signal);
}

/** Write PMTiles bytes into the browser Origin Private File System. */
async function writeBrowserFile(
  filename: string,
  bytes: Uint8Array
): Promise<void> {
  const root = await navigator.storage.getDirectory();
  const dir = await root.getDirectoryHandle('map-assets', {create: true});
  const handle = await dir.getFileHandle(filename, {create: true});
  const writable = await handle.createWritable();
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  await writable.write(new Blob([copy]));
  await writable.close();
}

const browserObjectUrls = new Map<string, string>();

/** Delete one stored file and revoke any browser object URL. */
async function removeDeviceFile(filename: string): Promise<void> {
  const objectUrl = browserObjectUrls.get(filename);
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    browserObjectUrls.delete(filename);
  }
  if (Capacitor.isNativePlatform()) {
    await Filesystem.deleteFile({
      path: `map-assets/${filename}`,
      directory: Directory.Data,
    }).catch(() => undefined);
    return;
  }
  const root = await navigator.storage.getDirectory();
  const dir = await root.getDirectoryHandle('map-assets', {create: true});
  await dir.removeEntry(filename).catch(() => undefined);
}

/**
 * URL the map renderer can fetch. Native uses a Capacitor file URI;
 * the browser caches an object URL for the OPFS blob.
 */
async function urlForFile(filename: string): Promise<string> {
  if (Capacitor.isNativePlatform()) {
    const {uri} = await Filesystem.getUri({
      path: `map-assets/${filename}`,
      directory: Directory.Data,
    });
    return Capacitor.convertFileSrc(uri);
  }
  const cached = browserObjectUrls.get(filename);
  if (cached) {
    return cached;
  }
  const root = await navigator.storage.getDirectory();
  const dir = await root.getDirectoryHandle('map-assets', {create: true});
  const handle = await dir.getFileHandle(filename);
  const file = await handle.getFile();
  const url = URL.createObjectURL(file);
  browserObjectUrls.set(filename, url);
  return url;
}

/**
 * Stored paint prefs for a file, or file-default style with a stack
 * `zIndex` from `order` when none have been saved.
 */
function prefsFor(
  file: StoredFile,
  prefs: LayerPrefs | undefined,
  order: number
): LayerPrefs {
  const fallback: LayerPrefs = {
    visible: true,
    opacity: file.defaultStyle.opacity,
    zIndex: 10 + order,
    stroke: file.defaultStyle.stroke,
    fill: file.defaultStyle.fill,
    lineWidth: file.defaultStyle.lineWidth,
    pointSize: file.defaultStyle.pointSize,
  };
  if (!prefs) {
    return fallback;
  }
  return {
    ...prefs,
    zIndex: Number.isFinite(prefs.zIndex) ? prefs.zIndex : fallback.zIndex,
  };
}

/**
 * Restore this survey's downloaded overlays to file defaults and the
 * original asset-id stack. Returns the prefs applied so the panel can
 * update before the listing reloads.
 */
export function resetContextualLayerPrefs(
  projectId: string,
  listedAssetIds: readonly string[]
): Record<string, LayerPrefs> {
  const index = readIndex();
  const files = listedAssetIds
    .map(assetId => index.files[assetId])
    .filter((file): file is StoredFile => file !== undefined)
    .sort((a, b) => a.assetId.localeCompare(b.assetId));
  const nextPrefs: Record<string, LayerPrefs> = {};
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const prefs = prefsFor(file, undefined, i);
    nextPrefs[file.assetId] = prefs;
  }
  index.prefs[projectId] = nextPrefs;
  writeIndex(index);
  return nextPrefs;
}

/** First unused stack slot. `10 + prefsCount` can reuse a deleted layer's z. */
function nextUnusedZIndex(prefs: Record<string, LayerPrefs>): number {
  let max = 9;
  for (const pref of Object.values(prefs)) {
    if (Number.isFinite(pref.zIndex) && pref.zIndex > max) {
      max = pref.zIndex;
    }
  }
  return max + 1;
}

/** Overlay stored paint prefs onto a loaded map layer. */
function applyStoredPrefs(
  layer: ContextualMapLayer,
  prefs: LayerPrefs
): ContextualMapLayer {
  return {
    ...layer,
    visible: prefs.visible,
    opacity: prefs.opacity,
    zIndex: prefs.zIndex,
    stroke: prefs.stroke,
    fill: prefs.fill,
    lineWidth: prefs.lineWidth,
    pointSize: prefs.pointSize,
  };
}

/** Last listing hash the user was shown for this survey, if any. */
export async function getSeenContextualLayersHash(
  projectId: string
): Promise<string | undefined> {
  return readIndex().seenHashByProject[projectId];
}

/** Record that the user has seen this survey's current layer listing. */
export async function markContextualLayersSeen(
  projectId: string,
  hash: string
): Promise<void> {
  const index = readIndex();
  index.seenHashByProject[projectId] = hash;
  writeIndex(index);
}

/** Layers this survey lists that are already on the device, in stack order. */
export async function contextualLayersForMap(
  projectId: string,
  listedAssetIds: readonly string[]
): Promise<ContextualMapLayer[]> {
  const index = readIndex();
  const files = listedAssetIds
    .map(assetId => index.files[assetId])
    .filter((file): file is StoredFile => file !== undefined);
  files.sort((a, b) => a.assetId.localeCompare(b.assetId));
  const projectPrefs = index.prefs[projectId] ?? {};
  const layers: ContextualMapLayer[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const prefs = prefsFor(file, projectPrefs[file.assetId], i);
    layers.push(await layerFromFile(file, prefs, prefs.visible));
  }
  // URI work above is slow on Android. Re-read paint so a raise that
  // landed while we waited is not returned as the old stack.
  const latestPrefs = readIndex().prefs[projectId] ?? {};
  return layers
    .map(layer => {
      const prefs = latestPrefs[layer.id];
      return prefs ? applyStoredPrefs(layer, prefs) : layer;
    })
    .sort((a, b) => a.zIndex - b.zIndex);
}

/**
 * One stored layer, including its file URL, for the layer preview.
 *
 * Paint is the file-default style (default opacity, stroke, and fill), not
 * the per-survey paint saved from notebook maps, so the preview always
 * opens at its default view regardless of earlier styling edits.
 */
export async function loadStoredContextualLayer(
  assetId: string
): Promise<ContextualMapLayer | undefined> {
  const index = readIndex();
  const file = index.files[assetId];
  if (!file) {
    return undefined;
  }
  const prefs = prefsFor(file, undefined, 0);
  return layerFromFile(file, prefs, true);
}

/** Build a map-ready layer from a stored file and its paint prefs. */
async function layerFromFile(
  file: StoredFile,
  prefs: LayerPrefs,
  visible: boolean
): Promise<ContextualMapLayer> {
  return {
    id: file.assetId,
    name: file.name,
    kind: file.kind,
    url: await urlForFile(file.filename),
    readTileBytes: isTiledMapAssetKind(file.kind)
      ? await bindStoredLayerReader(file.filename)
      : undefined,
    visible,
    opacity: prefs.opacity,
    zIndex: prefs.zIndex,
    stroke: prefs.stroke,
    fill: prefs.fill,
    lineWidth: prefs.lineWidth,
    pointSize: prefs.pointSize,
    extent4326: file.extent4326,
    extent3857: file.extent3857,
    minZoom: file.minZoom,
    maxZoom: file.maxZoom,
    tileSize: file.tileSize,
  };
}

/** Merge a paint-pref patch for one stored layer. Missing files are a no-op. */
export async function updateContextualLayerPrefs(
  projectId: string,
  assetId: string,
  patch: Partial<LayerPrefs>
): Promise<void> {
  const index = readIndex();
  const file = index.files[assetId];
  if (!file) {
    return;
  }
  const projectPrefs = index.prefs[projectId] ?? {};
  const current = prefsFor(file, projectPrefs[assetId], 0);
  index.prefs[projectId] = {
    ...projectPrefs,
    [assetId]: {...current, ...patch},
  };
  writeIndex(index);
}

/**
 * Move a survey overlay up or down in the stack and persist the new
 * `zIndex` values. A no-op when the layer is already at that edge.
 */
export async function moveContextualLayer(
  projectId: string,
  listedAssetIds: readonly string[],
  assetId: string,
  direction: 'up' | 'down'
): Promise<void> {
  const layers = await contextualLayersForMap(projectId, listedAssetIds);
  const next = moveStackedLayer(layers, assetId, direction);
  if (next === layers) {
    return;
  }
  for (const layer of next) {
    const previous = layers.find(item => item.id === layer.id);
    if (previous && previous.zIndex !== layer.zIndex) {
      await updateContextualLayerPrefs(projectId, layer.id, {
        zIndex: layer.zIndex,
      });
    }
  }
}

export type ContextualLayerDownloadProgress = {
  /** 0–1 across every layer in this download. */
  completion: number;
  assetId?: string;
};

type DownloadContextualLayersArgs = {
  serverUrl: string;
  token: string;
  projectId: string;
  layers: ContextualLayerListing[];
  onProgress?: (progress: ContextualLayerDownloadProgress) => void;
  /** Abort in-flight fetches and stop the batch. Native `downloadFile` is raced. */
  signal?: AbortSignal;
};

/**
 * Thrown when {@link downloadContextualLayers} is aborted via `signal`.
 */
export class ContextualLayerDownloadCancelledError extends Error {
  constructor() {
    super('Map layer download cancelled.');
    this.name = 'ContextualLayerDownloadCancelledError';
  }
}

/** Type guard for cancellation during contextual layer downloads. */
export function isContextualLayerDownloadCancelledError(
  error: unknown
): error is ContextualLayerDownloadCancelledError {
  return error instanceof ContextualLayerDownloadCancelledError;
}

/** True when `fetch` (or an AbortController) aborted the transfer. */
function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

/** Throw the download-cancelled error if `signal` has already aborted. */
function throwIfDownloadCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new ContextualLayerDownloadCancelledError();
  }
}

/** Rejects when `signal` aborts. Hangs forever when no signal is passed. */
function whenDownloadCancelled(signal?: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    /** Reject the waiter with the download-cancelled error. */
    const cancel = () => {
      reject(new ContextualLayerDownloadCancelledError());
    };
    if (!signal) {
      return;
    }
    if (signal.aborted) {
      cancel();
      return;
    }
    signal.addEventListener('abort', cancel, {once: true});
  });
}

/** Map a thrown download failure to a user-facing error, or cancellation. */
function asLayerDownloadError(error: unknown, layerName: string): Error {
  if (isContextualLayerDownloadCancelledError(error) || isAbortError(error)) {
    return new ContextualLayerDownloadCancelledError();
  }
  if (error instanceof Error && error.message.startsWith('Could not')) {
    return error;
  }
  return new Error(`Could not download ${layerName}.`);
}

/**
 * Stream the presigned object straight to disk.
 * ADB live-reload enables CapacitorHttp, which intercepts `fetch` and
 * JSON-parses the whole body on the Android main thread. A large GeoJSON
 * then OOMs the 256MB Java heap inside MessageHandler.postMessage.
 */
async function ensureNativeMapAssetsDir(): Promise<void> {
  try {
    await Filesystem.mkdir({
      path: 'map-assets',
      directory: Directory.Data,
      recursive: true,
    });
  } catch {
    // Already exists, or a later downloadFile will surface a real error.
  }
}

/**
 * Stream a presigned URL onto the native Data directory with progress
 * events. Ensures `map-assets/` exists first (Android will not mkdir).
 */
async function downloadNativeLayerFile(
  url: string,
  filename: string,
  expectedBytes: number,
  onReceived: (received: number, total: number) => void
): Promise<void> {
  // Android's legacy downloadFile opens the destination without mkdir,
  // so recursive:true on downloadFile is not enough for a missing folder.
  await ensureNativeMapAssetsDir();
  const handle = await Filesystem.addListener('progress', status => {
    if (status.url !== url) {
      return;
    }
    const total =
      status.contentLength > 0 ? status.contentLength : expectedBytes;
    onReceived(status.bytes, Math.max(total, status.bytes));
  });
  try {
    await Filesystem.downloadFile({
      url,
      path: `map-assets/${filename}`,
      directory: Directory.Data,
      recursive: true,
      progress: true,
    });
  } finally {
    await handle.remove();
  }
}

/**
 * Native `downloadFile` has no abort API. Race it so Cancel can unblock
 * the UI; delete the destination after the plugin call settles. Pass
 * `holdUntil` so the per-asset lock stays held across that delete.
 */
async function downloadNativeLayerFileUntilCancelled(
  url: string,
  filename: string,
  expectedBytes: number,
  onReceived: (received: number, total: number) => void,
  signal?: AbortSignal,
  holdUntil?: (work: Promise<unknown>) => void
): Promise<void> {
  throwIfDownloadCancelled(signal);
  const download = downloadNativeLayerFile(
    url,
    filename,
    expectedBytes,
    onReceived
  );
  if (!signal) {
    await download;
    return;
  }
  try {
    await Promise.race([download, whenDownloadCancelled(signal)]);
  } catch (error) {
    if (isContextualLayerDownloadCancelledError(error)) {
      const leftover = download
        .catch(() => undefined)
        .then(() => removeDeviceFile(filename));
      if (holdUntil) {
        holdUntil(leftover);
      } else {
        void leftover;
      }
    }
    throw error;
  }
}

/**
 * Download missing/updated layers and index them. Transfers run in parallel
 * across separate calls (and only serialize per asset); each layer's index
 * entry is committed under the file-index lock once its bytes are on disk.
 */
export async function downloadContextualLayers(
  args: DownloadContextualLayersArgs
): Promise<void> {
  return downloadAndIndexContextualLayers(args);
}

/**
 * Record one downloaded (or already stored) layer in the on-device index.
 * Runs under the file-index lock and starts from a fresh snapshot, so
 * parallel downloads of other layers are preserved. Returns the surveys to
 * notify: empty (everyone) when the filename changed, otherwise just this
 * survey. A replacement invalidates every survey's copy of the old file.
 */
async function indexDownloadedLayer(
  projectId: string,
  layer: ContextualLayerListing,
  filename: string
): Promise<string[] | undefined> {
  return runFileIndexMutation(async () => {
    const index = readIndex();
    const previous = index.files;
    const before = previous[layer.id];
    index.files = assignDownloadedLayer<StoredFile>(index.files, {
      assetId: layer.id,
      contentHash: layer.contentHash,
      kind: layer.kind,
      name: layer.name,
      byteSize: layer.byteSize,
      extent4326: layer.extent,
      extent3857: layer.extent3857,
      minZoom: layer.minZoom,
      maxZoom: layer.maxZoom,
      tileSize: layer.tileSize,
      defaultStyle: layer.defaultStyle,
      filename,
    });
    const projectPrefs = index.prefs[projectId] ?? {};
    if (!projectPrefs[layer.id]) {
      index.prefs[projectId] = {
        ...projectPrefs,
        [layer.id]: {
          ...prefsFor(index.files[layer.id], undefined, 0),
          zIndex: nextUnusedZIndex(projectPrefs),
        },
      };
    }
    await commitFiles(index, previous);
    return !before || before.filename !== filename ? undefined : [projectId];
  });
}

/**
 * Fetch each listing that is missing or whose `contentHash` changed,
 * write the file, and update the persisted index. Same-hash layers are
 * reused. Progress is reported as a 0–1 completion across the batch.
 */
async function downloadAndIndexContextualLayers({
  serverUrl,
  token,
  projectId,
  layers,
  onProgress,
  signal,
}: DownloadContextualLayersArgs): Promise<void> {
  throwIfDownloadCancelled(signal);
  const batchBytes = layers.reduce((sum, layer) => sum + layer.byteSize, 0);
  let completedBytes = 0;
  let lastPercent = -1;
  /** Batch 0–1 completion; percent ticks only, unless the last layer finishes. */
  const report = (
    assetId: string | undefined,
    currentReceived: number,
    currentTotal: number
  ) => {
    const current =
      currentTotal > 0 ? Math.min(currentTotal, currentReceived) : 0;
    const completion =
      batchBytes > 0
        ? Math.min(1, (completedBytes + current) / batchBytes)
        : currentReceived > 0
          ? 1
          : 0;
    const percent = Math.round(completion * 100);
    if (percent === lastPercent) {
      return;
    }
    lastPercent = percent;
    onProgress?.({completion, assetId});
  };
  report(undefined, 0, 0);
  for (const layer of layers) {
    throwIfDownloadCancelled(signal);
    // Layers within one batch still transfer one at a time; parallelism is
    // across batches (e.g. two individually started downloads). Only another
    // batch downloading this same asset makes this wait, and then the fresh
    // index check below reuses its copy instead of fetching it again.
    await runLayerDownloadExclusive(layer.id, async holdUntil => {
      throwIfDownloadCancelled(signal);
      const existing = readIndex().files[layer.id];
      const filename =
        existing && existing.contentHash === layer.contentHash
          ? existing.filename
          : filenameFor(layer);
      if (!existing || existing.contentHash !== layer.contentHash) {
        // Only the transfer itself holds a concurrency slot; waiting for a
        // slot (or for the index commit below) does not count against it.
        await acquireLayerTransferSlot(signal);
        inFlightFileWrites.add(filename);
        try {
          try {
            const grant = await fetch(
              `${serverUrl}/api/map-assets/${layer.id}/download-url`,
              {headers: {Authorization: `Bearer ${token}`}, signal}
            );
            if (!grant.ok) {
              throw new Error(`Could not download ${layer.name}.`);
            }
            const {url} =
              (await grant.json()) as GetMapAssetDownloadUrlResponse;
            if (!url) {
              throw new Error(`Could not download ${layer.name}.`);
            }
            throwIfDownloadCancelled(signal);
            if (Capacitor.isNativePlatform()) {
              await downloadNativeLayerFileUntilCancelled(
                url,
                filename,
                layer.byteSize,
                (received, total) => report(layer.id, received, total),
                signal,
                holdUntil
              );
            } else {
              const response = await fetch(url, {signal});
              if (!response.ok) {
                throw new Error(`Could not download ${layer.name}.`);
              }
              const bytes = await readResponseBytes(response, {
                expectedBytes: layer.byteSize,
                onReceived: (received, total) =>
                  report(layer.id, received, total),
                signal,
              });
              throwIfDownloadCancelled(signal);
              await writeBrowserFile(filename, bytes);
            }
          } catch (error) {
            await removeDeviceFile(filename);
            throw asLayerDownloadError(error, layer.name);
          } finally {
            releaseLayerTransferSlot();
          }
          throwIfDownloadCancelled(signal);
          const touched = await indexDownloadedLayer(
            projectId,
            layer,
            filename
          );
          if (!touched) {
            notifyContextualLayersChanged();
          } else {
            for (const id of touched) {
              notifyContextualLayersChanged(id);
            }
          }
        } finally {
          inFlightFileWrites.delete(filename);
        }
      } else {
        const touched = await indexDownloadedLayer(projectId, layer, filename);
        if (!touched) {
          notifyContextualLayersChanged();
        } else {
          for (const id of touched) {
            notifyContextualLayersChanged(id);
          }
        }
      }
    });
    completedBytes += layer.byteSize;
    report(layer.id, 0, 0);
  }
}

/**
 * Publish a files snapshot, keep in-flight style edits, drop unused
 * prefs, and delete files the snapshot no longer names.
 */
async function commitFiles(
  snapshot: LayerIndex,
  previous: LayerIndex['files']
): Promise<void> {
  const latest = readIndex();
  latest.files = snapshot.files;
  // Keep style edits saved while this snapshot was being prepared.
  for (const [projectId, byAsset] of Object.entries(snapshot.prefs)) {
    const current = latest.prefs[projectId] ?? {};
    let merged = current;
    for (const [assetId, prefs] of Object.entries(byAsset)) {
      if (latest.files[assetId] && !current[assetId]) {
        if (merged === current) {
          merged = {...current};
        }
        merged[assetId] = prefs;
      }
    }
    if (merged !== current) {
      latest.prefs[projectId] = merged;
    }
  }
  dropUnusedPrefs(latest);
  writeIndex(latest);
  await Promise.all(
    filenamesToDelete(previous, snapshot.files).map(filename =>
      removeDeviceFile(filename)
    )
  );
  await deleteUnreferencedFiles(readIndex());
}

/**
 * Drop this survey from assets it no longer links.
 * A file shared with another active survey stays on disk.
 * Returns whether any file reference changed.
 */
function layerRefsChanged(
  previous: LayerIndex['files'],
  next: LayerIndex['files']
): boolean {
  const previousIds = Object.keys(previous);
  const nextIds = Object.keys(next);
  if (previousIds.length !== nextIds.length) {
    return true;
  }
  return nextIds.some(assetId => {
    const before = previous[assetId];
    const after = next[assetId];
    return !before || before.filename !== after.filename;
  });
}

/**
 * Keep only the ready listing ids for the whole device. Directory sync
 * passes the union of activated surveys' `contextualLayers`; ids omitted
 * because a replace is in progress are dropped until the new file is ready.
 * Skip this call when any listing field was omitted (attach failure) so a
 * glitch is not treated as unlink.
 */
export async function retainListedContextualLayers(
  listedAssetIds: readonly string[]
): Promise<boolean> {
  return runFileIndexMutation(async () => {
    const index = readIndex();
    const previous = index.files;
    index.files = retainListedLayers(previous, listedAssetIds);
    if (!layerRefsChanged(previous, index.files)) {
      await deleteUnreferencedFiles(index);
      return false;
    }
    await commitFiles(index, previous);
    return true;
  });
}

/**
 * Drop this survey's paint prefs and seen-listing hash. When `keepAssetIds`
 * is provided, also drop files no remaining survey lists. Omit it when the
 * remaining keep-set is unknown so a glitch does not delete shared files.
 */
export async function releaseContextualLayersForProject(
  projectId: string,
  keepAssetIds?: readonly string[]
): Promise<void> {
  return runFileIndexMutation(async () => {
    const index = readIndex();
    const previous = index.files;
    if (keepAssetIds) {
      index.files = retainListedLayers(previous, keepAssetIds);
    }
    delete index.prefs[projectId];
    delete index.seenHashByProject[projectId];
    dropUnusedPrefs(index);
    writeIndex(index);
    await Promise.all(
      filenamesToDelete(previous, index.files).map(filename =>
        removeDeviceFile(filename)
      )
    );
    await deleteUnreferencedFiles(readIndex());
  });
}

export type StoredContextualLayerSummary = {
  assetId: string;
  name: string;
  kind: ContextualLayerListing['kind'];
  byteSize: number;
  contentHash: string;
  extent4326: ContextualLayerListing['extent'];
};

/** Every contextual layer file currently stored on this device. */
export async function listStoredContextualLayers(): Promise<
  StoredContextualLayerSummary[]
> {
  const index = readIndex();
  return Object.values(index.files)
    .map(file => ({
      assetId: file.assetId,
      name: file.name,
      kind: file.kind,
      byteSize: file.byteSize,
      contentHash: file.contentHash,
      extent4326: file.extent4326,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * True when every listed layer already has a matching file on this device.
 * An empty listing is already satisfied.
 */
export function areContextualLayersOnDevice(
  layers: ReadonlyArray<{id: string; contentHash: string}>
): boolean {
  const storedById = new Map(
    Object.values(readIndex().files).map(file => [file.assetId, file])
  );
  return layers.every(
    layer => layerDeviceStatus(layer, storedById) === 'on-device'
  );
}

/** Delete one layer file even when several surveys reference it. */
export async function removeContextualLayerFromDevice(
  assetId: string
): Promise<void> {
  return runFileIndexMutation(async () => {
    const index = readIndex();
    const previous = index.files;
    const file = previous[assetId];
    if (!file) {
      return;
    }
    const {[assetId]: _removed, ...rest} = previous;
    index.files = rest;
    await commitFiles(index, previous);
    notifyContextualLayersChanged();
  });
}

export const CONTEXTUAL_LAYERS_CHANGED_EVENT = 'contextual-layers-changed';

/**
 * Broadcast that on-device layers changed. Omit `projectId` when every
 * survey that lists the file should reload.
 */
export function notifyContextualLayersChanged(projectId?: string): void {
  dispatchEvent(
    new CustomEvent(CONTEXTUAL_LAYERS_CHANGED_EVENT, {detail: {projectId}})
  );
}
