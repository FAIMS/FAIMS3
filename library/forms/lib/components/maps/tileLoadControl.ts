// SPDX-License-Identifier: Apache-2.0
/**
 * Shared tile-load pacing for contextual overlays and the streets/satellite
 * base maps. New loads pause while the view is moving. Base-map network
 * tiles also share a small in-flight cap so a slow radio cannot fill
 * OpenLayers' queue and stall local PMTiles reads.
 */

import TileLayer from 'ol/layer/Tile';
import VectorTileLayer from 'ol/layer/VectorTile';
import Tile from 'ol/Tile';
import TileState from 'ol/TileState';

/** In-flight streets or satellite tile fetches. Extra tiles defer. */
export const BASE_MAP_TILE_CONCURRENCY = 2;

/** Layer property holding {@link createTileLoadGate}. */
export const TILE_LOAD_GATE = 'tileLoadGate';

/** Layer property holding {@link createTileLoadController} for base maps. */
export const TILE_LOAD_CONTROLLER = 'tileLoadController';

type TileCache = {forEach: (fn: (tile: Tile) => void) => void};

type TileRenderer = {
  getTileCache?: () => TileCache;
  getSourceTileCache?: () => TileCache;
};

export type TileLoadGate = {
  readonly interacting: boolean;
  startInteraction: () => void;
  endInteraction: () => void;
  branch: (parent?: AbortSignal) => {signal: AbortSignal; done: () => void};
};

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
 * Cap in-flight work and pause new work during a user pan. Waiters stay
 * LOADING so OpenLayers will still display them; marking them ERROR left
 * streets/satellite blank because those tiles live outside the renderer
 * cache our retry could see.
 */
export function createTileLoadController(max = BASE_MAP_TILE_CONCURRENCY) {
  const limiter = createTileLoadLimiter(max);
  const waiters: Array<() => void> = [];
  let interacting = false;

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
    async run<T>(fn: () => Promise<T>): Promise<T> {
      while (interacting || !limiter.tryBegin()) {
        await new Promise<void>(resolve => {
          waiters.push(resolve);
        });
      }
      try {
        return await fn();
      } finally {
        limiter.end();
        notify();
      }
    },
    retry(layer: TileLayer | VectorTileLayer) {
      layer.getSource()?.changed();
    },
  };
}

export type TileLoadController = ReturnType<typeof createTileLoadController>;

/** Re-open failed tiles. Loaded tiles in the same cache are left alone. */
export function resetErrorTiles(cache?: TileCache): void {
  cache?.forEach(tile => {
    if (tile.getState() === TileState.ERROR) {
      tile.setState(TileState.IDLE);
    }
  });
}

/**
 * Fill holes from aborted reads after a pan. Does not dump the tile cache,
 * so tiles that already drew stay on screen.
 */
export function retryAbortedTiles(layer: TileLayer | VectorTileLayer): void {
  const renderer = layer.getRenderer() as TileRenderer | null;
  resetErrorTiles(renderer?.getTileCache?.());
  resetErrorTiles(renderer?.getSourceTileCache?.());
  layer.getSource()?.changed();
}

/** Gate stored on a layer, if the loader attached one. */
export function tileLoadGate(layer: {
  get: (key: string) => unknown;
}): TileLoadGate | undefined {
  return layer.get(TILE_LOAD_GATE) as TileLoadGate | undefined;
}

/** Controller stored on a streets or satellite layer. */
export function tileLoadController(layer: {
  get: (key: string) => unknown;
}): TileLoadController | undefined {
  return layer.get(TILE_LOAD_CONTROLLER) as TileLoadController | undefined;
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
