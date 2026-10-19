// SPDX-License-Identifier: Apache-2.0
/**
 * On-device copies of normalized map layers, plus local paint preferences.
 * File bytes live in Capacitor Filesystem or the Origin Private File System.
 * The file index, style edits, and seen-listing hashes live in persisted Redux.
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
import {moveStackedLayer, readBlobRange} from '@faims3/forms';
import {
  readContextualLayersState,
  writeContextualLayersState,
  type ContextualLayerFile,
  type ContextualLayerPrefs,
  type ContextualLayersState,
} from '../../../context/slices/contextualLayersSlice';
import {
  assignDownloadedLayer,
  filenamesToDelete,
  releaseProjectLayers,
  retainListedLayers,
} from './contextualLayerIndex';
import {readNativeFileRange} from './mapFileRange';

type StoredFile = ContextualLayerFile;
type LayerPrefs = ContextualLayerPrefs;
type LayerIndex = ContextualLayersState;

function readIndex(): LayerIndex {
  return readContextualLayersState();
}

function writeIndex(index: LayerIndex): void {
  writeContextualLayersState(index);
}

/**
 * One writer at a time for the on-device files map. Downloads, directory
 * retain, release, and remove all replace `files` from a snapshot; overlapping
 * them drops other surveys' entries, then deleteUnreferencedFiles removes those
 * files from disk. Style edits stay outside this lock.
 */
function createAsyncMutex() {
  let mutex = Promise.resolve();
  return async function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const prev = mutex;
    let resolveNext!: () => void;
    mutex = new Promise<void>(r => {
      resolveNext = r;
    });
    await prev.catch(() => {});
    try {
      return await fn();
    } finally {
      resolveNext();
    }
  };
}

const runFileIndexMutation = createAsyncMutex();

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
      .filter(filename => !referenced.has(filename))
      .map(filename => removeDeviceFile(filename))
  );
}

function dropUnusedPrefs(index: LayerIndex): void {
  for (const assetId of Object.keys(index.prefs)) {
    if (!index.files[assetId]) {
      delete index.prefs[assetId];
    }
  }
}

function filenameFor(layer: ContextualLayerListing): string {
  return `${layer.id}-${layer.contentHash}.${normalizedMapAssetExtension(layer.kind)}`;
}

/**
 * Range reader for one stored archive. The browser slices the OPFS file.
 * Android and iOS seek through MapFileRange.
 */
async function bindStoredLayerReader(filename: string): Promise<TileByteRead> {
  if (Capacitor.isNativePlatform()) {
    return (offset, length) =>
      readNativeFileRange(`map-assets/${filename}`, offset, length);
  }
  const root = await navigator.storage.getDirectory();
  const dir = await root.getDirectoryHandle('map-assets');
  const handle = await dir.getFileHandle(filename);
  const file = await handle.getFile();
  return (offset, length) => readBlobRange(file, offset, length);
}

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
    labelField: file.defaultStyle.labelField,
  };
  if (!prefs) {
    return fallback;
  }
  return {
    ...prefs,
    zIndex: Number.isFinite(prefs.zIndex) ? prefs.zIndex : fallback.zIndex,
  };
}

function storeLayerPrefs(prefs: LayerPrefs): LayerPrefs {
  if (!prefs.labelField) {
    const {labelField: _labelField, ...rest} = prefs;
    return rest;
  }
  return prefs;
}

/**
 * Restore this survey's downloaded overlays to file defaults and the
 * original asset-id stack. Returns the prefs applied so the panel can
 * update before the listing reloads.
 */
export function resetContextualLayerPrefs(
  projectId: string
): Record<string, LayerPrefs> {
  const index = readIndex();
  const files = Object.values(index.files)
    .filter(file => file.projectIds.includes(projectId))
    .sort((a, b) => a.assetId.localeCompare(b.assetId));
  const nextPrefs: Record<string, LayerPrefs> = {};
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const prefs = storeLayerPrefs(prefsFor(file, undefined, i));
    index.prefs[file.assetId] = prefs;
    nextPrefs[file.assetId] = prefs;
  }
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
    labelField: prefs.labelField,
  };
}

export async function getSeenContextualLayersHash(
  projectId: string
): Promise<string | undefined> {
  return readIndex().seenHashByProject[projectId];
}

export async function markContextualLayersSeen(
  projectId: string,
  hash: string
): Promise<void> {
  const index = readIndex();
  index.seenHashByProject[projectId] = hash;
  writeIndex(index);
}

/** Layers downloaded for this survey, in stack order. */
export async function contextualLayersForMap(
  projectId: string
): Promise<ContextualMapLayer[]> {
  const index = readIndex();
  const files = Object.values(index.files).filter(file =>
    file.projectIds.includes(projectId)
  );
  files.sort((a, b) => a.assetId.localeCompare(b.assetId));
  const layers: ContextualMapLayer[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const prefs = prefsFor(file, index.prefs[file.assetId], i);
    layers.push(await layerFromFile(file, prefs, prefs.visible));
  }
  // URI work above is slow on Android. Re-read paint so a raise that
  // landed while we waited is not returned as the old stack.
  const latestPrefs = readIndex().prefs;
  return layers
    .map(layer => {
      const prefs = latestPrefs[layer.id];
      return prefs ? applyStoredPrefs(layer, prefs) : layer;
    })
    .sort((a, b) => a.zIndex - b.zIndex);
}

/** One stored layer, including its file URL, for a static preview. */
export async function loadStoredContextualLayer(
  assetId: string
): Promise<ContextualMapLayer | undefined> {
  const index = readIndex();
  const file = index.files[assetId];
  if (!file) {
    return undefined;
  }
  const prefs = prefsFor(file, index.prefs[file.assetId], 0);
  return layerFromFile(file, prefs, true);
}

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
    labelField: prefs.labelField,
    extent4326: file.extent4326,
    extent3857: file.extent3857,
    minZoom: file.minZoom,
    maxZoom: file.maxZoom,
    tileSize: file.tileSize,
  };
}

export async function updateContextualLayerPrefs(
  assetId: string,
  patch: Partial<LayerPrefs>
): Promise<void> {
  const index = readIndex();
  const file = index.files[assetId];
  if (!file) {
    return;
  }
  const current = prefsFor(file, index.prefs[assetId], 0);
  index.prefs[assetId] = {...current, ...patch};
  if (!index.prefs[assetId].labelField) {
    delete index.prefs[assetId].labelField;
  }
  writeIndex(index);
}

export async function moveContextualLayer(
  projectId: string,
  assetId: string,
  direction: 'up' | 'down'
): Promise<void> {
  const layers = await contextualLayersForMap(projectId);
  const next = moveStackedLayer(layers, assetId, direction);
  if (next === layers) {
    return;
  }
  for (const layer of next) {
    const previous = layers.find(item => item.id === layer.id);
    if (previous && previous.zIndex !== layer.zIndex) {
      await updateContextualLayerPrefs(layer.id, {zIndex: layer.zIndex});
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
};

/**
 * Read a response body in chunks so the caller can show download progress.
 * Falls back to the full buffer when the body stream is unavailable.
 */
async function readResponseBytes(
  response: Response,
  expectedBytes: number,
  onReceived: (received: number, total: number) => void
): Promise<Uint8Array> {
  const headerLength = Number(response.headers.get('Content-Length'));
  const total =
    Number.isFinite(headerLength) && headerLength > 0
      ? headerLength
      : expectedBytes;
  const reader = response.body?.getReader();
  if (!reader) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    onReceived(bytes.byteLength, Math.max(total, bytes.byteLength));
    return bytes;
  }
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const {done, value} = await reader.read();
    if (done) {
      break;
    }
    if (!value) {
      continue;
    }
    chunks.push(value);
    received += value.byteLength;
    onReceived(received, Math.max(total, received));
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
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

export async function downloadContextualLayers(
  args: DownloadContextualLayersArgs
): Promise<void> {
  return runFileIndexMutation(() => downloadAndIndexContextualLayers(args));
}

async function downloadAndIndexContextualLayers({
  serverUrl,
  token,
  projectId,
  layers,
  onProgress,
}: DownloadContextualLayersArgs): Promise<void> {
  const index = readIndex();
  const previous = index.files;
  const batchBytes = layers.reduce((sum, layer) => sum + layer.byteSize, 0);
  let completedBytes = 0;
  let lastPercent = -1;
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
    const existing = index.files[layer.id];
    const filename =
      existing && existing.contentHash === layer.contentHash
        ? existing.filename
        : filenameFor(layer);
    if (!existing || existing.contentHash !== layer.contentHash) {
      const grant = await fetch(
        `${serverUrl}/api/map-assets/${layer.id}/download-url`,
        {headers: {Authorization: `Bearer ${token}`}}
      );
      if (!grant.ok) {
        throw new Error(`Could not download ${layer.name}.`);
      }
      const {url} = (await grant.json()) as GetMapAssetDownloadUrlResponse;
      if (!url) {
        throw new Error(`Could not download ${layer.name}.`);
      }
      try {
        if (Capacitor.isNativePlatform()) {
          await downloadNativeLayerFile(
            url,
            filename,
            layer.byteSize,
            (received, total) => report(layer.id, received, total)
          );
        } else {
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`Could not download ${layer.name}.`);
          }
          const bytes = await readResponseBytes(
            response,
            layer.byteSize,
            (received, total) => report(layer.id, received, total)
          );
          await writeBrowserFile(filename, bytes);
        }
      } catch (error) {
        await removeDeviceFile(filename);
        if (error instanceof Error && error.message.startsWith('Could not')) {
          throw error;
        }
        throw new Error(`Could not download ${layer.name}.`);
      }
    }
    completedBytes += layer.byteSize;
    report(layer.id, 0, 0);
    index.files = assignDownloadedLayer<StoredFile>(index.files, projectId, {
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
      projectIds: [projectId],
    });
    if (!index.prefs[layer.id]) {
      index.prefs[layer.id] = {
        ...prefsFor(index.files[layer.id], undefined, 0),
        zIndex: nextUnusedZIndex(index.prefs),
      };
    }
  }
  await commitFiles(index, previous);
  const touched = new Set<string>([projectId]);
  for (const file of Object.values(index.files)) {
    const before = previous[file.assetId];
    if (!before || before.filename !== file.filename) {
      for (const id of file.projectIds) {
        touched.add(id);
      }
    }
  }
  for (const id of touched) {
    notifyContextualLayersChanged(id);
  }
}

async function commitFiles(
  snapshot: LayerIndex,
  previous: LayerIndex['files']
): Promise<void> {
  const latest = readIndex();
  latest.files = snapshot.files;
  // Keep style edits saved while this snapshot was being prepared.
  for (const [assetId, prefs] of Object.entries(snapshot.prefs)) {
    if (latest.files[assetId] && !latest.prefs[assetId]) {
      latest.prefs[assetId] = prefs;
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
    return (
      !before ||
      before.filename !== after.filename ||
      before.projectIds.join('\0') !== after.projectIds.join('\0')
    );
  });
}

/**
 * Keep only the ready listing ids for this survey. Directory sync passes
 * `contextualLayers` here; ids omitted because a replace is in progress are
 * dropped until the new file is ready. Skip this call when the listing fields
 * were omitted (attach failure) so a glitch is not treated as unlink.
 */
export async function retainListedContextualLayers(
  projectId: string,
  listedAssetIds: string[]
): Promise<boolean> {
  return runFileIndexMutation(async () => {
    const index = readIndex();
    const previous = index.files;
    index.files = retainListedLayers(previous, projectId, listedAssetIds);
    if (!layerRefsChanged(previous, index.files)) {
      await deleteUnreferencedFiles(index);
      return false;
    }
    await commitFiles(index, previous);
    return true;
  });
}

/** Remove this survey from layers the user did not keep. */
export async function forgetUnselectedContextualLayers(
  projectId: string,
  keepIds: string[]
): Promise<void> {
  await retainListedContextualLayers(projectId, keepIds);
}

/** Drop this survey's reference. Delete the file when no survey still uses it. */
export async function releaseContextualLayersForProject(
  projectId: string
): Promise<void> {
  return runFileIndexMutation(async () => {
    const index = readIndex();
    const previous = index.files;
    const next = releaseProjectLayers(index.files, projectId);
    index.files = next;
    delete index.seenHashByProject[projectId];
    dropUnusedPrefs(index);
    writeIndex(index);
    await Promise.all(
      filenamesToDelete(previous, next).map(filename =>
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
  projectIds: string[];
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
      projectIds: [...file.projectIds],
      extent4326: file.extent4326,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
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
    for (const projectId of file.projectIds) {
      notifyContextualLayersChanged(projectId);
    }
  });
}

export const CONTEXTUAL_LAYERS_CHANGED_EVENT = 'contextual-layers-changed';

export function notifyContextualLayersChanged(projectId: string): void {
  dispatchEvent(
    new CustomEvent(CONTEXTUAL_LAYERS_CHANGED_EVENT, {detail: {projectId}})
  );
}
