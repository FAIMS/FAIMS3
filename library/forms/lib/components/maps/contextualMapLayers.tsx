// SPDX-License-Identifier: Apache-2.0
import {createContext} from 'react';

import type {TileByteRead} from './pmtilesRange';

/** One PMTiles archive of image tiles or Mapbox vector tiles. */
export type ContextualMapLayerKind = 'raster-tiles' | 'vector-tiles';

/** True when the archive holds Mapbox vector tiles. */
export function isVectorContextualKind(kind: ContextualMapLayerKind): boolean {
  return kind === 'vector-tiles';
}

/** One downloaded contextual layer, ready for OpenLayers. */
export type ContextualMapLayer = {
  id: string;
  name: string;
  kind: ContextualMapLayerKind;
  /** Blob or Capacitor URL of the normalized file. Identity for the layer. */
  url: string;
  /**
   * Range read for the PMTiles archive.
   * Implementations must not return more bytes than requested.
   */
  readTileBytes?: TileByteRead;
  visible: boolean;
  opacity: number;
  zIndex: number;
  stroke: string;
  fill: string;
  lineWidth: number;
  pointSize: number;
  /** EPSG:4326 [minX, minY, maxX, maxY]. */
  extent4326: [number, number, number, number];
  /** EPSG:3857 placement extent for images. */
  extent3857?: [number, number, number, number];
  /** Hint from the listing. The archive header wins when the file is opened. */
  minZoom?: number;
  maxZoom?: number;
  tileSize?: number;
};

/** Visibility, opacity, stack, or paint change for one overlay. */
export type ContextualMapLayerPatch = Partial<
  Pick<
    ContextualMapLayer,
    | 'visible'
    | 'opacity'
    | 'zIndex'
    | 'stroke'
    | 'fill'
    | 'lineWidth'
    | 'pointSize'
  >
>;

/** Downloaded overlays and the panel actions that mutate them. */
export type ContextualMapLayersValue = {
  layers: ContextualMapLayer[];
  updateLayer: (id: string, patch: ContextualMapLayerPatch) => void;
  moveLayer: (id: string, direction: 'up' | 'down') => void;
  /** Restore downloaded overlays to their file defaults and original order. */
  resetLayers: () => void;
};

const emptyContextualMapLayers: ContextualMapLayersValue = {
  layers: [],
  updateLayer: () => undefined,
  moveLayer: () => undefined,
  resetLayers: () => undefined,
};

/** Provided by the field app for the notebook currently on screen. */
export const ContextualMapLayersContext =
  createContext<ContextualMapLayersValue>(emptyContextualMapLayers);
