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
  downloadContextualLayers,
  resetContextualLayerPrefs,
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
      projectIds: ['survey'],
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
        updateContextualLayerPrefs('layer', {opacity: (index + 1) / 10})
      )
    );

    expect(store.getState().contextualLayers.prefs.layer.opacity).toBe(0.8);
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
              labelField: 'name',
            },
          },
        },
        prefs: {
          tracks: {
            visible: false,
            opacity: 0.2,
            zIndex: 40,
            stroke: '#111111',
            fill: '#222222',
            lineWidth: 9,
            pointSize: 20,
            labelField: 'code',
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
        seenHashByProject: {},
      })
    );

    expect(resetContextualLayerPrefs('survey')).toEqual({
      boundary: {
        visible: true,
        opacity: 0.7,
        zIndex: 10,
        stroke: '#cb181d',
        fill: '#cb181d80',
        lineWidth: 3,
        pointSize: 8,
        labelField: 'name',
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
    });
    expect(store.getState().contextualLayers.prefs).toEqual({
      boundary: {
        visible: true,
        opacity: 0.7,
        zIndex: 10,
        stroke: '#cb181d',
        fill: '#cb181d80',
        lineWidth: 3,
        pointSize: 8,
        labelField: 'name',
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
    });
  });

  it('drops layer metadata when the app store is reset', async () => {
    await updateContextualLayerPrefs('layer', {
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

describe('downloadContextualLayers on native', () => {
  const presigned =
    'http://localhost:9000/faims-map-assets/map-assets/asset-1/normalized';
  let store: ReturnType<
    typeof configureStore<{contextualLayers: ContextualLayersState}>
  >;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
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

  it('keeps both surveys when two downloads overlap', async () => {
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
    await Promise.resolve();
    expect(started).toBe(1);

    releaseFirst();
    await Promise.all([first, second]);

    const files = store.getState().contextualLayers.files;
    expect(files['asset-a']?.filename).toBe('asset-a-hash-a.pmtiles');
    expect(files['asset-b']?.filename).toBe('asset-b-hash-b.pmtiles');
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
            projectIds: ['survey-b'],
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

    const retain = retainListedContextualLayers('survey-b', ['asset-b']);
    await Promise.resolve();
    expect(native.deleteFile).not.toHaveBeenCalled();

    releaseDownload();
    await Promise.all([download, retain]);

    const files = store.getState().contextualLayers.files;
    expect(files['asset-a']?.filename).toBe('asset-a-hash-a.pmtiles');
    expect(files['asset-b']?.filename).toBe('asset-b-hash-b.pmtiles');
    expect(native.deleteFile).not.toHaveBeenCalled();
  });
});
