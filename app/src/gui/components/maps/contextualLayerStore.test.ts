// SPDX-License-Identifier: Apache-2.0
import {configureStore} from '@reduxjs/toolkit';
import {DEFAULT_MAP_ASSET_STYLE} from '@faims3/data-model';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import contextualLayersReducer, {
  bindContextualLayersStore,
  replaceContextualLayersState,
  type ContextualLayersState,
} from '../../../context/slices/contextualLayersSlice';

const native = vi.hoisted(() => ({
  isNative: false,
  downloadFile: vi.fn(),
  addListener: vi.fn(),
  deleteFile: vi.fn(),
  mkdir: vi.fn(),
  readdir: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => native.isNative,
    getPlatform: () => (native.isNative ? 'android' : 'web'),
    convertFileSrc: (uri: string) => uri,
  },
  registerPlugin: () => ({read: vi.fn()}),
}));

vi.mock('@capacitor/filesystem', () => ({
  Directory: {Data: 'DATA'},
  Filesystem: {
    downloadFile: (...args: unknown[]) => native.downloadFile(...args),
    addListener: (...args: unknown[]) => native.addListener(...args),
    deleteFile: (...args: unknown[]) => native.deleteFile(...args),
    mkdir: (...args: unknown[]) => native.mkdir(...args),
    readdir: (...args: unknown[]) => native.readdir(...args),
    writeFile: vi.fn(),
    getUri: vi.fn(),
  },
}));

import {
  ContextualLayerDownloadCancelledError,
  downloadContextualLayers,
  isContextualLayerDownloadCancelledError,
  MAP_LAYER_DOWNLOAD_CONCURRENCY,
  loadStoredContextualLayer,
  resetContextualLayerPrefs,
  resetLayerDownloadExclusiveForTests,
  retainListedContextualLayers,
  updateContextualLayerPrefs,
} from './contextualLayerStore';

const seeded = (): ContextualLayersState => ({
  files: {
    layer: {
      assetId: 'layer',
      contentHash: 'hash',
      kind: 'vector-tiles',
      name: 'Boundary',
      byteSize: 10,
      extent4326: [0, 0, 1, 1],
      defaultStyle: {
        opacity: 1,
        stroke: '#1565c0',
        fill: '#1565c080',
        lineWidth: 2,
        pointSize: 6,
      },
      filename: 'layer-hash.pmtiles',
    },
  },
  prefs: {},
  seenHashByProject: {},
});

describe('updateContextualLayerPrefs', () => {
  let store: ReturnType<
    typeof configureStore<{contextualLayers: ContextualLayersState}>
  >;

  beforeEach(() => {
    native.isNative = false;
    store = configureStore({
      reducer: {contextualLayers: contextualLayersReducer},
      preloadedState: {contextualLayers: seeded()},
    });
    bindContextualLayersStore(store);
  });

  it('keeps every opacity edit, with the last one winning', async () => {
    await Promise.all(
      Array.from({length: 8}, (_, index) =>
        updateContextualLayerPrefs('survey', 'layer', {
          opacity: (index + 1) / 10,
        })
      )
    );

    expect(store.getState().contextualLayers.prefs.survey.layer.opacity).toBe(
      0.8
    );
  });

  it('keeps paint prefs per survey', async () => {
    await updateContextualLayerPrefs('survey-a', 'layer', {opacity: 0.3});
    await updateContextualLayerPrefs('survey-b', 'layer', {opacity: 0.9});

    expect(
      store.getState().contextualLayers.prefs['survey-a'].layer.opacity
    ).toBe(0.3);
    expect(
      store.getState().contextualLayers.prefs['survey-b'].layer.opacity
    ).toBe(0.9);
  });

  it('restores file defaults and the original asset-id stack', () => {
    store.dispatch(
      replaceContextualLayersState({
        files: {
          tracks: {
            ...seeded().files.layer,
            assetId: 'tracks',
            name: 'Tracks',
            filename: 'tracks-hash.pmtiles',
            defaultStyle: {
              opacity: 0.85,
              stroke: '#1565c0',
              fill: '#1565c040',
              lineWidth: 2,
              pointSize: 6,
            },
          },
          boundary: {
            ...seeded().files.layer,
            assetId: 'boundary',
            name: 'Boundary',
            filename: 'boundary-hash.pmtiles',
            defaultStyle: {
              opacity: 0.7,
              stroke: '#cb181d',
              fill: '#cb181d80',
              lineWidth: 3,
              pointSize: 8,
            },
          },
        },
        prefs: {
          survey: {
            tracks: {
              visible: false,
              opacity: 0.2,
              zIndex: 40,
              stroke: '#111111',
              fill: '#222222',
              lineWidth: 9,
              pointSize: 20,
            },
            boundary: {
              visible: false,
              opacity: 0.1,
              zIndex: 50,
              stroke: '#ffffff',
              fill: '#000000',
              lineWidth: 1,
              pointSize: 1,
            },
          },
        },
        seenHashByProject: {},
      })
    );

    expect(resetContextualLayerPrefs('survey', ['tracks', 'boundary'])).toEqual(
      {
        boundary: {
          visible: true,
          opacity: 0.7,
          zIndex: 10,
          stroke: '#cb181d',
          fill: '#cb181d80',
          lineWidth: 3,
          pointSize: 8,
        },
        tracks: {
          visible: true,
          opacity: 0.85,
          zIndex: 11,
          stroke: '#1565c0',
          fill: '#1565c040',
          lineWidth: 2,
          pointSize: 6,
        },
      }
    );
    expect(store.getState().contextualLayers.prefs).toEqual({
      survey: {
        boundary: {
          visible: true,
          opacity: 0.7,
          zIndex: 10,
          stroke: '#cb181d',
          fill: '#cb181d80',
          lineWidth: 3,
          pointSize: 8,
        },
        tracks: {
          visible: true,
          opacity: 0.85,
          zIndex: 11,
          stroke: '#1565c0',
          fill: '#1565c040',
          lineWidth: 2,
          pointSize: 6,
        },
      },
    });
  });

  it('drops layer metadata when the app store is reset', async () => {
    await updateContextualLayerPrefs('survey', 'layer', {
      opacity: 0.4,
      stroke: '#ff0000',
    });

    store.dispatch({type: 'RESET_STORE'});

    expect(store.getState().contextualLayers).toEqual({
      files: {},
      prefs: {},
      seenHashByProject: {},
    });
  });
});

describe('loadStoredContextualLayer', () => {
  beforeEach(() => {
    native.isNative = false;
    const store = configureStore({
      reducer: {contextualLayers: contextualLayersReducer},
      preloadedState: {
        contextualLayers: {
          ...seeded(),
          prefs: {
            survey: {
              layer: {
                visible: false,
                opacity: 0.2,
                zIndex: 40,
                stroke: '#111111',
                fill: '#222222',
                lineWidth: 9,
                pointSize: 20,
              },
            },
          },
        },
      },
    });
    bindContextualLayersStore(store);
    const file = new File(['tiles'], 'layer-hash.pmtiles');
    vi.stubGlobal('navigator', {
      ...navigator,
      storage: {
        getDirectory: async () => ({
          getDirectoryHandle: async () => ({
            getFileHandle: async () => ({
              getFile: async () => file,
            }),
          }),
        }),
      },
    });
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: () => 'blob:layer',
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads file-default paint for the preview, ignoring saved prefs', async () => {
    const layer = await loadStoredContextualLayer('layer');

    expect(layer).toMatchObject({
      id: 'layer',
      visible: true,
      opacity: 1,
      stroke: '#1565c0',
      fill: '#1565c080',
      lineWidth: 2,
      pointSize: 6,
    });
  });
});

describe('downloadContextualLayers on native', () => {
  const presigned =
    'http://localhost:9000/faims-map-assets/map-assets/asset-1/normalized';
  let store: ReturnType<
    typeof configureStore<{contextualLayers: ContextualLayersState}>
  >;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    resetLayerDownloadExclusiveForTests();
    native.isNative = true;
    native.downloadFile.mockReset().mockResolvedValue({path: 'map-assets'});
    native.addListener.mockReset().mockResolvedValue({remove: vi.fn()});
    native.deleteFile.mockReset().mockResolvedValue(undefined);
    native.mkdir.mockReset().mockResolvedValue(undefined);
    native.readdir.mockReset().mockResolvedValue({files: []});
    store = configureStore({
      reducer: {contextualLayers: contextualLayersReducer},
      preloadedState: {
        contextualLayers: {files: {}, prefs: {}, seenHashByProject: {}},
      },
    });
    bindContextualLayersStore(store);
    fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/download-url')) {
        return new Response(
          JSON.stringify({
            url: presigned,
            mediaType: 'application/vnd.pmtiles',
            filename: 'digital atlas.pmtiles',
            byteSize: 100,
            expiresInSeconds: 3600,
          }),
          {status: 200}
        );
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('streams the object to disk instead of fetching the file body', async () => {
    await downloadContextualLayers({
      serverUrl: 'http://localhost:8080',
      token: 'token',
      projectId: 'survey',
      layers: [
        {
          id: 'asset-1',
          name: 'Digital atlas',
          kind: 'vector-tiles',
          byteSize: 100,
          contentHash: 'hash-1',
          extent: [0, 0, 1, 1],
          defaultStyle: DEFAULT_MAP_ASSET_STYLE,
        },
      ],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      '/api/map-assets/asset-1/download-url'
    );
    expect(native.mkdir).toHaveBeenCalledWith({
      path: 'map-assets',
      directory: 'DATA',
      recursive: true,
    });
    expect(native.downloadFile).toHaveBeenCalledWith({
      url: presigned,
      path: 'map-assets/asset-1-hash-1.pmtiles',
      directory: 'DATA',
      recursive: true,
      progress: true,
    });
    expect(store.getState().contextualLayers.files['asset-1']?.filename).toBe(
      'asset-1-hash-1.pmtiles'
    );
  });

  it('still downloads when the map-assets folder already exists', async () => {
    native.mkdir.mockRejectedValue(new Error('Directory exists'));

    await downloadContextualLayers({
      serverUrl: 'http://localhost:8080',
      token: 'token',
      projectId: 'survey',
      layers: [
        {
          id: 'asset-1',
          name: 'Digital atlas',
          kind: 'vector-tiles',
          byteSize: 100,
          contentHash: 'hash-1',
          extent: [0, 0, 1, 1],
          defaultStyle: DEFAULT_MAP_ASSET_STYLE,
        },
      ],
    });

    expect(native.downloadFile).toHaveBeenCalled();
  });

  it('reports native download progress against the batch size', async () => {
    native.addListener.mockImplementation(async (_event, listener) => {
      native.downloadFile.mockImplementation(async () => {
        listener({url: presigned, bytes: 50, contentLength: 100});
        return {path: 'map-assets'};
      });
      return {remove: vi.fn()};
    });
    const onProgress = vi.fn();

    await downloadContextualLayers({
      serverUrl: 'http://localhost:8080',
      token: 'token',
      projectId: 'survey',
      layers: [
        {
          id: 'asset-1',
          name: 'Digital atlas',
          kind: 'vector-tiles',
          byteSize: 100,
          contentHash: 'hash-1',
          extent: [0, 0, 1, 1],
          defaultStyle: DEFAULT_MAP_ASSET_STYLE,
        },
      ],
      onProgress,
    });

    expect(onProgress).toHaveBeenCalledWith({
      completion: 0.5,
      assetId: 'asset-1',
    });
  });

  it('removes a partial file when the native download fails', async () => {
    native.downloadFile.mockRejectedValue(new Error('disk full'));

    await expect(
      downloadContextualLayers({
        serverUrl: 'http://localhost:8080',
        token: 'token',
        projectId: 'survey',
        layers: [
          {
            id: 'asset-1',
            name: 'Digital atlas',
            kind: 'vector-tiles',
            byteSize: 100,
            contentHash: 'hash-1',
            extent: [0, 0, 1, 1],
            defaultStyle: DEFAULT_MAP_ASSET_STYLE,
          },
        ],
      })
    ).rejects.toThrow('Could not download Digital atlas.');

    expect(native.deleteFile).toHaveBeenCalledWith({
      path: 'map-assets/asset-1-hash-1.pmtiles',
      directory: 'DATA',
    });
    expect(store.getState().contextualLayers.files).toEqual({});
  });

  it('downloads two surveys in parallel and keeps both', async () => {
    let releaseFirst!: () => void;
    const firstHeld = new Promise<void>(resolve => {
      releaseFirst = resolve;
    });
    let started = 0;
    native.downloadFile.mockImplementation(async () => {
      started += 1;
      if (started === 1) {
        await firstHeld;
      }
      return {path: 'map-assets'};
    });

    const first = downloadContextualLayers({
      serverUrl: 'http://localhost:8080',
      token: 'token',
      projectId: 'survey-a',
      layers: [
        {
          id: 'asset-a',
          name: 'Survey A',
          kind: 'vector-tiles',
          byteSize: 100,
          contentHash: 'hash-a',
          extent: [0, 0, 1, 1],
          defaultStyle: DEFAULT_MAP_ASSET_STYLE,
        },
      ],
    });
    await vi.waitFor(() => expect(started).toBe(1));

    const second = downloadContextualLayers({
      serverUrl: 'http://localhost:8080',
      token: 'token',
      projectId: 'survey-b',
      layers: [
        {
          id: 'asset-b',
          name: 'Survey B',
          kind: 'vector-tiles',
          byteSize: 100,
          contentHash: 'hash-b',
          extent: [0, 0, 1, 1],
          defaultStyle: DEFAULT_MAP_ASSET_STYLE,
        },
      ],
    });
    // The second transfer starts without waiting for the first to finish;
    // only their index commits serialize.
    await vi.waitFor(() => expect(started).toBe(2));

    releaseFirst();
    await Promise.all([first, second]);

    const files = store.getState().contextualLayers.files;
    expect(files['asset-a']?.filename).toBe('asset-a-hash-a.pmtiles');
    expect(files['asset-b']?.filename).toBe('asset-b-hash-b.pmtiles');
  });

  it('queues downloads beyond the concurrent transfer limit', async () => {
    const releases: Array<() => void> = [];
    let started = 0;
    let transferring = 0;
    let peak = 0;
    native.downloadFile.mockImplementation(async () => {
      started += 1;
      transferring += 1;
      peak = Math.max(peak, transferring);
      await new Promise<void>(resolve => {
        releases.push(resolve);
      });
      transferring -= 1;
      return {path: 'map-assets'};
    });

    const assetIds = ['asset-1', 'asset-2', 'asset-3', 'asset-4'];
    const downloads = assetIds.map((id, index) =>
      downloadContextualLayers({
        serverUrl: 'http://localhost:8080',
        token: 'token',
        projectId: `survey-${index}`,
        layers: [
          {
            id,
            name: `Layer ${index}`,
            kind: 'vector-tiles',
            byteSize: 100,
            contentHash: `hash-${index}`,
            extent: [0, 0, 1, 1],
            defaultStyle: DEFAULT_MAP_ASSET_STYLE,
          },
        ],
      })
    );

    await vi.waitFor(() =>
      expect(started).toBe(MAP_LAYER_DOWNLOAD_CONCURRENCY)
    );
    expect(peak).toBe(MAP_LAYER_DOWNLOAD_CONCURRENCY);

    // Freeing one slot admits exactly the queued transfer.
    releases[0]();
    await vi.waitFor(() => expect(started).toBe(assetIds.length));
    expect(peak).toBe(MAP_LAYER_DOWNLOAD_CONCURRENCY);

    for (const release of releases) {
      release();
    }
    await Promise.all(downloads);
    expect(Object.keys(store.getState().contextualLayers.files)).toHaveLength(
      assetIds.length
    );
  });

  it('cancels a download waiting for a transfer slot', async () => {
    let releaseHeld!: () => void;
    const held = new Promise<void>(resolve => {
      releaseHeld = resolve;
    });
    let started = 0;
    native.downloadFile.mockImplementation(async () => {
      started += 1;
      await held;
      return {path: 'map-assets'};
    });

    const layerFor = (id: string) => ({
      id,
      name: id,
      kind: 'vector-tiles' as const,
      byteSize: 100,
      contentHash: `hash-${id}`,
      extent: [0, 0, 1, 1] as [number, number, number, number],
      defaultStyle: DEFAULT_MAP_ASSET_STYLE,
    });
    const running = Array.from(
      {length: MAP_LAYER_DOWNLOAD_CONCURRENCY},
      (_, i) =>
        downloadContextualLayers({
          serverUrl: 'http://localhost:8080',
          token: 'token',
          projectId: `survey-${i}`,
          layers: [layerFor(`asset-${i}`)],
        })
    );
    await vi.waitFor(() =>
      expect(started).toBe(MAP_LAYER_DOWNLOAD_CONCURRENCY)
    );

    const controller = new AbortController();
    const queued = downloadContextualLayers({
      serverUrl: 'http://localhost:8080',
      token: 'token',
      projectId: 'survey-queued',
      signal: controller.signal,
      layers: [layerFor('asset-queued')],
    });
    // Let the queued download reach the transfer-slot wait before cancelling.
    await new Promise(resolve => setTimeout(resolve, 0));
    controller.abort();

    await expect(queued).rejects.toBeInstanceOf(
      ContextualLayerDownloadCancelledError
    );
    expect(started).toBe(MAP_LAYER_DOWNLOAD_CONCURRENCY);

    releaseHeld();
    await Promise.all(running);
  });

  it('does not garbage-collect an in-flight download from another survey', async () => {
    store.dispatch(
      replaceContextualLayersState({
        files: {
          'asset-b': {
            assetId: 'asset-b',
            contentHash: 'hash-b',
            kind: 'vector-tiles',
            name: 'Survey B',
            byteSize: 100,
            extent4326: [0, 0, 1, 1],
            defaultStyle: DEFAULT_MAP_ASSET_STYLE,
            filename: 'asset-b-hash-b.pmtiles',
          },
        },
        prefs: {},
        seenHashByProject: {},
      })
    );
    native.readdir.mockResolvedValue({
      files: [
        {name: 'asset-a-hash-a.pmtiles'},
        {name: 'asset-b-hash-b.pmtiles'},
      ],
    });
    let releaseDownload!: () => void;
    const downloadHeld = new Promise<void>(resolve => {
      releaseDownload = resolve;
    });
    native.downloadFile.mockImplementation(async () => {
      await downloadHeld;
      return {path: 'map-assets'};
    });

    const download = downloadContextualLayers({
      serverUrl: 'http://localhost:8080',
      token: 'token',
      projectId: 'survey-a',
      layers: [
        {
          id: 'asset-a',
          name: 'Survey A',
          kind: 'vector-tiles',
          byteSize: 100,
          contentHash: 'hash-a',
          extent: [0, 0, 1, 1],
          defaultStyle: DEFAULT_MAP_ASSET_STYLE,
        },
      ],
    });
    await vi.waitFor(() => expect(native.downloadFile).toHaveBeenCalled());

    const retain = retainListedContextualLayers(['asset-b']);
    await Promise.resolve();
    expect(native.deleteFile).not.toHaveBeenCalled();

    releaseDownload();
    await Promise.all([download, retain]);

    const files = store.getState().contextualLayers.files;
    expect(files['asset-a']?.filename).toBe('asset-a-hash-a.pmtiles');
    expect(files['asset-b']?.filename).toBe('asset-b-hash-b.pmtiles');
    expect(native.deleteFile).not.toHaveBeenCalled();
  });

  it('unblocks a hung native download when the signal is aborted', async () => {
    native.downloadFile.mockImplementation(() => new Promise(() => {}));
    const controller = new AbortController();
    const download = downloadContextualLayers({
      serverUrl: 'http://localhost:8080',
      token: 'token',
      projectId: 'survey',
      signal: controller.signal,
      layers: [
        {
          id: 'asset-1',
          name: 'Digital atlas',
          kind: 'vector-tiles',
          byteSize: 100,
          contentHash: 'hash-1',
          extent: [0, 0, 1, 1],
          defaultStyle: DEFAULT_MAP_ASSET_STYLE,
        },
      ],
    });
    await vi.waitFor(() => expect(native.downloadFile).toHaveBeenCalled());
    controller.abort();

    await expect(download).rejects.toSatisfy(
      (error: unknown) =>
        isContextualLayerDownloadCancelledError(error) &&
        error.message === 'Map layer download cancelled.'
    );
    expect(store.getState().contextualLayers.files).toEqual({});
  });

  it('does not delete a retried native file after a cancelled download settles', async () => {
    let finishCancelledDownload!: () => void;
    const cancelledDownloadHeld = new Promise<void>(resolve => {
      finishCancelledDownload = resolve;
    });
    let started = 0;
    let finishedDownloads = 0;
    native.downloadFile.mockImplementation(async () => {
      started += 1;
      if (started === 1) {
        await cancelledDownloadHeld;
      }
      finishedDownloads += 1;
      return {path: 'map-assets'};
    });
    const deleteAfterRetryFinished: string[] = [];
    native.deleteFile.mockImplementation(async ({path}: {path: string}) => {
      if (finishedDownloads >= 2) {
        deleteAfterRetryFinished.push(path);
      }
    });

    const layer = {
      id: 'asset-1',
      name: 'Digital atlas',
      kind: 'vector-tiles' as const,
      byteSize: 100,
      contentHash: 'hash-1',
      extent: [0, 0, 1, 1] as [number, number, number, number],
      defaultStyle: DEFAULT_MAP_ASSET_STYLE,
    };
    const controller = new AbortController();
    const cancelled = downloadContextualLayers({
      serverUrl: 'http://localhost:8080',
      token: 'token',
      projectId: 'survey',
      signal: controller.signal,
      layers: [layer],
    });
    await vi.waitFor(() => expect(started).toBe(1));
    controller.abort();
    await expect(cancelled).rejects.toBeInstanceOf(
      ContextualLayerDownloadCancelledError
    );

    const retry = downloadContextualLayers({
      serverUrl: 'http://localhost:8080',
      token: 'token',
      projectId: 'survey',
      layers: [layer],
    });
    // The cancelled plugin call still holds the per-asset lock, so a
    // retry must not start writing the same {assetId}-{hash}.pmtiles.
    await Promise.resolve();
    await Promise.resolve();
    expect(started).toBe(1);

    finishCancelledDownload();
    await retry;

    expect(started).toBe(2);
    expect(deleteAfterRetryFinished).toEqual([]);
    expect(store.getState().contextualLayers.files['asset-1']?.filename).toBe(
      'asset-1-hash-1.pmtiles'
    );
  });
});

describe('downloadContextualLayers cancellation in the browser', () => {
  let store: ReturnType<
    typeof configureStore<{contextualLayers: ContextualLayersState}>
  >;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    resetLayerDownloadExclusiveForTests();
    native.isNative = false;
    native.deleteFile.mockReset().mockResolvedValue(undefined);
    native.readdir.mockReset().mockResolvedValue({files: []});
    store = configureStore({
      reducer: {contextualLayers: contextualLayersReducer},
      preloadedState: {
        contextualLayers: {files: {}, prefs: {}, seenHashByProject: {}},
      },
    });
    bindContextualLayersStore(store);
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('navigator', {
      ...navigator,
      storage: {
        getDirectory: async () => ({
          getDirectoryHandle: async () => ({
            removeEntry: async () => undefined,
            keys: async function* () {},
          }),
        }),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws a cancel error instead of wrapping abort as a download failure', async () => {
    const controller = new AbortController();
    fetchMock.mockImplementation(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.signal?.aborted) {
          const error = new Error('The operation was aborted.');
          error.name = 'AbortError';
          throw error;
        }
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => {
              const error = new Error('The operation was aborted.');
              error.name = 'AbortError';
              reject(error);
            },
            {once: true}
          );
        });
      }
    );

    const download = downloadContextualLayers({
      serverUrl: 'http://localhost:8080',
      token: 'token',
      projectId: 'survey',
      signal: controller.signal,
      layers: [
        {
          id: 'asset-1',
          name: 'Digital atlas',
          kind: 'vector-tiles',
          byteSize: 100,
          contentHash: 'hash-1',
          extent: [0, 0, 1, 1],
          defaultStyle: DEFAULT_MAP_ASSET_STYLE,
        },
      ],
    });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    controller.abort();

    await expect(download).rejects.toBeInstanceOf(
      ContextualLayerDownloadCancelledError
    );
    expect(store.getState().contextualLayers.files).toEqual({});
  });
});
