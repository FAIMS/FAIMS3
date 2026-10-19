// SPDX-License-Identifier: Apache-2.0
import type {FeatureLike} from 'ol/Feature';
import {get as getProjection} from 'ol/proj';
import TileState from 'ol/TileState';
import type VectorTile from 'ol/VectorTile';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {VectorTileStore} from './TileStore';

vi.mock('ol-mapbox-style', () => ({
  applyStyle: vi.fn().mockResolvedValue(undefined),
}));

const OSM_CONFIG = {
  mapSource: 'osm',
  mapSourceKey: '',
  mapStyle: 'basic' as const,
};

const WORLD_EXTENT = [-20037508, -20037508, 20037508, 20037508];

function streetTile(store: VectorTileStore, z: number, x: number, y: number) {
  const projection = getProjection('EPSG:3857');
  expect(projection).toBeTruthy();
  const tile = store.source.getTile(z, x, y, 1, projection!);
  expect(tile.getState()).not.toBe(TileState.EMPTY);
  return tile;
}

function fakeVectorTile(coord: [number, number, number]) {
  const tile: {
    state: number;
    features?: FeatureLike[];
    loader?: (
      extent: number[],
      resolution: number,
      projection: ReturnType<typeof getProjection>
    ) => Promise<unknown>;
    setLoader: (loader: NonNullable<(typeof tile)['loader']>) => void;
    getTileCoord: () => [number, number, number];
    getFormat: () => {readFeatures: () => FeatureLike[]};
    setFeatures: (features: FeatureLike[]) => void;
    setState: (state: number) => void;
    getState: () => number;
  } = {
    state: TileState.IDLE,
    setLoader(loader) {
      tile.loader = loader;
    },
    getTileCoord: () => coord,
    getFormat: () => ({
      readFeatures() {
        return [{id: coord.join('/')}] as FeatureLike[];
      },
    }),
    setFeatures(features) {
      tile.features = features;
      tile.state = TileState.LOADED;
    },
    setState(state) {
      tile.state = state;
    },
    getState() {
      return tile.state;
    },
  };
  return tile;
}

describe('VectorTileStore.tileLoader', () => {
  let getTileBlob: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network disabled'))
    );
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => false,
    });
    // Constructor pre-caches style sprites. Stub before construct so those
    // fetches never touch IndexedDB.
    getTileBlob = vi
      .spyOn(VectorTileStore.prototype, 'getTileBlob')
      .mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('sets ERROR on a cache/network miss so the tile leaves LOADING', async () => {
    const store = new VectorTileStore(OSM_CONFIG);
    const tile = streetTile(store, 1, 0, 0);
    tile.load();
    await vi.waitFor(() => {
      expect(tile.getState()).toBe(TileState.ERROR);
    });
  });

  it('sets ERROR when the tile bytes cannot be decoded', async () => {
    getTileBlob.mockImplementation(async url =>
      url?.includes('.pbf') ? new Blob([new Uint8Array([1, 2, 3])]) : undefined
    );
    const store = new VectorTileStore(OSM_CONFIG);
    const tile = streetTile(store, 1, 1, 0);
    tile.load();
    await vi.waitFor(() => {
      expect(tile.getState()).toBe(TileState.ERROR);
    });
  });

  it('lets a later tile start after a miss reaches ERROR', async () => {
    getTileBlob.mockImplementation(async url => {
      if (!url?.includes('.pbf')) {
        return undefined;
      }
      if (url.includes('/1/0/0.pbf')) {
        return undefined;
      }
      return {
        arrayBuffer: async () => new Uint8Array([4, 5, 6]).buffer,
      } as Blob;
    });
    const store = new VectorTileStore(OSM_CONFIG);
    const missed = fakeVectorTile([1, 0, 0]);
    const later = fakeVectorTile([1, 1, 0]);
    const projection = getProjection('EPSG:3857');
    store.tileLoader(missed as unknown as VectorTile);
    store.tileLoader(later as unknown as VectorTile);
    await missed.loader?.(WORLD_EXTENT, 1, projection);
    await later.loader?.(WORLD_EXTENT, 1, projection);
    expect(missed.getState()).toBe(TileState.ERROR);
    expect(later.getState()).toBe(TileState.LOADED);
    expect(later.features).toHaveLength(1);
  });
});
