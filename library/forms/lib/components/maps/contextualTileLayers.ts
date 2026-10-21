// SPDX-License-Identifier: Apache-2.0
/**
 * OpenLayers layers that read one local PMTiles archive.
 * Only the tiles in view are decoded. Hidden layers are not created by the
 * map hook, so a hidden archive does not keep a tile cache.
 */

import {FeatureLike} from 'ol/Feature';
import MVT from 'ol/format/MVT';
import TileLayer from 'ol/layer/Tile';
import VectorTileLayer from 'ol/layer/VectorTile';
import {transformExtent} from 'ol/proj';
import ImageTileSource from 'ol/source/ImageTile';
import VectorTileSource from 'ol/source/VectorTile';
import TileState from 'ol/TileState';
import VectorTile from 'ol/VectorTile';
import {PMTiles, TileType, type Source} from 'pmtiles';
import type {ContextualMapLayer} from './contextualMapLayers';
import {contextualVectorStyle} from './contextualVectorStyle';
import {
  assertTileRange,
  throwIfAborted,
  type TileByteRead,
} from './pmtilesRange';
import {
  TILE_LOAD_CONTROLLER,
  TILE_LOAD_GATE,
  createTileLoadController,
  createTileLoadGate,
  isTileLoadPausedError,
  resetErrorTiles,
  retryAbortedTiles,
  type TileLoadGate,
} from './tileLoadControl';

const MAP_PROJECTION = 'EPSG:3857';
const TILE_SIZE = 256;

/**
 * Tiles kept per contextual layer. One viewport, not a prefetch ring:
 * a larger cache plus decoded trail tiles crashed WebContent under load.
 */
export const CONTEXTUAL_TILE_CACHE_SIZE = 16;

/** No extra tiles around the view. Prefetch rings raise the decode peak. */
export const CONTEXTUAL_RENDER_BUFFER = 0;

export const CONTEXTUAL_TILE_LOAD_GATE = TILE_LOAD_GATE;

export const createContextualTileLoadGate = createTileLoadGate;
export type ContextualTileLoadGate = TileLoadGate;
export const retryAbortedContextualTiles = retryAbortedTiles;
export {resetErrorTiles};

const TRANSPARENT_PNG = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
  0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06,
  0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44,
  0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0d,
  0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42,
  0x60, 0x82,
]);

class CallbackSource implements Source {
  constructor(
    private readonly read: TileByteRead,
    private readonly key: string
  ) {}

  /** Archive identity used by the PMTiles cache. */
  getKey(): string {
    return this.key;
  }

  /** Range-read `length` bytes at `offset` from the stored archive. */
  async getBytes(
    offset: number,
    length: number,
    signal?: AbortSignal
  ) {
    assertTileRange(offset, length);
    throwIfAborted(signal);
    const data = await this.read(offset, length, signal);
    throwIfAborted(signal);
    if (data.byteLength > length) {
      throw new Error('Tile read returned more bytes than requested.');
    }
    return {data};
  }
}

/** Web-mercator clip extent, or `undefined` when the bbox is empty. */
function layerExtent(spec: ContextualMapLayer) {
  if (spec.extent3857 && spec.extent3857[2] > spec.extent3857[0]) {
    return spec.extent3857;
  }
  const extent = transformExtent(spec.extent4326, 'EPSG:4326', MAP_PROJECTION);
  if (extent[2] > extent[0] && extent[3] > extent[1]) {
    return extent;
  }
  return undefined;
}

/** Decode raster tile bytes to an ImageBitmap (or HTMLImage fallback). */
async function decodeTile(
  bytes: ArrayBuffer,
  mime: string,
  signal?: AbortSignal
): Promise<ImageBitmap | HTMLImageElement> {
  throwIfAborted(signal);
  const blob = new Blob([bytes], {type: mime});
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(
        blob,
        signal ? ({signal} as ImageBitmapOptions) : undefined
      );
    } catch (error) {
      throwIfAborted(signal);
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error;
      }
      return createImageBitmap(blob);
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    throwIfAborted(signal);
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

let emptyTile: Promise<ImageBitmap | HTMLImageElement> | undefined;

/** Cached 1×1 transparent PNG used when a tile is missing. */
function transparentTile(): Promise<ImageBitmap | HTMLImageElement> {
  emptyTile ??= decodeTile(TRANSPARENT_PNG.buffer, 'image/png');
  return emptyTile;
}

/** MIME type for a PMTiles raster tile type. */
function tileMime(tileType: TileType): string {
  if (tileType === TileType.Jpeg) {
    return 'image/jpeg';
  }
  if (tileType === TileType.Webp) {
    return 'image/webp';
  }
  if (tileType === TileType.Avif) {
    return 'image/avif';
  }
  return 'image/png';
}

/** Open the layer's PMTiles archive via its range reader. */
async function openArchive(spec: ContextualMapLayer): Promise<PMTiles> {
  if (!spec.readTileBytes) {
    throw new Error(`Layer ${spec.name} has no tile reader.`);
  }
  return new PMTiles(
    new CallbackSource(spec.readTileBytes, spec.url || spec.id)
  );
}

/** Raster PMTiles as an image-tile layer. The header sets the zoom range. */
export async function createRasterTileLayer(
  spec: ContextualMapLayer
): Promise<TileLayer> {
  const archive = await openArchive(spec);
  const header = await archive.getHeader();
  const mime = tileMime(header.tileType);
  const loads = createTileLoadController();
  const source = new ImageTileSource({
    projection: MAP_PROJECTION,
    minZoom: header.minZoom,
    maxZoom: header.maxZoom,
    tileSize: spec.tileSize ?? TILE_SIZE,
    wrapX: false,
    transition: 0,
    loader: async (z, x, y, options) => {
      return loads.run(async pause => {
        throwIfAborted(pause);
        throwIfAborted(options?.signal);
        const tile = await archive.getZxy(z, x, y, pause);
        throwIfAborted(pause);
        throwIfAborted(options?.signal);
        if (!tile) {
          return transparentTile();
        }
        return decodeTile(tile.data, mime, pause);
      });
    },
  });
  const layer = new TileLayer({
    source,
    preload: 0,
    cacheSize: CONTEXTUAL_TILE_CACHE_SIZE,
    extent: layerExtent(spec),
  });
  layer.set(TILE_LOAD_GATE, loads.gate);
  layer.set(TILE_LOAD_CONTROLLER, loads);
  return layer;
}

/** Vector PMTiles as an MVT layer. Paint stays a client style function. */
export async function createVectorTileLayer(
  spec: ContextualMapLayer
): Promise<VectorTileLayer> {
  const archive = await openArchive(spec);
  const header = await archive.getHeader();
  const loads = createTileLoadController();
  const source = new VectorTileSource({
    format: new MVT(),
    minZoom: header.minZoom,
    maxZoom: header.maxZoom,
    tileSize: spec.tileSize ?? TILE_SIZE,
    wrapX: false,
    // Without a URL, OpenLayers marks every tile empty and never calls
    // the load function. The string is only a cache key.
    tileUrlFunction: tileCoord =>
      tileCoord ? `${tileCoord[0]}/${tileCoord[1]}/${tileCoord[2]}` : undefined,
    tileLoadFunction: tile => {
      const vectorTile = tile as VectorTile<FeatureLike> & {
        disposeInternal: () => void;
      };
      const controller = new AbortController();
      const disposeInternal = vectorTile.disposeInternal.bind(vectorTile);
      vectorTile.disposeInternal = () => {
        controller.abort();
        disposeInternal();
      };
      vectorTile.setLoader(async (extent, _resolution, projection) => {
        const [z, x, y] = vectorTile.getTileCoord();
        try {
          await loads.run(async pause => {
            throwIfAborted(pause);
            throwIfAborted(controller.signal);
            const response = await archive.getZxy(z, x, y, pause);
            throwIfAborted(pause);
            throwIfAborted(controller.signal);
            if (!response) {
              vectorTile.setFeatures([]);
              return;
            }
            const features = vectorTile.getFormat().readFeatures(
              response.data,
              {
                extent,
                featureProjection: projection,
              }
            );
            throwIfAborted(pause);
            throwIfAborted(controller.signal);
            vectorTile.setFeatures(features);
          });
        } catch (error) {
          vectorTile.setState(TileState.ERROR);
          if (
            isTileLoadPausedError(error) ||
            controller.signal.aborted ||
            (error instanceof DOMException && error.name === 'AbortError')
          ) {
            return [];
          }
        }
        return [];
      });
    },
  });
  const layer = new VectorTileLayer({
    source,
    style: contextualVectorStyle(spec),
    preload: 0,
    cacheSize: CONTEXTUAL_TILE_CACHE_SIZE,
    updateWhileAnimating: false,
    updateWhileInteracting: false,
    extent: layerExtent(spec),
    renderBuffer: CONTEXTUAL_RENDER_BUFFER,
  });
  layer.set(TILE_LOAD_GATE, loads.gate);
  layer.set(TILE_LOAD_CONTROLLER, loads);
  return layer;
}
