// SPDX-License-Identifier: Apache-2.0
/**
 * Shared OpenLayers helpers for map previews and MapComponent.
 */

import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
import {MapConfig} from './types';

/** MapTiler raster style slug used for the streets preview layer. */
function maptilerRasterStyle(mapStyle: MapConfig['mapStyle']): string {
  if (mapStyle === 'toner') {
    return 'toner-v2';
  }
  if (mapStyle === 'osm-bright') {
    return 'bright-v2';
  }
  if (mapStyle === 'openstreetmap') {
    return 'openstreetmap';
  }
  return 'basic-v2';
}

/** Online streets raster (MapTiler when a key is set, otherwise OSM). */
export function createStreetsLayer(mapConfig: MapConfig): TileLayer {
  if (mapConfig.mapSource === 'maptiler' && mapConfig.mapSourceKey) {
    return new TileLayer({
      source: new XYZ({
        url: `https://api.maptiler.com/maps/${maptilerRasterStyle(mapConfig.mapStyle)}/{z}/{x}/{y}.png?key=${mapConfig.mapSourceKey}`,
        attributions: '© MapTiler © OpenStreetMap contributors',
      }),
    });
  }
  return new TileLayer({
    source: new XYZ({
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      attributions: '© OpenStreetMap contributors',
    }),
  });
}

/** Visible layer plus its stack order and attribution string. */
export type VisibleAttributionLayer = {
  visible: boolean;
  zIndex: number;
  attribution: string;
};

/** Attribution from the visible layer with the highest zIndex, else fallback. */
export function topVisibleAttribution(
  layers: VisibleAttributionLayer[],
  fallback: string
): string {
  const visible = layers
    .filter(layer => layer.visible && layer.attribution)
    .sort((a, b) => b.zIndex - a.zIndex);
  return visible[0]?.attribution ?? fallback;
}
