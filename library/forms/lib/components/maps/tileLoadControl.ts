// SPDX-License-Identifier: Apache-2.0
/**
 * Shared tile-load pacing for contextual overlays and the streets/satellite
 * base maps. No new work starts while the view is moving. After the gesture
 * settles, tiles that left the viewport are dropped and only in-view holes
 * stream in, so overlapping tiles already on screen are not refetched.
 */

import Tile from 'ol/Tile';
import TileState from 'ol/TileState';

/** In-flight streets, satellite, or contextual tile work after settle. */
export const BASE_MAP_TILE_CONCURRENCY = 2;

/** Wait after the last moveend before loading holes. */
export const TILE_LOAD_SETTLE_MS = 200;

/** Layer property holding {@link createTileLoadGate}. */
export const TILE_LOAD_GATE = 'tileLoadGate';

/** Layer property holding {@link createTileLoadController}. */
export const TILE_LOAD_CONTROLLER = 'tileLoadController';

type TileCache = {
  forEach: (fn: (tile: Tile, key?: string) => void) => void;
  remove?: (key: string) => Tile;
};

type TileRenderer = {
  getTileCache?: () => TileCache;
  getSourceTileCache?: () => TileCache;
};

type VectorSourceTiles = {
  sourceTiles_?: Record<string, Tile>;
  tileKeysBySourceTileUrl_?: Record<string, unknown>;
  removeSourceTiles?: (tile: Tile) => void;
  getTileGridForProjection?: (projection: unknown) => TileGridLike | null;
  getTileGrid?: () => TileGridLike | null;
  zDirection?: number;
  changed?: () => void;
};

type TileGridLike = {
  getZForResolution: (resolution: number, direction?: number) => number;
  getTileRangeForExtentAndZ: (
    extent: number[],
    z: number
  ) => {minX: number; maxX: number; minY: number; maxY: number} | null;
  getTileCoordExtent?: (coord: number[]) => number[] | null;
};

type RenderTile = Tile & {
  sourceTiles?: Tile[];
  errorTileKeys?: Record<string, boolean>;
  loadingSourceTiles?: number;
  dispose?: () => void;
  release?: () => void;
};

export type TileViewport = {
  z: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export type RetryableTileLayer = {
  getRenderer: () => unknown;
  getSource: () => unknown;
  getExtent?: () => number[] | undefined;
  changed: () => void;
  get?: (key: string) => unknown;
};

export type TileLoadMap = {
  getView: () => {
    getProjection: () => unknown;
    getResolution: () => number | undefined;
    calculateExtent: (size: number[]) => number[];
  };
  getSize: () => number[] | undefined;
  render?: () => void;
};

export type TileLoadGate = {
  readonly interacting: boolean;
  startInteraction: () => void;
  endInteraction: () => void;
  branch: (parent?: AbortSignal) => {signal: AbortSignal; done: () => void};
};

/** Thrown when a tile is refused so a pan trail is not decoded. */
export class TileLoadPausedError extends Error {
  constructor() {
    super('Tile load paused during interaction');
    this.name = 'TileLoadPausedError';
  }
}

export function isTileLoadPausedError(error: unknown): boolean {
  return error instanceof TileLoadPausedError;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

/**
 * Pause new tile reads while the map is moving. Reads that already started
 * keep going so drawn tiles do not blank out.
 */
export function createTileLoadGate(): TileLoadGate {
  let interacting = false;

  return {
    get interacting() {
      return interacting;
    },
    startInteraction() {
      interacting = true;
    },
    endInteraction() {
      interacting = false;
    },
    branch(parent?: AbortSignal) {
      const controller = new AbortController();
      if (interacting || parent?.aborted) {
        controller.abort();
        return {signal: controller.signal, done() {}};
      }
      const onParentAbort = () => controller.abort();
      parent?.addEventListener('abort', onParentAbort);
      return {
        signal: controller.signal,
        done() {
          parent?.removeEventListener('abort', onParentAbort);
        },
      };
    },
  };
}

/** Fail-fast slot counter. Waiting would keep the OpenLayers tile in LOADING. */
export function createTileLoadLimiter(max: number) {
  if (max < 1 || !Number.isInteger(max)) {
    throw new Error('Tile load limit must be a positive integer.');
  }
  let active = 0;
  return {
    get active() {
      return active;
    },
    tryBegin() {
      if (active >= max) {
        return false;
      }
      active += 1;
      return true;
    },
    end() {
      if (active > 0) {
        active -= 1;
      }
    },
  };
}

export type TileLoadLimiter = ReturnType<typeof createTileLoadLimiter>;

/**
 * Cap in-flight work after the map settles. During a gesture, refuse new
 * work and abort in-flight reads so a pan trail is not decoded.
 */
export function createTileLoadController(max = BASE_MAP_TILE_CONCURRENCY) {
  const limiter = createTileLoadLimiter(max);
  const waiters: Array<() => void> = [];
  const drained: Array<() => void> = [];
  let interacting = false;
  let loadAbort = new AbortController();

  const wakeWaiters = () => {
    const pending = waiters.splice(0);
    for (const resume of pending) {
      resume();
    }
  };

  const notifyDrain = () => {
    if (limiter.active > 0) {
      return;
    }
    const pending = drained.splice(0);
    for (const resume of pending) {
      resume();
    }
  };

  const notify = () => {
    if (interacting) {
      return;
    }
    while (waiters.length > 0 && limiter.active < max) {
      waiters.shift()?.();
    }
  };

  const gate: TileLoadGate = {
    get interacting() {
      return interacting;
    },
    startInteraction() {
      interacting = true;
      loadAbort.abort();
      loadAbort = new AbortController();
      wakeWaiters();
    },
    endInteraction() {
      interacting = false;
      notify();
    },
    branch(parent?: AbortSignal) {
      const controller = new AbortController();
      if (interacting || parent?.aborted) {
        controller.abort();
        return {signal: controller.signal, done() {}};
      }
      const onParentAbort = () => controller.abort();
      parent?.addEventListener('abort', onParentAbort);
      return {
        signal: controller.signal,
        done() {
          parent?.removeEventListener('abort', onParentAbort);
        },
      };
    },
  };

  return {
    gate,
    async run<T>(fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
      if (interacting) {
        throw new TileLoadPausedError();
      }
      const signal = loadAbort.signal;
      while (!limiter.tryBegin()) {
        await new Promise<void>(resolve => {
          waiters.push(resolve);
        });
        if (interacting || signal.aborted) {
          throw new TileLoadPausedError();
        }
      }
      try {
        if (signal.aborted) {
          throw new TileLoadPausedError();
        }
        const result = await fn(signal);
        if (signal.aborted || interacting) {
          throw new TileLoadPausedError();
        }
        return result;
      } catch (error) {
        if (isTileLoadPausedError(error) || isAbortError(error) || signal.aborted) {
          throw new TileLoadPausedError();
        }
        throw error;
      } finally {
        limiter.end();
        notify();
        notifyDrain();
      }
    },
    /** Wait until aborted in-flight work has left the limiter. */
    async drain(): Promise<void> {
      if (limiter.active === 0) {
        return;
      }
      await new Promise<void>(resolve => {
        drained.push(resolve);
      });
    },
    retry(layer: RetryableTileLayer, map: TileLoadMap) {
      settleTileLayer(layer, map);
    },
  };
}

export type TileLoadController = ReturnType<typeof createTileLoadController>;

/** Arm a callback after the last navigation event. */
export function createTileLoadSettle(
  onSettle: (cancelled: () => boolean) => void | Promise<void>,
  delay = TILE_LOAD_SETTLE_MS
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let epoch = 0;
  return {
    arm() {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
      const started = epoch;
      timer = setTimeout(() => {
        timer = undefined;
        void Promise.resolve(onSettle(() => started !== epoch));
      }, delay);
    },
    cancel() {
      epoch += 1;
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
    },
  };
}

export function tileInViewport(
  coord: number[] | undefined,
  viewport: TileViewport
): boolean {
  if (!coord || coord.length < 3) {
    return false;
  }
  const [z, x, y] = coord;
  return (
    z === viewport.z &&
    x >= viewport.minX &&
    x <= viewport.maxX &&
    y >= viewport.minY &&
    y <= viewport.maxY
  );
}

function extentsIntersect(a: number[], b: number[]): boolean {
  return a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
}

/** True if the tile covers the view, false if not, undefined if unknown. */
export function tileCoversView(
  tile: Tile,
  grid: TileGridLike | undefined,
  viewExtent: number[]
): boolean | undefined {
  const coord = tile.getTileCoord();
  if (!coord || !grid?.getTileCoordExtent) {
    return undefined;
  }
  const tileExtent = grid.getTileCoordExtent(coord);
  if (!tileExtent) {
    return undefined;
  }
  return extentsIntersect(tileExtent, viewExtent);
}

export function viewCoverage(
  layer: RetryableTileLayer,
  map: TileLoadMap
): {extent: number[]; viewGrid: TileGridLike; sourceGrid: TileGridLike} | undefined {
  const size = map.getSize();
  if (!size) {
    return undefined;
  }
  const view = map.getView();
  const source = layer.getSource() as VectorSourceTiles | null;
  const viewGrid =
    source?.getTileGridForProjection?.(view.getProjection()) ??
    source?.getTileGrid?.();
  if (!viewGrid) {
    return undefined;
  }
  let extent = view.calculateExtent(size);
  const layerExtent = layer.getExtent?.();
  if (layerExtent) {
    extent = [
      Math.max(extent[0], layerExtent[0]),
      Math.max(extent[1], layerExtent[1]),
      Math.min(extent[2], layerExtent[2]),
      Math.min(extent[3], layerExtent[3]),
    ];
  }
  return {
    extent,
    viewGrid,
    sourceGrid: source?.getTileGrid?.() ?? viewGrid,
  };
}

export function viewTileViewport(
  layer: RetryableTileLayer,
  map: TileLoadMap
): TileViewport | undefined {
  const coverage = viewCoverage(layer, map);
  if (!coverage) {
    return undefined;
  }
  const source = layer.getSource() as VectorSourceTiles | null;
  const z = coverage.viewGrid.getZForResolution(
    map.getView().getResolution() ?? 0,
    source?.zDirection ?? 0
  );
  if (coverage.extent[0] >= coverage.extent[2] || coverage.extent[1] >= coverage.extent[3]) {
    return {z, minX: 1, maxX: 0, minY: 1, maxY: 0};
  }
  const range = coverage.viewGrid.getTileRangeForExtentAndZ(coverage.extent, z);
  if (!range) {
    return {z, minX: 1, maxX: 0, minY: 1, maxY: 0};
  }
  return {
    z,
    minX: range.minX,
    maxX: range.maxX,
    minY: range.minY,
    maxY: range.maxY,
  };
}

function disposeTile(tile: Tile): void {
  const renderTile = tile as RenderTile;
  if (typeof renderTile.dispose === 'function') {
    renderTile.dispose();
    return;
  }
  renderTile.release?.();
}

function evictCache(
  cache: TileCache | undefined,
  viewExtent: number[],
  grid: TileGridLike | undefined,
  source: VectorSourceTiles | null
): void {
  if (!cache) {
    return;
  }
  const drop: Array<{key: string; tile: Tile}> = [];
  cache.forEach((tile, key) => {
    if (key && tileCoversView(tile, grid, viewExtent) === false) {
      drop.push({key, tile});
    }
  });
  for (const {key, tile} of drop) {
    source?.removeSourceTiles?.(tile);
    cache.remove?.(key);
    disposeTile(tile);
  }
}

function evictSourceTiles(
  source: VectorSourceTiles | null,
  viewExtent: number[],
  grid: TileGridLike | undefined
): void {
  const tiles = source?.sourceTiles_;
  if (!tiles) {
    return;
  }
  for (const [url, tile] of Object.entries(tiles)) {
    if (tileCoversView(tile, grid, viewExtent) !== false) {
      continue;
    }
    delete tiles[url];
    if (source.tileKeysBySourceTileUrl_) {
      delete source.tileKeysBySourceTileUrl_[url];
    }
    disposeTile(tile);
  }
}

/** Re-open a failed tile. Loaded tiles are left alone. */
export function resetErrorTiles(cache?: TileCache): void {
  cache?.forEach(tile => {
    resetPausedTile(tile);
  });
}

function resetPausedTile(tile: Tile): void {
  const renderTile = tile as RenderTile;
  if (renderTile.getState() !== TileState.ERROR) {
    return;
  }
  if (renderTile.errorTileKeys) {
    for (const key of Object.keys(renderTile.errorTileKeys)) {
      delete renderTile.errorTileKeys[key];
    }
  }
  if (typeof renderTile.loadingSourceTiles === 'number') {
    renderTile.loadingSourceTiles = 0;
  }
  if (renderTile.sourceTiles) {
    for (const sourceTile of renderTile.sourceTiles) {
      if (sourceTile.getState() === TileState.ERROR) {
        sourceTile.setState(TileState.IDLE);
      }
    }
    renderTile.sourceTiles.length = 0;
  }
  renderTile.setState(TileState.IDLE);
}

export function retryRemainingErrors(layer: RetryableTileLayer): void {
  const renderer = layer.getRenderer() as TileRenderer | null;
  resetErrorTiles(renderer?.getTileCache?.());
  resetErrorTiles(renderer?.getSourceTileCache?.());
  const tiles = (layer.getSource() as VectorSourceTiles | null)?.sourceTiles_;
  if (tiles) {
    for (const tile of Object.values(tiles)) {
      resetPausedTile(tile);
    }
  }
  layer.changed();
}

/** Drop tiles whose extent no longer overlaps the view. Does not start loads. */
export function evictStaleTiles(
  layer: RetryableTileLayer,
  map: TileLoadMap
): void {
  const coverage = viewCoverage(layer, map);
  const source = layer.getSource() as VectorSourceTiles | null;
  const renderer = layer.getRenderer() as TileRenderer | null;
  if (
    !coverage ||
    coverage.extent[0] >= coverage.extent[2] ||
    coverage.extent[1] >= coverage.extent[3]
  ) {
    return;
  }
  evictCache(
    renderer?.getTileCache?.(),
    coverage.extent,
    coverage.viewGrid,
    source
  );
  evictCache(
    renderer?.getSourceTileCache?.(),
    coverage.extent,
    coverage.sourceGrid,
    source
  );
  evictSourceTiles(source, coverage.extent, coverage.sourceGrid);
}

/**
 * After navigation settles: drop tiles that no longer cover the view (any
 * zoom), reopen remaining ERROR holes, and leave overlapping tiles on screen.
 */
export function settleTileLayer(
  layer: RetryableTileLayer,
  map: TileLoadMap
): void {
  evictStaleTiles(layer, map);
  retryRemainingErrors(layer);
}

/**
 * After drain: pan evicts tiles that left the view; zoom dumps the cache
 * like the last stable build.
 */
export async function applySettledTileLoads(options: {
  layers: RetryableTileLayer[];
  map: TileLoadMap;
  cancelled: () => boolean;
  zoomChanged: boolean;
}): Promise<void> {
  const controllers = options.layers
    .map(layer => tileLoadController(layer))
    .filter((loads): loads is TileLoadController => loads !== undefined);
  await Promise.all(controllers.map(loads => loads.drain()));
  if (options.cancelled()) {
    return;
  }
  if (options.zoomChanged) {
    for (const layer of options.layers) {
      tileLoadController(layer)?.gate.endInteraction();
      refreshTileLayer(layer);
    }
    options.map.render?.();
    return;
  }
  for (const layer of options.layers) {
    evictStaleTiles(layer, options.map);
  }
  if (options.cancelled()) {
    return;
  }
  for (const layer of options.layers) {
    tileLoadController(layer)?.gate.endInteraction();
    retryRemainingErrors(layer);
  }
  options.map.render?.();
}

/** Re-open ERROR tiles without dumping the cache. Prefer settleTileLayer. */
export function retryAbortedTiles(layer: RetryableTileLayer): void {
  const renderer = layer.getRenderer() as TileRenderer | null;
  resetErrorTiles(renderer?.getTileCache?.());
  resetErrorTiles(renderer?.getSourceTileCache?.());
  const tiles = (layer.getSource() as VectorSourceTiles | null)?.sourceTiles_;
  if (tiles) {
    for (const tile of Object.values(tiles)) {
      resetPausedTile(tile);
    }
  }
  layer.changed();
}

/** Gate stored on a layer, if the loader attached one. */
export function tileLoadGate(layer: {
  get: (key: string) => unknown;
}): TileLoadGate | undefined {
  return layer.get(TILE_LOAD_GATE) as TileLoadGate | undefined;
}

/** Controller stored on a streets, satellite, or contextual layer. */
export function tileLoadController(layer: {
  get?: (key: string) => unknown;
}): TileLoadController | undefined {
  return layer.get?.(TILE_LOAD_CONTROLLER) as TileLoadController | undefined;
}

/**
 * True only for a user pan/pinch/scroll. view.fit and setCenter also fire
 * movestart; pausing those deferred the first viewport and left the overview
 * map blank until the next gesture.
 */
export function shouldPauseTileLoads(view: {
  getInteracting: () => boolean;
}): boolean {
  return view.getInteracting();
}

/**
 * True when the view resolution moved by at least a quarter zoom level.
 * A pan keeps resolution; pinch/wheel/double-tap does not.
 */
export function isZoomChange(
  fromResolution: number | undefined,
  toResolution: number | undefined
): boolean {
  if (
    fromResolution === undefined ||
    toResolution === undefined ||
    fromResolution <= 0 ||
    toResolution <= 0
  ) {
    return false;
  }
  return Math.abs(Math.log2(fromResolution / toResolution)) >= 0.25;
}

/**
 * Dump the renderer cache the way the last stable commit did: bump the
 * source revision so prepareFrame clears tileCache_. Also drop source
 * tiles so a zoom does not keep the previous z in memory.
 */
export function refreshTileLayer(layer: RetryableTileLayer): void {
  const source = layer.getSource() as VectorSourceTiles | null;
  const tiles = source?.sourceTiles_;
  if (tiles) {
    for (const url of Object.keys(tiles)) {
      const tile = tiles[url];
      delete tiles[url];
      if (source.tileKeysBySourceTileUrl_) {
        delete source.tileKeysBySourceTileUrl_[url];
      }
      if (tile) {
        disposeTile(tile);
      }
    }
  }
  source?.changed?.();
}
