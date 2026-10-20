// SPDX-License-Identifier: Apache-2.0
/**
 * Static OpenLayers preview fitted to a layer extent, with space around it.
 * No pan, zoom, or controls.
 */

import {Box, Typography} from '@mui/material';
import {Extent} from 'ol/extent';
import BaseLayer from 'ol/layer/Base';
import VectorLayer from 'ol/layer/Vector';
import TileLayer from 'ol/layer/Tile';
import Map from 'ol/Map';
import 'ol/ol.css';
import {transformExtent} from 'ol/proj';
import XYZ from 'ol/source/XYZ';
import View from 'ol/View';
import {useEffect, useRef, useState} from 'react';
import type {ContextualMapLayerKind} from './contextualMapLayers';
import type {TileByteRead} from './pmtilesRange';
import {MapConfig} from './types';
import {createContextualMapLayer} from './useContextualMapLayers';

const MAP_PROJECTION = 'EPSG:3857';

/** Viewport-relative preview height; dvh avoids mobile browser chrome jumps. */
export const STATIC_MAP_LAYER_PREVIEW_HEIGHT = 'clamp(380px, 55dvh, 650px)';

export type StaticMapLayerKind = ContextualMapLayerKind;

export type StaticMapLayerStyle = {
  stroke: string;
  fill: string;
  lineWidth: number;
  pointSize: number;
  opacity: number;
  labelField?: string;
};

export type StaticMapLayerPreviewProps = {
  url: string;
  kind: StaticMapLayerKind;
  extent4326?: [number, number, number, number];
  extent3857?: [number, number, number, number];
  style: StaticMapLayerStyle;
  /** Range read for a PMTiles archive. Whole-file kinds use `url` only. */
  readTileBytes?: TileByteRead;
  minZoom?: number;
  maxZoom?: number;
  mapConfig: MapConfig;
  /**
   * Optional basemap. Defaults to OSM / MapTiler from `mapConfig`.
   * Field devices pass a cached VectorTileStore layer so preview works offline.
   */
  baseLayer?: BaseLayer;
  className?: string;
};

/** Pad an extent by 15% (or to a minimum span) so the preview is not edge-tight. */
function bufferExtent(extent: Extent): Extent {
  const [minX, minY, maxX, maxY] = extent;
  const width = maxX - minX;
  const height = maxY - minY;
  const minSpan = 800;
  const padX = Math.max(width * 0.15, (minSpan - width) / 2);
  const padY = Math.max(height * 0.15, (minSpan - height) / 2);
  return [minX - padX, minY - padY, maxX + padX, maxY + padY];
}

/** Online OSM or MapTiler raster used when the caller does not pass a cache. */
function basemapLayer(mapConfig: MapConfig) {
  if (mapConfig.mapSource === 'maptiler' && mapConfig.mapSourceKey) {
    const style =
      mapConfig.mapStyle === 'toner'
        ? 'toner-v2'
        : mapConfig.mapStyle === 'osm-bright'
          ? 'bright-v2'
          : mapConfig.mapStyle === 'openstreetmap'
            ? 'openstreetmap'
            : 'basic-v2';
    return new TileLayer({
      source: new XYZ({
        url: `https://api.maptiler.com/maps/${style}/{z}/{x}/{y}.png?key=${mapConfig.mapSourceKey}`,
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

/** Web-mercator extent for fitting; prefers a stored 3857 bbox. */
function placementExtent(
  extent4326?: [number, number, number, number],
  extent3857?: [number, number, number, number]
): Extent | undefined {
  if (extent3857) {
    return [...extent3857];
  }
  if (extent4326) {
    return transformExtent(extent4326, 'EPSG:4326', MAP_PROJECTION);
  }
  return undefined;
}

/**
 * Non-interactive OpenLayers preview fitted to the layer extent.
 * Devices should pass a cached `baseLayer` so the preview works offline.
 */
export function StaticMapLayerPreview({
  url,
  kind,
  extent4326,
  extent3857,
  style,
  readTileBytes,
  minZoom,
  maxZoom,
  mapConfig,
  baseLayer,
  className,
}: StaticMapLayerPreviewProps) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const target = container.current;
    if (!target) {
      return;
    }
    let cancelled = false;
    const map = new Map({
      target,
      layers: [baseLayer ?? basemapLayer(mapConfig)],
      controls: [],
      interactions: [],
      view: new View({center: [0, 0], zoom: 2}),
    });

    const show = async () => {
      const overlay = await createContextualMapLayer({
        id: 'preview',
        name: 'preview',
        kind,
        url,
        readTileBytes,
        visible: true,
        opacity: style.opacity,
        zIndex: 1,
        stroke: style.stroke,
        fill: style.fill,
        lineWidth: style.lineWidth,
        pointSize: style.pointSize,
        labelField: style.labelField,
        extent4326: extent4326 ?? [0, 0, 0, 0],
        extent3857,
        minZoom,
        maxZoom,
      });
      map.addLayer(overlay);
      let extent = placementExtent(extent4326, extent3857);
      if (overlay instanceof VectorLayer) {
        const featureExtent = overlay.getSource()?.getExtent();
        if (
          featureExtent &&
          featureExtent.every((value: number) => Number.isFinite(value))
        ) {
          extent = featureExtent;
        }
      }
      if (cancelled) {
        return;
      }
      if (!extent) {
        setError('This layer has no extent to fit.');
        return;
      }
      map.updateSize();
      map.getView().fit(bufferExtent(extent), {
        padding: [48, 48, 48, 48],
        maxZoom: 18,
      });
    };

    void show().catch(loadError => {
      if (!cancelled) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Could not draw this layer.'
        );
      }
    });

    return () => {
      cancelled = true;
      map.setTarget(undefined);
    };
  }, [
    url,
    kind,
    extent4326,
    extent3857,
    style,
    readTileBytes,
    minZoom,
    maxZoom,
    mapConfig,
    baseLayer,
  ]);

  return (
    <Box>
      {error ? <Typography color="error">{error}</Typography> : null}
      <Box
        ref={container}
        className={className}
        sx={{width: '100%', height: STATIC_MAP_LAYER_PREVIEW_HEIGHT}}
      />
    </Box>
  );
}
