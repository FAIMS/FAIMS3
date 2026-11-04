// SPDX-License-Identifier: Apache-2.0
import {afterEach, describe, expect, it, vi} from 'vitest';
import {
  configureMapAssetPreviewCacheForTests,
  ensureMapAssetPreviewDownload,
  evictStaleMapAssetPreviewCache,
  getMapAssetPreviewState,
  isMapAssetPreviewCacheStale,
  MAP_ASSET_PREVIEW_CACHE_MAX_AGE_DAYS,
  mapAssetPreviewCacheKey,
  mapAssetPreviewPercent,
  mapAssetPreviewVersion,
  readPreviewResponseBytes,
  resetMapAssetPreviewCacheForTests,
  subscribeMapAssetPreview,
  type MapAssetPreviewPersist,
  type MapAssetPreviewState,
} from './map-asset-preview-cache';

const bytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {'Content-Type': 'application/json'},
  });
}

function chunkedResponse(data: Uint8Array, chunkSize: number): Response {
  let offset = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= data.byteLength) {
        controller.close();
        return;
      }
      const end = Math.min(offset + chunkSize, data.byteLength);
      controller.enqueue(data.subarray(offset, end));
      offset = end;
    },
  });
  return new Response(stream, {
    headers: {'Content-Length': String(data.byteLength)},
  });
}

function memoryPersist(): MapAssetPreviewPersist & {store: Map<string, Blob>} {
  const store = new Map<string, Blob>();
  return {
    store,
    async get(assetId, version) {
      return store.get(mapAssetPreviewCacheKey(assetId, version));
    },
    async set(assetId, version, blob) {
      store.set(mapAssetPreviewCacheKey(assetId, version), blob);
    },
    async evictStale() {},
  };
}

function grantAndFileFetch(file = bytes) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/download-url')) {
      return jsonResponse({
        url: 'https://files.example/layer.pmtiles',
        mediaType: 'application/vnd.pmtiles',
        filename: 'layer.pmtiles',
        byteSize: file.byteLength,
        expiresInSeconds: 60,
      });
    }
    return chunkedResponse(file, 3);
  });
}

describe('map asset preview cache helpers', () => {
  it('prefers contentHash and falls back to revision metadata', () => {
    expect(
      mapAssetPreviewVersion({
        contentHash: 'abc',
        updatedAt: 9,
        byteSize: 12,
        _rev: '1',
      })
    ).toBe('abc');
    expect(
      mapAssetPreviewVersion({updatedAt: 9, byteSize: 12, _rev: '1'})
    ).toBe('9:12:1');
  });

  it('returns a percent only when the size is known', () => {
    expect(
      mapAssetPreviewPercent({
        status: 'downloading',
        receivedBytes: 25,
        totalBytes: 100,
        fromCache: false,
      })
    ).toBe(25);
    expect(
      mapAssetPreviewPercent({
        status: 'downloading',
        receivedBytes: 10,
        totalBytes: 0,
        fromCache: false,
      })
    ).toBeUndefined();
  });

  it('treats missing or expired stored-at as stale', () => {
    const now = 10 * 24 * 60 * 60 * 1000;
    const maxAge = MAP_ASSET_PREVIEW_CACHE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
    expect(isMapAssetPreviewCacheStale(undefined, now)).toBe(true);
    expect(isMapAssetPreviewCacheStale(Number.NaN, now)).toBe(true);
    expect(isMapAssetPreviewCacheStale(now - maxAge - 1, now)).toBe(true);
    expect(isMapAssetPreviewCacheStale(now - maxAge, now)).toBe(false);
    expect(isMapAssetPreviewCacheStale(now, now)).toBe(false);
    expect(MAP_ASSET_PREVIEW_CACHE_MAX_AGE_DAYS).toBe(5);
  });
});

describe('readPreviewResponseBytes', () => {
  it('reports chunk progress from the body stream', async () => {
    const updates: Array<[number, number]> = [];
    const blob = await readPreviewResponseBytes(
      chunkedResponse(bytes, 3),
      bytes.byteLength,
      (received, total) => updates.push([received, total])
    );
    expect(blob.size).toBe(bytes.byteLength);
    expect(updates).toEqual([
      [3, 8],
      [6, 8],
      [8, 8],
      [8, 8],
    ]);
  });

  it('uses the expected size when Content-Length is missing', async () => {
    const updates: Array<[number, number]> = [];
    const blob = await readPreviewResponseBytes(
      new Response(bytes),
      8,
      (received, total) => updates.push([received, total])
    );
    expect(blob.size).toBe(8);
    expect(updates.at(-1)).toEqual([8, 8]);
  });
});

describe('ensureMapAssetPreviewDownload', () => {
  afterEach(() => {
    resetMapAssetPreviewCacheForTests();
  });

  it('downloads once and reuses the blob for the same version', async () => {
    const persist = memoryPersist();
    const fetchMock = grantAndFileFetch();
    configureMapAssetPreviewCacheForTests({persist, fetch: fetchMock});

    const first = await ensureMapAssetPreviewDownload({
      assetId: 'asset-1',
      version: 'hash-a',
      byteSize: bytes.byteLength,
      token: 't',
      apiUrl: 'http://api',
    });
    const second = await ensureMapAssetPreviewDownload({
      assetId: 'asset-1',
      version: 'hash-a',
      byteSize: bytes.byteLength,
      token: 't',
      apiUrl: 'http://api',
    });

    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(persist.store.get('asset-1:hash-a')?.size).toBe(bytes.byteLength);
    expect(getMapAssetPreviewState('asset-1:hash-a')).toMatchObject({
      status: 'ready',
      fromCache: false,
      receivedBytes: bytes.byteLength,
    });
  });

  it('joins an in-flight download instead of starting another', async () => {
    let finishFile: ((response: Response) => void) | undefined;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/download-url')) {
        return jsonResponse({
          url: 'https://files.example/layer.pmtiles',
          mediaType: 'application/vnd.pmtiles',
          filename: 'layer.pmtiles',
          byteSize: bytes.byteLength,
          expiresInSeconds: 60,
        });
      }
      return new Promise<Response>(resolve => {
        finishFile = resolve;
      });
    });
    configureMapAssetPreviewCacheForTests({
      persist: memoryPersist(),
      fetch: fetchMock,
    });

    const first = ensureMapAssetPreviewDownload({
      assetId: 'asset-1',
      version: 'hash-a',
      byteSize: bytes.byteLength,
      token: 't',
      apiUrl: 'http://api',
    });
    const second = ensureMapAssetPreviewDownload({
      assetId: 'asset-1',
      version: 'hash-a',
      byteSize: bytes.byteLength,
      token: 't',
      apiUrl: 'http://api',
    });
    await vi.waitFor(() => expect(finishFile).toBeDefined());
    expect(fetchMock).toHaveBeenCalledTimes(2);
    finishFile?.(chunkedResponse(bytes, 8));
    expect(await first).toBe(await second);
  });

  it('serves a persisted copy without hitting the network', async () => {
    const persist = memoryPersist();
    const cached = new Blob([bytes]);
    await persist.set('asset-1', 'hash-a', cached);
    const fetchMock = vi.fn();
    configureMapAssetPreviewCacheForTests({persist, fetch: fetchMock});

    const blob = await ensureMapAssetPreviewDownload({
      assetId: 'asset-1',
      version: 'hash-a',
      byteSize: bytes.byteLength,
      token: 't',
      apiUrl: 'http://api',
    });

    expect(blob).toBe(cached);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getMapAssetPreviewState('asset-1:hash-a').fromCache).toBe(true);
  });

  it('downloads again when the content hash changes', async () => {
    const persist = memoryPersist();
    const fetchMock = grantAndFileFetch();
    configureMapAssetPreviewCacheForTests({persist, fetch: fetchMock});

    await ensureMapAssetPreviewDownload({
      assetId: 'asset-1',
      version: 'hash-a',
      byteSize: bytes.byteLength,
      token: 't',
      apiUrl: 'http://api',
    });
    await ensureMapAssetPreviewDownload({
      assetId: 'asset-1',
      version: 'hash-b',
      byteSize: bytes.byteLength,
      token: 't',
      apiUrl: 'http://api',
    });

    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('notifies subscribers of download progress', async () => {
    const updates: MapAssetPreviewState[] = [];
    const fetchMock = grantAndFileFetch();
    configureMapAssetPreviewCacheForTests({
      persist: memoryPersist(),
      fetch: fetchMock,
    });
    const unsubscribe = subscribeMapAssetPreview('asset-1:hash-a', state =>
      updates.push(state)
    );

    await ensureMapAssetPreviewDownload({
      assetId: 'asset-1',
      version: 'hash-a',
      byteSize: bytes.byteLength,
      token: 't',
      apiUrl: 'http://api',
    });
    unsubscribe();

    expect(updates[0]?.status).toBe('downloading');
    expect(updates.some(state => state.receivedBytes === 3)).toBe(true);
    expect(updates.at(-1)).toMatchObject({
      status: 'ready',
      receivedBytes: bytes.byteLength,
    });
  });

  it('records a grant failure', async () => {
    configureMapAssetPreviewCacheForTests({
      persist: memoryPersist(),
      fetch: vi.fn(async () => jsonResponse({error: 'no'}, 403)),
    });

    await expect(
      ensureMapAssetPreviewDownload({
        assetId: 'asset-1',
        version: 'hash-a',
        byteSize: 8,
        token: 't',
        apiUrl: 'http://api',
      })
    ).rejects.toThrow('Could not download the layer for preview.');
    expect(getMapAssetPreviewState('asset-1:hash-a').status).toBe('error');
  });
});

describe('evictStaleMapAssetPreviewCache', () => {
  afterEach(() => {
    resetMapAssetPreviewCacheForTests();
  });

  it('drops persisted copies older than the max age and keeps fresh ones', async () => {
    const now = 10 * 24 * 60 * 60 * 1000;
    const maxAge = MAP_ASSET_PREVIEW_CACHE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
    const store = new Map<string, {blob: Blob; storedAt: number}>();
    const persist: MapAssetPreviewPersist = {
      async get(assetId, version) {
        return store.get(mapAssetPreviewCacheKey(assetId, version))?.blob;
      },
      async set(assetId, version, blob) {
        store.set(mapAssetPreviewCacheKey(assetId, version), {
          blob,
          storedAt: now,
        });
      },
      async evictStale(nowMs, maxAgeMs) {
        for (const [key, stored] of store) {
          if (isMapAssetPreviewCacheStale(stored.storedAt, nowMs, maxAgeMs)) {
            store.delete(key);
          }
        }
      },
    };
    store.set('asset-1:old', {
      blob: new Blob([bytes]),
      storedAt: now - maxAge - 1,
    });
    store.set('asset-1:fresh', {
      blob: new Blob([bytes]),
      storedAt: now - maxAge,
    });
    store.set('asset-1:unknown', {
      blob: new Blob([bytes]),
      storedAt: Number.NaN,
    });
    configureMapAssetPreviewCacheForTests({persist, now: () => now});

    await evictStaleMapAssetPreviewCache(now);

    expect(store.has('asset-1:old')).toBe(false);
    expect(store.has('asset-1:unknown')).toBe(false);
    expect(store.has('asset-1:fresh')).toBe(true);
  });
});
