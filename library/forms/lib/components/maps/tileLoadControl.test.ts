// SPDX-License-Identifier: Apache-2.0
import TileState from 'ol/TileState';
import {describe, expect, it, vi} from 'vitest';
import {
  BASE_MAP_TILE_CONCURRENCY,
  createTileLoadController,
  createTileLoadGate,
  createTileLoadLimiter,
  createTileLoadSettle,
  retryAbortedTiles,
  settleTileLayer,
  shouldPauseTileLoads,
  TileLoadPausedError,
} from './tileLoadControl';

describe('tile load control', () => {
  it('lets in-flight reads finish and skips new ones while panning', () => {
    const gate = createTileLoadGate();
    const {signal, done} = gate.branch();
    expect(signal.aborted).toBe(false);
    gate.startInteraction();
    expect(signal.aborted).toBe(false);
    expect(gate.branch().signal.aborted).toBe(true);
    gate.endInteraction();
    done();
  });

  it('caps concurrent base-map loads and defers the rest', () => {
    const limiter = createTileLoadLimiter(BASE_MAP_TILE_CONCURRENCY);
    expect(limiter.tryBegin()).toBe(true);
    expect(limiter.tryBegin()).toBe(true);
    expect(limiter.tryBegin()).toBe(false);
    limiter.end();
    expect(limiter.tryBegin()).toBe(true);
  });

  it('waits for a free slot instead of failing extra tiles', async () => {
    const loads = createTileLoadController(1);
    let firstReleased = false;
    let secondStarted = false;
    let releaseFirst!: () => void;
    const first = loads.run(
      () =>
        new Promise<void>(resolve => {
          releaseFirst = () => {
            firstReleased = true;
            resolve();
          };
        })
    );
    const second = loads.run(async () => {
      secondStarted = true;
    });
    await Promise.resolve();
    expect(secondStarted).toBe(false);
    releaseFirst();
    await Promise.all([first, second]);
    expect(firstReleased).toBe(true);
    expect(secondStarted).toBe(true);
  });

  it('refuses new work during a pan instead of queuing it', async () => {
    const loads = createTileLoadController(2);
    loads.gate.startInteraction();
    await expect(loads.run(async () => undefined)).rejects.toBeInstanceOf(
      TileLoadPausedError
    );
  });

  it('aborts in-flight and queued work when a pan starts', async () => {
    const loads = createTileLoadController(1);
    const first = loads.run(
      signal =>
        new Promise<void>((_resolve, reject) => {
          signal.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'));
          });
        })
    );
    const second = loads.run(async () => undefined);
    await Promise.resolve();
    loads.gate.startInteraction();
    await expect(first).rejects.toBeInstanceOf(TileLoadPausedError);
    await expect(second).rejects.toBeInstanceOf(TileLoadPausedError);
  });

  it('debounces settle until navigation stops', () => {
    vi.useFakeTimers();
    const onSettle = vi.fn();
    const settle = createTileLoadSettle(onSettle, 200);
    settle.arm();
    vi.advanceTimersByTime(199);
    expect(onSettle).not.toHaveBeenCalled();
    settle.arm();
    vi.advanceTimersByTime(199);
    expect(onSettle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onSettle).toHaveBeenCalledTimes(1);
    settle.arm();
    settle.cancel();
    vi.advanceTimersByTime(200);
    expect(onSettle).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('evicts tiles that left the view and retries only in-view holes', () => {
    const sourceChanged = vi.fn();
    const layerChanged = vi.fn();
    const inViewLoaded = {
      getTileCoord: () => [2, 5, 5],
      getState: () => TileState.LOADED,
      setState: vi.fn(),
      dispose: vi.fn(),
    };
    const inViewError = {
      getTileCoord: () => [2, 6, 5],
      getState: () => TileState.ERROR,
      setState: vi.fn(),
      dispose: vi.fn(),
    };
    const coveringOtherZoom = {
      getTileCoord: () => [1, 2, 2],
      getState: () => TileState.ERROR,
      setState: vi.fn(),
      dispose: vi.fn(),
    };
    const offScreen = {
      getTileCoord: () => [2, 90, 90],
      getState: () => TileState.LOADED,
      setState: vi.fn(),
      dispose: vi.fn(),
    };
    const cache = new Map<string, {getTileCoord: () => number[]}>([
      ['a', inViewLoaded],
      ['b', inViewError],
      ['c', offScreen],
      ['d', coveringOtherZoom],
    ]);
    const sourceTiles: Record<string, typeof inViewError | typeof offScreen> = {
      keep: inViewError,
      drop: offScreen,
    };
    settleTileLayer(
      {
        getExtent: () => undefined,
        getRenderer: () => ({
          getTileCache: () => ({
            forEach: (fn: (tile: unknown, key?: string) => void) => {
              for (const [key, tile] of cache) {
                fn(tile, key);
              }
            },
            remove: (key: string) => {
              const tile = cache.get(key);
              cache.delete(key);
              return tile;
            },
          }),
        }),
        getSource: () => ({
          changed: sourceChanged,
          sourceTiles_: sourceTiles,
          getTileGridForProjection: () => ({
            getZForResolution: () => 2,
            getTileRangeForExtentAndZ: () => ({
              minX: 4,
              maxX: 7,
              minY: 4,
              maxY: 7,
            }),
            getTileCoordExtent: (coord: number[]) => {
              if (coord[1] === 90) {
                return [100, 100, 101, 101];
              }
              return [0, 0, 1, 1];
            },
          }),
          getTileGrid: () => ({
            getZForResolution: () => 2,
            getTileRangeForExtentAndZ: () => ({
              minX: 4,
              maxX: 7,
              minY: 4,
              maxY: 7,
            }),
            getTileCoordExtent: (coord: number[]) => {
              if (coord[1] === 90) {
                return [100, 100, 101, 101];
              }
              return [0, 0, 1, 1];
            },
          }),
        }),
        changed: layerChanged,
      },
      {
        getView: () => ({
          getProjection: () => 'EPSG:3857',
          getResolution: () => 1,
          calculateExtent: () => [0, 0, 1, 1],
        }),
        getSize: () => [256, 256],
      }
    );
    expect(inViewLoaded.setState).not.toHaveBeenCalled();
    expect(inViewLoaded.dispose).not.toHaveBeenCalled();
    expect(inViewError.setState).toHaveBeenCalledWith(TileState.IDLE);
    expect(inViewError.dispose).not.toHaveBeenCalled();
    expect(coveringOtherZoom.setState).toHaveBeenCalledWith(TileState.IDLE);
    expect(coveringOtherZoom.dispose).not.toHaveBeenCalled();
    expect(offScreen.dispose).toHaveBeenCalled();
    expect(sourceTiles.drop).toBeUndefined();
    expect(sourceTiles.keep).toBe(inViewError);
    expect(layerChanged).toHaveBeenCalled();
    expect(sourceChanged).not.toHaveBeenCalled();
  });

  it('retries refused tiles without dumping ones that already drew', () => {
    const sourceChanged = vi.fn();
    const layerChanged = vi.fn();
    const loaded = {
      getState: () => TileState.LOADED,
      setState: vi.fn(),
    };
    const aborted = {
      getState: () => TileState.ERROR,
      setState: vi.fn(),
    };
    retryAbortedTiles({
      getRenderer: () => ({
        getTileCache: () => ({
          forEach: (fn: (tile: unknown) => void) => {
            fn(loaded);
            fn(aborted);
          },
        }),
      }),
      getSource: () => ({
        changed: sourceChanged,
      }),
      changed: layerChanged,
    });
    expect(loaded.setState).not.toHaveBeenCalled();
    expect(aborted.setState).toHaveBeenCalledWith(TileState.IDLE);
    expect(layerChanged).toHaveBeenCalled();
    expect(sourceChanged).not.toHaveBeenCalled();
  });

  it('does not pause tiles for a programmatic view change', () => {
    expect(shouldPauseTileLoads({getInteracting: () => false})).toBe(false);
    expect(shouldPauseTileLoads({getInteracting: () => true})).toBe(true);
  });
});
