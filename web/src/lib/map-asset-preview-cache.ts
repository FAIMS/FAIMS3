// SPDX-License-Identifier: Apache-2.0
/**
 * Session + Cache Storage for Control Centre map-layer previews.
 *
 * The Preview tab remounts when the user leaves it, and a replace writes a
 * new content hash. One in-flight download is shared, the blob is reused
 * until the hash changes, and Cache Storage keeps a copy across reloads.
 * Startup drops persisted copies older than
 * {@link MAP_ASSET_PREVIEW_CACHE_MAX_AGE_DAYS}.
 */

import type {GetMapAssetDownloadUrlResponse} from '@faims3/data-model';
import {readResponseBlob} from '@faims3/forms';

const PREVIEW_CACHE_NAME = 'faims-map-asset-previews-v1';
const PREVIEW_CACHE_ORIGIN = 'https://map-asset-preview.invalid';
const PREVIEW_CACHED_AT_HEADER = 'X-Faims-Cached-At';
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Persisted preview blobs older than this are dropped on startup. */
export const MAP_ASSET_PREVIEW_CACHE_MAX_AGE_DAYS = 5;

export type MapAssetPreviewStatus = 'idle' | 'downloading' | 'ready' | 'error';

export type MapAssetPreviewState = {
  status: MapAssetPreviewStatus;
  receivedBytes: number;
  totalBytes: number;
  fromCache: boolean;
  blob?: Blob;
  error?: string;
};

export type MapAssetPreviewPersist = {
  get(assetId: string, version: string): Promise<Blob | undefined>;
  set(assetId: string, version: string, blob: Blob): Promise<void>;
  evictStale(nowMs: number, maxAgeMs: number): Promise<void>;
};

type PreviewEntry = MapAssetPreviewState & {
  promise?: Promise<Blob>;
  lastNotifiedPercent: number;
  listeners: Set<(state: MapAssetPreviewState) => void>;
};

export const IDLE_MAP_ASSET_PREVIEW_STATE: MapAssetPreviewState = {
  status: 'idle',
  receivedBytes: 0,
  totalBytes: 0,
  fromCache: false,
};

const entries = new Map<string, PreviewEntry>();

let persist: MapAssetPreviewPersist = createCacheStoragePersist();
let fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis);
let nowImpl = () => Date.now();

/** Cache key for one ready layer version. */
export function mapAssetPreviewCacheKey(
  assetId: string,
  version: string
): string {
  return `${assetId}:${version}`;
}

/**
 * Prefer the normalized SHA-256. Fall back to revision metadata when a
 * ready layer has not stored a hash yet.
 */
export function mapAssetPreviewVersion(asset: {
  contentHash?: string;
  updatedAt: number;
  byteSize: number;
  _rev?: string;
}): string {
  if (asset.contentHash) {
    return asset.contentHash;
  }
  return `${asset.updatedAt}:${asset.byteSize}:${asset._rev ?? ''}`;
}

/** True when the stored timestamp is missing or older than the max age. */
export function isMapAssetPreviewCacheStale(
  storedAtMs: number | undefined,
  nowMs: number,
  maxAgeMs = MAP_ASSET_PREVIEW_CACHE_MAX_AGE_DAYS * MS_PER_DAY
): boolean {
  if (storedAtMs === undefined || !Number.isFinite(storedAtMs)) {
    return true;
  }
  return nowMs - storedAtMs > maxAgeMs;
}

/** Drop persisted preview files that have not been rewritten within the TTL. */
export async function evictStaleMapAssetPreviewCache(
  nowMs = nowImpl()
): Promise<void> {
  await persist
    .evictStale(nowMs, MAP_ASSET_PREVIEW_CACHE_MAX_AGE_DAYS * MS_PER_DAY)
    .catch(() => undefined);
}

/** 0–100 while bytes are arriving; undefined when the size is unknown. */
export function mapAssetPreviewPercent(
  state: MapAssetPreviewState
): number | undefined {
  if (state.totalBytes <= 0) {
    return undefined;
  }
  return Math.min(
    100,
    Math.round((state.receivedBytes / state.totalBytes) * 100)
  );
}

/** Public snapshot for a key, or idle when nothing has started. */
export function getMapAssetPreviewState(
  cacheKey: string
): MapAssetPreviewState {
  return snapshot(entries.get(cacheKey));
}

/** Subscribe to progress for one layer version. */
export function subscribeMapAssetPreview(
  cacheKey: string,
  listener: (state: MapAssetPreviewState) => void
): () => void {
  const entry = getOrCreateEntry(cacheKey);
  entry.listeners.add(listener);
  return () => {
    entry.listeners.delete(listener);
    if (
      entry.listeners.size === 0 &&
      entry.status === 'idle' &&
      entry.promise === undefined
    ) {
      entries.delete(cacheKey);
    }
  };
}

/**
 * Return a cached blob, join an in-flight download, or start one.
 * Unmounting the Preview tab does not abort the transfer.
 */
export function ensureMapAssetPreviewDownload({
  assetId,
  version,
  byteSize,
  token,
  apiUrl,
}: {
  assetId: string;
  version: string;
  byteSize: number;
  token: string;
  apiUrl: string;
}): Promise<Blob> {
  const cacheKey = mapAssetPreviewCacheKey(assetId, version);
  const entry = getOrCreateEntry(cacheKey);
  if (entry.status === 'ready' && entry.blob) {
    return Promise.resolve(entry.blob);
  }
  if (entry.promise) {
    return entry.promise;
  }
  const promise = loadPreview({
    cacheKey,
    assetId,
    version,
    byteSize,
    token,
    apiUrl,
  });
  entry.promise = promise;
  return promise;
}

/** Read a response in chunks so the caller can show download progress. */
export async function readPreviewResponseBytes(
  response: Response,
  expectedBytes: number,
  onReceived: (received: number, total: number) => void
): Promise<Blob> {
  return readResponseBlob(response, {expectedBytes, onReceived});
}

export function configureMapAssetPreviewCacheForTests(options?: {
  persist?: MapAssetPreviewPersist;
  fetch?: typeof fetch;
  now?: () => number;
}): void {
  persist = options?.persist ?? createMemoryPreviewPersist();
  fetchImpl = options?.fetch ?? globalThis.fetch.bind(globalThis);
  nowImpl = options?.now ?? (() => Date.now());
}

export function resetMapAssetPreviewCacheForTests(): void {
  entries.clear();
  persist = createCacheStoragePersist();
  fetchImpl = globalThis.fetch.bind(globalThis);
  nowImpl = () => Date.now();
}

function snapshot(entry: PreviewEntry | undefined): MapAssetPreviewState {
  if (!entry) {
    return IDLE_MAP_ASSET_PREVIEW_STATE;
  }
  return {
    status: entry.status,
    receivedBytes: entry.receivedBytes,
    totalBytes: entry.totalBytes,
    fromCache: entry.fromCache,
    blob: entry.blob,
    error: entry.error,
  };
}

function evictOtherMemoryVersions(assetId: string, keepKey: string): void {
  const prefix = `${assetId}:`;
  for (const key of entries.keys()) {
    if (key.startsWith(prefix) && key !== keepKey) {
      entries.delete(key);
    }
  }
}

function getOrCreateEntry(cacheKey: string): PreviewEntry {
  const existing = entries.get(cacheKey);
  if (existing) {
    return existing;
  }
  const created: PreviewEntry = {
    ...IDLE_MAP_ASSET_PREVIEW_STATE,
    lastNotifiedPercent: -1,
    listeners: new Set(),
  };
  entries.set(cacheKey, created);
  return created;
}

function notify(
  cacheKey: string,
  patch: Partial<MapAssetPreviewState>,
  force = false
): void {
  const entry = getOrCreateEntry(cacheKey);
  Object.assign(entry, patch);
  const percent = mapAssetPreviewPercent(entry) ?? -1;
  if (
    !force &&
    entry.status === 'downloading' &&
    percent === entry.lastNotifiedPercent
  ) {
    return;
  }
  entry.lastNotifiedPercent = percent;
  const next = snapshot(entry);
  for (const listener of entry.listeners) {
    listener(next);
  }
}

async function loadPreview({
  cacheKey,
  assetId,
  version,
  byteSize,
  token,
  apiUrl,
}: {
  cacheKey: string;
  assetId: string;
  version: string;
  byteSize: number;
  token: string;
  apiUrl: string;
}): Promise<Blob> {
  evictOtherMemoryVersions(assetId, cacheKey);
  const entry = getOrCreateEntry(cacheKey);
  notify(
    cacheKey,
    {
      status: 'downloading',
      receivedBytes: 0,
      totalBytes: byteSize,
      fromCache: false,
      error: undefined,
      blob: undefined,
    },
    true
  );
  try {
    const cached = await persist.get(assetId, version).catch(() => undefined);
    if (cached && cached.size > 0) {
      notify(
        cacheKey,
        {
          status: 'ready',
          receivedBytes: cached.size,
          totalBytes: cached.size,
          fromCache: true,
          blob: cached,
          error: undefined,
        },
        true
      );
      entry.promise = undefined;
      return cached;
    }
    const blob = await downloadPreview({
      cacheKey,
      assetId,
      byteSize,
      token,
      apiUrl,
    });
    notify(
      cacheKey,
      {
        status: 'ready',
        receivedBytes: blob.size,
        totalBytes: blob.size,
        fromCache: false,
        blob,
        error: undefined,
      },
      true
    );
    entry.promise = undefined;
    void persist.set(assetId, version, blob).catch(() => undefined);
    return blob;
  } catch (loadError) {
    const message =
      loadError instanceof Error
        ? loadError.message
        : 'Could not download the layer for preview.';
    notify(
      cacheKey,
      {
        status: 'error',
        error: message,
        blob: undefined,
        fromCache: false,
      },
      true
    );
    entry.promise = undefined;
    throw loadError instanceof Error ? loadError : new Error(message);
  }
}

async function downloadPreview({
  cacheKey,
  assetId,
  byteSize,
  token,
  apiUrl,
}: {
  cacheKey: string;
  assetId: string;
  byteSize: number;
  token: string;
  apiUrl: string;
}): Promise<Blob> {
  const grant = await fetchImpl(
    `${apiUrl}/api/map-assets/${assetId}/download-url`,
    {headers: {Authorization: `Bearer ${token}`}}
  );
  if (!grant.ok) {
    throw new Error('Could not download the layer for preview.');
  }
  const body = (await grant.json()) as GetMapAssetDownloadUrlResponse;
  if (!body.url) {
    throw new Error('Could not download the layer for preview.');
  }
  const expectedBytes = body.byteSize > 0 ? body.byteSize : byteSize;
  notify(cacheKey, {totalBytes: expectedBytes}, true);
  const response = await fetchImpl(body.url);
  if (!response.ok) {
    throw new Error('Could not download the layer for preview.');
  }
  return readPreviewResponseBytes(response, expectedBytes, (received, total) =>
    notify(cacheKey, {receivedBytes: received, totalBytes: total})
  );
}

function previewRequest(assetId: string, version: string): Request {
  return new Request(
    `${PREVIEW_CACHE_ORIGIN}/${encodeURIComponent(assetId)}/${encodeURIComponent(version)}`
  );
}

function createMemoryPreviewPersist(): MapAssetPreviewPersist {
  const blobs = new Map<string, {blob: Blob; storedAt: number}>();
  return {
    async get(assetId, version) {
      const key = mapAssetPreviewCacheKey(assetId, version);
      const stored = blobs.get(key);
      if (!stored) {
        return undefined;
      }
      if (isMapAssetPreviewCacheStale(stored.storedAt, nowImpl())) {
        blobs.delete(key);
        return undefined;
      }
      return stored.blob;
    },
    async set(assetId, version, blob) {
      blobs.set(mapAssetPreviewCacheKey(assetId, version), {
        blob,
        storedAt: nowImpl(),
      });
    },
    async evictStale(nowMs, maxAgeMs) {
      for (const [key, stored] of blobs) {
        if (isMapAssetPreviewCacheStale(stored.storedAt, nowMs, maxAgeMs)) {
          blobs.delete(key);
        }
      }
    },
  };
}

function createCacheStoragePersist(): MapAssetPreviewPersist {
  return {
    async get(assetId, version) {
      const cache = await openPreviewCache();
      if (!cache) {
        return undefined;
      }
      const request = previewRequest(assetId, version);
      const match = await cache.match(request);
      if (!match) {
        return undefined;
      }
      if (isMapAssetPreviewCacheStale(cachedAtMs(match), nowImpl())) {
        await cache.delete(request);
        return undefined;
      }
      return match.blob();
    },
    async set(assetId, version, blob) {
      const cache = await openPreviewCache();
      if (!cache) {
        return;
      }
      await evictOtherVersions(cache, assetId, version);
      await cache.put(
        previewRequest(assetId, version),
        new Response(blob, {
          headers: {
            'Content-Type': blob.type || 'application/octet-stream',
            [PREVIEW_CACHED_AT_HEADER]: String(nowImpl()),
          },
        })
      );
    },
    async evictStale(nowMs, maxAgeMs) {
      const cache = await openPreviewCache();
      if (!cache) {
        return;
      }
      const keys = await cache.keys();
      await Promise.all(
        keys.map(async request => {
          const match = await cache.match(request);
          if (
            !match ||
            isMapAssetPreviewCacheStale(cachedAtMs(match), nowMs, maxAgeMs)
          ) {
            await cache.delete(request);
          }
        })
      );
    },
  };
}

function cachedAtMs(response: Response): number | undefined {
  const raw = response.headers.get(PREVIEW_CACHED_AT_HEADER);
  if (!raw) {
    return undefined;
  }
  const storedAt = Number(raw);
  return Number.isFinite(storedAt) ? storedAt : undefined;
}

async function openPreviewCache(): Promise<Cache | undefined> {
  if (typeof caches === 'undefined') {
    return undefined;
  }
  try {
    return await caches.open(PREVIEW_CACHE_NAME);
  } catch {
    return undefined;
  }
}

async function evictOtherVersions(
  cache: Cache,
  assetId: string,
  version: string
): Promise<void> {
  const prefix = `${PREVIEW_CACHE_ORIGIN}/${encodeURIComponent(assetId)}/`;
  const keep = previewRequest(assetId, version).url;
  const keys = await cache.keys();
  await Promise.all(
    keys
      .filter(request => request.url.startsWith(prefix) && request.url !== keep)
      .map(request => cache.delete(request))
  );
}
