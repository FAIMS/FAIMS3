// SPDX-License-Identifier: Apache-2.0
import {createContext} from 'react';

/** One downloaded contextual layer, ready for OpenLayers. */
export type ContextualMapLayer = {
  id: string;
  name: string;
  kind: 'geojson' | 'image';
  /** Blob or Capacitor URL of the normalized file. */
  url: string;
  visible: boolean;
  opacity: number;
  zIndex: number;
  stroke: string;
  fill: string;
  lineWidth: number;
  pointSize: number;
  labelField?: string;
  /** EPSG:4326 [minX, minY, maxX, maxY]. */
  extent4326: [number, number, number, number];
  /** EPSG:3857 placement extent for images. */
  extent3857?: [number, number, number, number];
};

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
    | 'labelField'
  >
>;

export type ContextualMapLayersValue = {
  layers: ContextualMapLayer[];
  updateLayer: (id: string, patch: ContextualMapLayerPatch) => void;
  moveLayer: (id: string, direction: 'up' | 'down') => void;
};

const emptyContextualMapLayers: ContextualMapLayersValue = {
  layers: [],
  updateLayer: () => undefined,
  moveLayer: () => undefined,
};

/** Provided by the field app for the notebook currently on screen. */
export const ContextualMapLayersContext =
  createContext<ContextualMapLayersValue>(emptyContextualMapLayers);
