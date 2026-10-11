// SPDX-License-Identifier: Apache-2.0
/**
 * Static OpenLayers preview fitted to a layer extent, with space around it.
 * No pan, zoom, or controls.
 */

import {Extent} from 'ol/extent';
import {FeatureLike} from 'ol/Feature';
import GeoJSON from 'ol/format/GeoJSON';
import ImageLayer from 'ol/layer/Image';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import Map from 'ol/Map';
import 'ol/ol.css';
import {transformExtent} from 'ol/proj';
import ImageStatic from 'ol/source/ImageStatic';
import XYZ from 'ol/source/XYZ';
import VectorSource from 'ol/source/Vector';
import {Circle as CircleStyle, Fill, Stroke, Style, Text} from 'ol/style';
import View from 'ol/View';
import {useEffect, useRef, useState} from 'react';
import {MapConfig} from './types';

const MAP_PROJECTION = 'EPSG:3857';

export type StaticMapLayerKind = 'geojson' | 'image';

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
  mapConfig: MapConfig;
  className?: string;
};

function bufferExtent(extent: Extent): Extent {
  const [minX, minY, maxX, maxY] = extent;
  const width = maxX - minX;
  const height = maxY - minY;
  const minSpan = 800;
  const padX = Math.max(width * 0.15, (minSpan - width) / 2);
  const padY = Math.max(height * 0.15, (minSpan - height) / 2);
  return [minX - padX, minY - padY, maxX + padX, maxY + padY];
}

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

function vectorStyle(paint: StaticMapLayerStyle) {
  return (feature: FeatureLike) => {
    const labelValue = paint.labelField
      ? feature.get(paint.labelField)
      : undefined;
    const label =
      labelValue === undefined || labelValue === null ? '' : String(labelValue);
    return new Style({
      stroke: new Stroke({color: paint.stroke, width: paint.lineWidth}),
      fill: new Fill({color: paint.fill}),
      image: new CircleStyle({
        radius: paint.pointSize,
        fill: new Fill({color: paint.stroke}),
        stroke: new Stroke({color: '#ffffff', width: 1}),
      }),
      text: label
        ? new Text({
            text: label,
            font: '12px sans-serif',
            fill: new Fill({color: paint.stroke}),
            stroke: new Stroke({color: '#ffffff', width: 3}),
            offsetY: -14,
          })
        : undefined,
    });
  };
}

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

export function StaticMapLayerPreview({
  url,
  kind,
  extent4326,
  extent3857,
  style,
  mapConfig,
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
      layers: [basemapLayer(mapConfig)],
      controls: [],
      interactions: [],
      view: new View({center: [0, 0], zoom: 2}),
    });

    const show = async () => {
      let extent: Extent | undefined;
      if (kind === 'image') {
        extent = placementExtent(extent4326, extent3857);
        if (!extent) {
          throw new Error('This image has no placement extent.');
        }
        map.addLayer(
          new ImageLayer({
            opacity: style.opacity,
            source: new ImageStatic({
              url,
              projection: MAP_PROJECTION,
              imageExtent: extent,
            }),
          })
        );
      } else {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('Could not read the layer.');
        }
        const geojson = await response.json();
        const features = new GeoJSON().readFeatures(geojson, {
          dataProjection: 'EPSG:4326',
          featureProjection: MAP_PROJECTION,
        });
        const source = new VectorSource({features});
        map.addLayer(
          new VectorLayer({
            source,
            opacity: style.opacity,
            style: vectorStyle(style),
          })
        );
        const featureExtent = source.getExtent();
        extent =
          featureExtent && featureExtent.every(value => Number.isFinite(value))
            ? featureExtent
            : placementExtent(extent4326, extent3857);
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
  }, [url, kind, extent4326, extent3857, style, mapConfig]);

  return (
    <div>
      {error ? <p>{error}</p> : null}
      <div
        ref={container}
        className={className}
        style={{width: '100%', height: 'clamp(380px, 55vh, 650px)'}}
      />
    </div>
  );
}
