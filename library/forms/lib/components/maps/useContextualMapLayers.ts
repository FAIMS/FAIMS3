// SPDX-License-Identifier: Apache-2.0
import BaseLayer from 'ol/layer/Base';
import ImageLayer from 'ol/layer/Image';
import VectorLayer from 'ol/layer/Vector';
import OlMap from 'ol/Map';
import {FeatureLike} from 'ol/Feature';
import GeoJSON from 'ol/format/GeoJSON';
import ImageStatic from 'ol/source/ImageStatic';
import VectorSource from 'ol/source/Vector';
import {Circle as CircleStyle, Fill, Stroke, Style, Text} from 'ol/style';
import {useContext, useEffect, useRef} from 'react';
import {
  ContextualMapLayer,
  ContextualMapLayersContext,
} from './contextualMapLayers';
import {contextualLayerZIndex} from './layerStack';

const MAP_PROJECTION = 'EPSG:3857';

type ManagedLayer = BaseLayer;

function vectorStyle(spec: ContextualMapLayer) {
  return (feature: FeatureLike) => {
    const labelValue = spec.labelField
      ? feature.get(spec.labelField)
      : undefined;
    const label =
      labelValue === undefined || labelValue === null ? '' : String(labelValue);
    return new Style({
      stroke: new Stroke({color: spec.stroke, width: spec.lineWidth}),
      fill: new Fill({color: spec.fill}),
      image: new CircleStyle({
        radius: spec.pointSize,
        fill: new Fill({color: spec.stroke}),
        stroke: new Stroke({color: '#ffffff', width: 1}),
      }),
      text: label
        ? new Text({
            text: label,
            font: '12px sans-serif',
            fill: new Fill({color: spec.stroke}),
            stroke: new Stroke({color: '#ffffff', width: 3}),
            offsetY: -14,
          })
        : undefined,
    });
  };
}

function applyCommon(layer: ManagedLayer, spec: ContextualMapLayer) {
  layer.setVisible(spec.visible);
  layer.setOpacity(spec.opacity);
  // Stored order can grow without a ceiling. Keep reference data under pins.
  layer.setZIndex(contextualLayerZIndex(spec.zIndex));
}

async function createLayer(spec: ContextualMapLayer): Promise<ManagedLayer> {
  if (spec.kind === 'image') {
    if (!spec.extent3857) {
      throw new Error(`Image layer ${spec.id} is missing an extent.`);
    }
    const layer = new ImageLayer({
      source: new ImageStatic({
        url: spec.url,
        projection: MAP_PROJECTION,
        imageExtent: spec.extent3857,
      }),
    });
    layer.set('sourceUrl', spec.url);
    applyCommon(layer, spec);
    return layer;
  }

  const response = await fetch(spec.url);
  if (!response.ok) {
    throw new Error(`Could not read layer ${spec.name}.`);
  }
  const geojson = await response.json();
  const features = new GeoJSON().readFeatures(geojson, {
    dataProjection: 'EPSG:4326',
    featureProjection: MAP_PROJECTION,
  });
  const layer = new VectorLayer({
    source: new VectorSource({features}),
    style: vectorStyle(spec),
  });
  layer.set('sourceUrl', spec.url);
  applyCommon(layer, spec);
  return layer;
}

/** Adds, updates, and removes contextual OpenLayers layers for the current notebook. */
export function useContextualMapLayers(map: OlMap | undefined) {
  const {layers} = useContext(ContextualMapLayersContext);
  const managed = useRef(new globalThis.Map<string, ManagedLayer>());

  useEffect(() => {
    if (!map) {
      return;
    }
    let cancelled = false;
    const nextIds = new Set(layers.map(layer => layer.id));
    for (const [id, layer] of managed.current) {
      if (!nextIds.has(id)) {
        map.removeLayer(layer);
        managed.current.delete(id);
      }
    }

    for (const spec of layers) {
      const existing = managed.current.get(spec.id);
      if (existing && existing.get('sourceUrl') === spec.url) {
        applyCommon(existing, spec);
        if (existing instanceof VectorLayer) {
          existing.setStyle(vectorStyle(spec));
        }
        continue;
      }
      if (existing) {
        map.removeLayer(existing);
        managed.current.delete(spec.id);
      }
      void createLayer(spec)
        .then(layer => {
          if (cancelled) {
            return;
          }
          const previous = managed.current.get(spec.id);
          if (previous) {
            map.removeLayer(previous);
          }
          managed.current.set(spec.id, layer);
          map.addLayer(layer);
        })
        .catch(error => {
          console.error(error);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [map, layers]);

  useEffect(() => {
    return () => {
      if (!map) {
        return;
      }
      for (const layer of managed.current.values()) {
        map.removeLayer(layer);
      }
      managed.current.clear();
    };
  }, [map]);
}
