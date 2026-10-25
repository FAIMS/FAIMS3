// SPDX-License-Identifier: Apache-2.0
import type {FeatureLike} from 'ol/Feature';
import {get as getProjection} from 'ol/proj';
import TileState from 'ol/TileState';
import type VectorTile from 'ol/VectorTile';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from 'vitest';
import {
  TILE_LOAD_CONTROLLER,
  TILE_LOAD_GATE,
  tileLoadController,
} from '../tileLoadControl';
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
        return [{} as FeatureLike];
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
  let getTileBlob: MockInstance<VectorTileStore['getTileBlob']>;

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
    getTileBlob.mockImplementation(async (url: string | undefined) =>
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
    getTileBlob.mockImplementation(async (url: string | undefined) => {
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
    store.tileLoader(missed as unknown as VectorTile<FeatureLike>);
    store.tileLoader(later as unknown as VectorTile<FeatureLike>);
    await missed.loader?.(WORLD_EXTENT, 1, projection);
    await later.loader?.(WORLD_EXTENT, 1, projection);
    expect(missed.getState()).toBe(TileState.ERROR);
    expect(later.getState()).toBe(TileState.LOADED);
    expect(later.features).toHaveLength(1);
  });

  it('refuses a streets tile during a pan instead of fetching it', async () => {
    const store = new VectorTileStore(OSM_CONFIG);
    getTileBlob.mockClear();
    tileLoadController(store.tileLayer)!.gate.startInteraction();
    const tile = fakeVectorTile([1, 0, 0]);
    const projection = getProjection('EPSG:3857');
    store.tileLoader(tile as unknown as VectorTile<FeatureLike>);
    await tile.loader?.(WORLD_EXTENT, 1, projection);
    expect(
      getTileBlob.mock.calls.some(([url]) => String(url).includes('.pbf'))
    ).toBe(false);
    expect(tile.getState()).toBe(TileState.ERROR);
  });

  it('attaches a load gate to streets and satellite layers', () => {
    const store = new VectorTileStore({
      ...OSM_CONFIG,
      satelliteSource: 'maptiler',
      mapSourceKey: 'test-key',
    });
    expect(store.tileLayer.get(TILE_LOAD_GATE)).toBeDefined();
    const satellite = store.getSatelliteLayer();
    expect(satellite?.get(TILE_LOAD_GATE)).toBeDefined();
    expect(satellite?.get(TILE_LOAD_CONTROLLER)).toBeDefined();
  });

  it('cancels an in-flight satellite image when the layer queue stops', async () => {
    const store = new VectorTileStore({
      ...OSM_CONFIG,
      satelliteSource: 'maptiler',
      mapSourceKey: 'test-key',
    });
    const layer = store.getSatelliteLayer();
    expect(layer).toBeDefined();
    const loadFn = layer!.getSource()!.getTileLoadFunction();
    const image = {
      src: 'about:blank',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      removeAttribute(name: string) {
        if (name === 'src') {
          image.src = '';
        }
      },
    };
    const tile = {
      getImage: () => image,
      setState: vi.fn(),
    };
    loadFn(tile as never, 'https://example.com/sat/1/0/0.jpg');
    await vi.waitFor(() => {
      expect(image.src).toContain('example.com');
    });
    tileLoadController(layer!)!.stop();
    expect(image.src).toBe('');
    await vi.waitFor(() => {
      expect(tile.setState).toHaveBeenCalledWith(TileState.ERROR);
    });
  });
});
