// SPDX-License-Identifier: Apache-2.0
import {configureStore} from '@reduxjs/toolkit';
import {DEFAULT_MAP_ASSET_STYLE} from '@faims3/data-model';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import contextualLayersReducer, {
  bindContextualLayersStore,
  type ContextualLayersState,
} from '../../../context/slices/contextualLayersSlice';

const native = vi.hoisted(() => ({
  isNative: false,
  downloadFile: vi.fn(),
  addListener: vi.fn(),
  deleteFile: vi.fn(),
  readdir: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => native.isNative,
    convertFileSrc: (uri: string) => uri,
  },
}));

vi.mock('@capacitor/filesystem', () => ({
  Directory: {Data: 'DATA'},
  Filesystem: {
    downloadFile: (...args: unknown[]) => native.downloadFile(...args),
    addListener: (...args: unknown[]) => native.addListener(...args),
    deleteFile: (...args: unknown[]) => native.deleteFile(...args),
    readdir: (...args: unknown[]) => native.readdir(...args),
    writeFile: vi.fn(),
    getUri: vi.fn(),
  },
}));

import {
  downloadContextualLayers,
  updateContextualLayerPrefs,
} from './contextualLayerStore';

const seeded = (): ContextualLayersState => ({
  files: {
    layer: {
      assetId: 'layer',
      contentHash: 'hash',
      kind: 'geojson',
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
      filename: 'layer-hash.geojson',
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
            mediaType: 'application/geo+json',
            filename: 'digital atlas.geojson',
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
          kind: 'geojson',
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
    expect(native.downloadFile).toHaveBeenCalledWith({
      url: presigned,
      path: 'map-assets/asset-1-hash-1.geojson',
      directory: 'DATA',
      recursive: true,
      progress: true,
    });
    expect(store.getState().contextualLayers.files['asset-1']?.filename).toBe(
      'asset-1-hash-1.geojson'
    );
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
          kind: 'geojson',
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
            kind: 'geojson',
            byteSize: 100,
            contentHash: 'hash-1',
            extent: [0, 0, 1, 1],
            defaultStyle: DEFAULT_MAP_ASSET_STYLE,
          },
        ],
      })
    ).rejects.toThrow('Could not download Digital atlas.');

    expect(native.deleteFile).toHaveBeenCalledWith({
      path: 'map-assets/asset-1-hash-1.geojson',
      directory: 'DATA',
    });
    expect(store.getState().contextualLayers.files).toEqual({});
  });
});
